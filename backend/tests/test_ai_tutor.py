import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.question import Question, QuestionDifficulty, QuestionOption, QuestionStatus, QuestionType


@pytest.fixture
def sample_tutor_questions(db: Session, teacher_user):
    questions = []
    for i in range(3):
        q = Question(
            content=f"Câu hỏi ôn tập số {i+1}?",
            question_type=QuestionType.MULTIPLE_CHOICE_SINGLE,
            difficulty=QuestionDifficulty.MEDIUM,
            status=QuestionStatus.APPROVED,
            subject="Toán",
            grade=5,
            chapter="Chương 1: Phân số",
            lesson="Bài 2: Tỉ lệ phần trăm",
            explanation=f"Lời giải chuẩn SGK cho câu {i+1}",
            created_by_id=teacher_user.id,
        )
        db.add(q)
        db.flush()
        for idx, key in enumerate(["A", "B", "C", "D"]):
            db.add(
                QuestionOption(
                    question_id=q.id,
                    option_key=key,
                    content=f"Phương án {key} của câu {i+1}",
                    is_correct=(key == "A"),  # A is always correct
                    order_index=idx,
                )
            )
        questions.append(q)
    db.commit()
    return questions


def test_ai_tutor_feedback_flow(
    client: TestClient,
    teacher_headers: dict,
    student_headers: dict,
    sample_tutor_questions,
):
    q_ids = [q.id for q in sample_tutor_questions]

    # Create & publish exam
    exam_res = client.post(
        "/api/v1/exams/",
        json={
            "title": "Đề thi Kiểm tra AI Tutor",
            "subject": "Toán",
            "grade": 5,
            "duration_minutes": 30,
            "total_points": 10.0,
            "question_ids": q_ids,
        },
        headers=teacher_headers,
    )
    exam_id = exam_res.json()["id"]
    client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_headers)

    # Student starts attempt
    start_res = client.post(f"/api/v1/exams/{exam_id}/start", headers=student_headers)
    attempt_id = start_res.json()["attempt_id"]

    # 1. AI Tutor call on IN_PROGRESS attempt should fail with 400
    in_progress_tutor = client.post(f"/api/v1/exams/attempts/{attempt_id}/ai-tutor", headers=student_headers)
    assert in_progress_tutor.status_code == 400

    # Answer question 1 correctly ("A") and questions 2 & 3 incorrectly ("B")
    client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"question_id": q_ids[0], "selected_option_key": "A"},
        headers=student_headers,
    )
    client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"question_id": q_ids[1], "selected_option_key": "B"},
        headers=student_headers,
    )
    client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"question_id": q_ids[2], "selected_option_key": "B"},
        headers=student_headers,
    )

    # Submit exam
    sub_res = client.post(f"/api/v1/exams/attempts/{attempt_id}/submit", headers=student_headers)
    assert sub_res.status_code == 200

    # 2. Call AI Tutor endpoint after submission
    tutor_res = client.post(f"/api/v1/exams/attempts/{attempt_id}/ai-tutor", headers=student_headers)
    assert tutor_res.status_code == 200
    tutor_data = tutor_res.json()

    assert tutor_data["attempt_id"] == attempt_id
    assert tutor_data["total_incorrect"] == 2
    assert "summary_advice" in tutor_data
    assert len(tutor_data["feedbacks"]) == 2

    # Verify structured feedback fields (why_wrong, correct_concept, study_hint, source_reference)
    for fb in tutor_data["feedbacks"]:
        assert "why_wrong" in fb and fb["why_wrong"]
        assert "correct_concept" in fb and fb["correct_concept"]
        assert "study_hint" in fb and fb["study_hint"]
        assert "source_reference" in fb and fb["source_reference"]
        assert fb["selected_option_key"] == "B"
        assert fb["correct_option_key"] == "A"
