from datetime import datetime, timedelta, timezone
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.exam import Exam, ExamAttempt, ExamStatus, AttemptStatus
from app.models.question import Question, QuestionDifficulty, QuestionOption, QuestionStatus, QuestionType


@pytest.fixture
def sample_approved_questions(db: Session, teacher_user):
    questions = []
    for i in range(5):
        q = Question(
            content=f"Câu hỏi kiểm tra số {i+1}?",
            question_type=QuestionType.MULTIPLE_CHOICE_SINGLE,
            difficulty=QuestionDifficulty.MEDIUM,
            status=QuestionStatus.APPROVED,
            subject="Toán",
            grade=5,
            explanation=f"Lời giải mẫu cho câu {i+1}",
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
                    is_correct=(key == "A"),  # A is always correct in fixture
                    order_index=idx,
                )
            )
        questions.append(q)
    db.commit()
    return questions


def test_create_and_publish_exam(client: TestClient, teacher_headers: dict, sample_approved_questions):
    q_ids = [q.id for q in sample_approved_questions]
    create_payload = {
        "title": "Đề thi giữa kỳ 1 Môn Toán Lớp 5",
        "description": "Đề thi thử nghiệm 15 phút",
        "subject": "Toán",
        "grade": 5,
        "duration_minutes": 15,
        "total_points": 10.0,
        "passing_score": 5.0,
        "shuffle_questions": False,
        "shuffle_options": False,
        "question_ids": q_ids,
    }

    response = client.post("/api/v1/exams/", json=create_payload, headers=teacher_headers)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    exam_id = data["id"]
    assert data["status"] == "DRAFT"
    assert data["total_questions"] == 5

    # Publish exam
    pub_res = client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_headers)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"


def test_security_exam_payload_masking(client: TestClient, teacher_headers: dict, student_headers: dict, sample_approved_questions):
    q_ids = [q.id for q in sample_approved_questions]

    # Create and publish exam
    exam_res = client.post(
        "/api/v1/exams/",
        json={
            "title": "Đề thi kiểm tra bảo mật",
            "subject": "Toán",
            "grade": 5,
            "duration_minutes": 20,
            "question_ids": q_ids,
        },
        headers=teacher_headers,
    )
    exam_id = exam_res.json()["id"]
    client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_headers)

    # Student starts attempt
    start_res = client.post(f"/api/v1/exams/{exam_id}/start", headers=student_headers)
    assert start_res.status_code == 200
    take_data = start_res.json()

    assert "attempt_id" in take_data
    assert take_data["remaining_seconds"] > 0
    assert len(take_data["questions"]) == 5

    # SECURITY EXAM VERIFICATION: Check that is_correct and explanation are NOT in the payload
    for q in take_data["questions"]:
        assert "explanation" not in q or q.get("explanation") is None
        for opt in q["options"]:
            assert "is_correct" not in opt


def test_autosave_answers(client: TestClient, teacher_headers: dict, student_headers: dict, sample_approved_questions):
    q_ids = [q.id for q in sample_approved_questions]

    exam_res = client.post(
        "/api/v1/exams/",
        json={
            "title": "Đề thi thử Autosave",
            "subject": "Toán",
            "grade": 5,
            "duration_minutes": 30,
            "question_ids": q_ids,
        },
        headers=teacher_headers,
    )
    exam_id = exam_res.json()["id"]
    client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_headers)

    start_res = client.post(f"/api/v1/exams/{exam_id}/start", headers=student_headers)
    attempt_id = start_res.json()["attempt_id"]
    first_q_id = q_ids[0]

    # Autosave answer A for first question
    save_res = client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"question_id": first_q_id, "selected_option_key": "A"},
        headers=student_headers,
    )
    assert save_res.status_code == 200

    # Query room again to verify saved answer restoration
    room_res = client.get(f"/api/v1/exams/attempts/{attempt_id}", headers=student_headers)
    assert room_res.status_code == 200
    saved = room_res.json()["saved_answers"]
    assert str(first_q_id) in saved or first_q_id in saved
    assert saved.get(str(first_q_id)) == "A" or saved.get(first_q_id) == "A"


def test_auto_grading_and_submit(client: TestClient, teacher_headers: dict, student_headers: dict, sample_approved_questions):
    q_ids = [q.id for q in sample_approved_questions]

    exam_res = client.post(
        "/api/v1/exams/",
        json={
            "title": "Đề thi Chấm điểm tự động",
            "subject": "Toán",
            "grade": 5,
            "duration_minutes": 30,
            "total_points": 10.0,
            "question_ids": q_ids,
            "shuffle_questions": False,
            "shuffle_options": False,
        },
        headers=teacher_headers,
    )
    exam_id = exam_res.json()["id"]
    client.post(f"/api/v1/exams/{exam_id}/publish", headers=teacher_headers)

    start_res = client.post(f"/api/v1/exams/{exam_id}/start", headers=student_headers)
    attempt_id = start_res.json()["attempt_id"]

    # Select correct option "A" for all 5 questions
    for q_id in q_ids:
        client.post(
            f"/api/v1/exams/attempts/{attempt_id}/answers",
            json={"question_id": q_id, "selected_option_key": "A"},
            headers=student_headers,
        )

    # Submit exam
    sub_res = client.post(f"/api/v1/exams/attempts/{attempt_id}/submit", headers=student_headers)
    assert sub_res.status_code == 200
    res_data = sub_res.json()

    assert res_data["status"] == "SUBMITTED"
    assert res_data["correct_count"] == 5
    assert res_data["score"] == 10.0
    assert res_data["percentage"] == 100.0
    assert res_data["is_passed"] is True
    assert len(res_data["detailed_answers"]) == 5

    # Verify /api/v1/exams/my-attempts returns the submitted attempt successfully
    my_attempts_res = client.get("/api/v1/exams/my-attempts", headers=student_headers)
    assert my_attempts_res.status_code == 200
    attempts_list = my_attempts_res.json()
    assert isinstance(attempts_list, list)
    assert len(attempts_list) >= 1
    matched = [att for att in attempts_list if att["attempt_id"] == attempt_id]
    assert len(matched) == 1
    assert matched[0]["status"] == "SUBMITTED"
    assert matched[0]["score"] == 10.0


def test_teacher_exam_reports(client: TestClient, teacher_headers: dict, student_headers: dict, sample_approved_questions):
    q_ids = [q.id for q in sample_approved_questions]

    # Create & publish exam
    exam_res = client.post(
        "/api/v1/exams/",
        json={
            "title": "Đề thi Kiểm tra Báo cáo Giáo viên",
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

    # Student starts and submits exam
    start_res = client.post(f"/api/v1/exams/{exam_id}/start", headers=student_headers)
    attempt_id = start_res.json()["attempt_id"]
    for q_id in q_ids:
        client.post(
            f"/api/v1/exams/attempts/{attempt_id}/answers",
            json={"question_id": q_id, "selected_option_key": "A"},
            headers=student_headers,
        )
    client.post(f"/api/v1/exams/attempts/{attempt_id}/submit", headers=student_headers)

    # 1. Test GET /api/v1/exams/reports/summary
    summary_res = client.get("/api/v1/exams/reports/summary", headers=teacher_headers)
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert isinstance(summary_data, list)
    found_summary = [s for s in summary_data if s["exam_id"] == exam_id]
    assert len(found_summary) == 1
    assert found_summary[0]["submitted_count"] == 1
    assert found_summary[0]["avg_score"] == 10.0

    # 2. Test GET /api/v1/exams/{id}/report
    report_res = client.get(f"/api/v1/exams/{exam_id}/report", headers=teacher_headers)
    assert report_res.status_code == 200
    report_data = report_res.json()
    assert report_data["exam_id"] == exam_id
    assert report_data["total_attempts"] == 1
    assert report_data["submitted_count"] == 1
    assert report_data["avg_score"] == 10.0
    assert report_data["highest_score"] == 10.0
    assert report_data["lowest_score"] == 10.0
    assert len(report_data["student_attempts"]) == 1
    att_report = report_data["student_attempts"][0]
    assert att_report["attempt_id"] == attempt_id
    assert att_report["score"] == 10.0
    assert len(att_report["detailed_answers"]) == 5

    # 3. Test RBAC: Student cannot access teacher report
    student_report_res = client.get(f"/api/v1/exams/{exam_id}/report", headers=student_headers)
    assert student_report_res.status_code == 403


def test_role_scoping_for_exams(client: TestClient, db: Session, admin_user, admin_headers, teacher_user, teacher_headers, student_user, student_headers):
    from app.models.user import User, UserRole
    from app.core.security import create_access_token, get_password_hash

    # Create Teacher 2
    t2 = User(email="teacher2@example.com", hashed_password=get_password_hash("pass"), full_name="GV 2", role=UserRole.TEACHER, is_active=True)
    # Create Student 2
    s2 = User(email="student2@example.com", hashed_password=get_password_hash("pass"), full_name="HS 2", role=UserRole.STUDENT, is_active=True)
    db.add_all([t2, s2])
    db.commit()
    db.refresh(t2)
    db.refresh(s2)

    t2_token = create_access_token(subject=t2.id, role=t2.role.value)
    t2_headers = {"Authorization": f"Bearer {t2_token}"}
    s2_token = create_access_token(subject=s2.id, role=s2.role.value)
    s2_headers = {"Authorization": f"Bearer {s2_token}"}

    # Exam 1 by Teacher 1 (PUBLISHED)
    e1 = Exam(title="Đề Teacher 1", subject="Toán", grade=5, duration_minutes=15, status=ExamStatus.PUBLISHED, created_by_id=teacher_user.id)
    # Exam 2 by Teacher 2 (PUBLISHED)
    e2 = Exam(title="Đề Teacher 2", subject="Toán", grade=5, duration_minutes=15, status=ExamStatus.PUBLISHED, created_by_id=t2.id)
    # Exam 3 by Admin (PUBLISHED)
    e3 = Exam(title="Đề Admin", subject="Toán", grade=5, duration_minutes=15, status=ExamStatus.PUBLISHED, created_by_id=admin_user.id)
    # Exam 4 by Student 1 (AI practice, PUBLISHED)
    e4 = Exam(title="Đề AI Student 1", subject="Toán", grade=5, duration_minutes=15, status=ExamStatus.PUBLISHED, created_by_id=student_user.id)
    # Exam 5 by Student 2 (AI practice, PUBLISHED)
    e5 = Exam(title="Đề AI Student 2", subject="Toán", grade=5, duration_minutes=15, status=ExamStatus.PUBLISHED, created_by_id=s2.id)

    db.add_all([e1, e2, e3, e4, e5])
    db.commit()
    db.refresh(e1)
    db.refresh(e2)
    db.refresh(e3)
    db.refresh(e4)
    db.refresh(e5)

    e1_id = e1.id
    e2_id = e2.id
    e3_id = e3.id
    e4_id = e4.id
    e5_id = e5.id

    # 1. Teacher 1 listing exams -> only sees Teacher 1's exams
    t1_list = client.get("/api/v1/exams/", headers=teacher_headers).json()["items"]
    t1_ids = [item["id"] for item in t1_list]
    assert e1_id in t1_ids
    assert e2_id not in t1_ids
    assert e3_id not in t1_ids
    assert e4_id not in t1_ids
    assert e5_id not in t1_ids

    # 2. Student 1 listing exams -> sees Teacher 1, Teacher 2, Admin exams + Student 1's own exam, BUT NOT Student 2's exam
    s1_list = client.get("/api/v1/exams/", headers=student_headers).json()["items"]
    s1_ids = [item["id"] for item in s1_list]
    assert e1_id in s1_ids
    assert e2_id in s1_ids
    assert e3_id in s1_ids
    assert e4_id in s1_ids
    assert e5_id not in s1_ids

    # 3. Admin listing exams -> sees ALL exams + creator info
    admin_list = client.get("/api/v1/exams/", headers=admin_headers).json()["items"]
    admin_ids = [item["id"] for item in admin_list]
    assert e1_id in admin_ids
    assert e2_id in admin_ids
    assert e3_id in admin_ids
    assert e4_id in admin_ids
    assert e5_id in admin_ids

    # Verify created_by metadata is present
    for item in admin_list:
        if item["id"] == e1_id:
            assert item["created_by_name"] == teacher_user.full_name
            assert item["created_by_role"] == "TEACHER"
        elif item["id"] == e4_id:
            assert item["created_by_name"] == student_user.full_name
            assert item["created_by_role"] == "STUDENT"
        elif item["id"] == e3_id:
            assert item["created_by_name"] == admin_user.full_name
            assert item["created_by_role"] == "ADMIN"



