import pytest
from fastapi import status
from app.models.question import QuestionDifficulty, QuestionStatus


def test_create_question_success(client, teacher_headers):
    payload = {
        "content": "Tìm số tự nhiên x biết: x + 25 = 100",
        "question_type": "MULTIPLE_CHOICE_SINGLE",
        "difficulty": "EASY",
        "status": "REVIEW",
        "subject": "Toán",
        "grade": 4,
        "chapter": "Chương 1: Số tự nhiên",
        "lesson": "Bài 5: Tìm thành phần chưa biết",
        "explanation": "Ta có x = 100 - 25 = 75. Do đó đáp án là A.",
        "options": [
            {"option_key": "A", "content": "x = 75", "is_correct": True, "order_index": 0},
            {"option_key": "B", "content": "x = 125", "is_correct": False, "order_index": 1},
            {"option_key": "C", "content": "x = 65", "is_correct": False, "order_index": 2},
            {"option_key": "D", "content": "x = 85", "is_correct": False, "order_index": 3},
        ],
    }
    response = client.post("/api/v1/questions/", json=payload, headers=teacher_headers)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["id"] is not None
    assert data["subject"] == "Toán"
    assert data["grade"] == 4
    assert len(data["options"]) == 4
    correct_opts = [opt for opt in data["options"] if opt["is_correct"]]
    assert len(correct_opts) == 1
    assert correct_opts[0]["option_key"] == "A"


def test_student_cannot_create_question(client, student_headers):
    payload = {
        "content": "Câu hỏi thử nghiệm từ học sinh",
        "subject": "Toán",
        "grade": 5,
        "options": [
            {"option_key": "A", "content": "1", "is_correct": True, "order_index": 0},
            {"option_key": "B", "content": "2", "is_correct": False, "order_index": 1},
        ],
    }
    response = client.post("/api/v1/questions/", json=payload, headers=student_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_validation_no_correct_answer(client, teacher_headers):
    payload = {
        "content": "Câu hỏi không có đáp án đúng",
        "subject": "Toán",
        "grade": 6,
        "options": [
            {"option_key": "A", "content": "1", "is_correct": False, "order_index": 0},
            {"option_key": "B", "content": "2", "is_correct": False, "order_index": 1},
        ],
    }
    response = client.post("/api/v1/questions/", json=payload, headers=teacher_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_validation_multiple_correct_answers(client, teacher_headers):
    payload = {
        "content": "Câu hỏi có 2 đáp án đúng",
        "subject": "Toán",
        "grade": 6,
        "options": [
            {"option_key": "A", "content": "1", "is_correct": True, "order_index": 0},
            {"option_key": "B", "content": "2", "is_correct": True, "order_index": 1},
        ],
    }
    response = client.post("/api/v1/questions/", json=payload, headers=teacher_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_validation_grade_out_of_range(client, teacher_headers):
    # Grade 3 is below primary target (4-9)
    payload = {
        "content": "Câu hỏi lớp 3 không hợp lệ",
        "subject": "Toán",
        "grade": 3,
        "options": [
            {"option_key": "A", "content": "1", "is_correct": True, "order_index": 0},
            {"option_key": "B", "content": "2", "is_correct": False, "order_index": 1},
        ],
    }
    response = client.post("/api/v1/questions/", json=payload, headers=teacher_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Grade 10 is high school (not in 4-9)
    payload["grade"] = 10
    response = client.post("/api/v1/questions/", json=payload, headers=teacher_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_list_and_filter_questions(client, teacher_headers):
    # Create 2 questions with different grades and subjects
    client.post(
        "/api/v1/questions/",
        json={
            "content": "Toán lớp 4 câu 1",
            "subject": "Toán",
            "grade": 4,
            "difficulty": "EASY",
            "status": "APPROVED",
            "options": [
                {"option_key": "A", "content": "1", "is_correct": True, "order_index": 0},
                {"option_key": "B", "content": "2", "is_correct": False, "order_index": 1},
            ],
        },
        headers=teacher_headers,
    )
    client.post(
        "/api/v1/questions/",
        json={
            "content": "Tiếng Việt lớp 5 câu 1",
            "subject": "Tiếng Việt",
            "grade": 5,
            "difficulty": "HARD",
            "status": "DRAFT",
            "options": [
                {"option_key": "A", "content": "Từ đồng nghĩa", "is_correct": True, "order_index": 0},
                {"option_key": "B", "content": "Từ trái nghĩa", "is_correct": False, "order_index": 1},
            ],
        },
        headers=teacher_headers,
    )

    # Filter by subject
    res_toan = client.get("/api/v1/questions/?subject=Toán", headers=teacher_headers)
    assert res_toan.status_code == status.HTTP_200_OK
    assert all(q["subject"] == "Toán" for q in res_toan.json()["items"])

    # Filter by grade
    res_g5 = client.get("/api/v1/questions/?grade=5", headers=teacher_headers)
    assert res_g5.status_code == status.HTTP_200_OK
    assert all(q["grade"] == 5 for q in res_g5.json()["items"])


def test_student_forbidden_from_question_bank(client, teacher_headers, student_headers):
    # Create a question
    create_res = client.post(
        "/api/v1/questions/",
        json={
            "content": "Câu hỏi thử nghiệm phân quyền",
            "subject": "Khoa học",
            "grade": 4,
            "status": "APPROVED",
            "options": [
                {"option_key": "A", "content": "Đúng", "is_correct": True, "order_index": 0},
                {"option_key": "B", "content": "Sai", "is_correct": False, "order_index": 1},
            ],
        },
        headers=teacher_headers,
    )
    q_id = create_res.json()["id"]

    # Student cannot list questions
    res_list = client.get("/api/v1/questions/", headers=student_headers)
    assert res_list.status_code == status.HTTP_403_FORBIDDEN

    # Student cannot get single question by ID
    res_get = client.get(f"/api/v1/questions/{q_id}", headers=student_headers)
    assert res_get.status_code == status.HTTP_403_FORBIDDEN


def test_batch_update_status(client, teacher_headers):
    q1 = client.post(
        "/api/v1/questions/",
        json={
            "content": "Batch test 1",
            "subject": "Toán",
            "grade": 7,
            "status": "REVIEW",
            "options": [
                {"option_key": "A", "content": "1", "is_correct": True, "order_index": 0},
                {"option_key": "B", "content": "2", "is_correct": False, "order_index": 1},
            ],
        },
        headers=teacher_headers,
    ).json()["id"]

    q2 = client.post(
        "/api/v1/questions/",
        json={
            "content": "Batch test 2",
            "subject": "Toán",
            "grade": 7,
            "status": "REVIEW",
            "options": [
                {"option_key": "A", "content": "1", "is_correct": True, "order_index": 0},
                {"option_key": "B", "content": "2", "is_correct": False, "order_index": 1},
            ],
        },
        headers=teacher_headers,
    ).json()["id"]

    batch_res = client.post(
        "/api/v1/questions/batch-status",
        json={"question_ids": [q1, q2], "status": "APPROVED"},
        headers=teacher_headers,
    )
    assert batch_res.status_code == status.HTTP_200_OK
    assert batch_res.json()["updated_count"] == 2


def test_update_and_delete_question(client, teacher_headers):
    create_res = client.post(
        "/api/v1/questions/",
        json={
            "content": "Câu hỏi cần sửa",
            "subject": "Tin học",
            "grade": 8,
            "options": [
                {"option_key": "A", "content": "Cũ 1", "is_correct": True, "order_index": 0},
                {"option_key": "B", "content": "Cũ 2", "is_correct": False, "order_index": 1},
            ],
        },
        headers=teacher_headers,
    )
    q_id = create_res.json()["id"]

    # Update question
    update_res = client.put(
        f"/api/v1/questions/{q_id}",
        json={
            "content": "Câu hỏi đã được cập nhật nội dung",
            "difficulty": "HARD",
            "explanation": "Đã thêm lời giải mới",
        },
        headers=teacher_headers,
    )
    assert update_res.status_code == status.HTTP_200_OK
    assert update_res.json()["content"] == "Câu hỏi đã được cập nhật nội dung"
    assert update_res.json()["difficulty"] == "HARD"

    # Delete question
    del_res = client.delete(f"/api/v1/questions/{q_id}", headers=teacher_headers)
    assert del_res.status_code == status.HTTP_204_NO_CONTENT

    # Verify 404
    get_res = client.get(f"/api/v1/questions/{q_id}", headers=teacher_headers)
    assert get_res.status_code == status.HTTP_404_NOT_FOUND


def test_question_stats(client, teacher_headers):
    stats_res = client.get("/api/v1/questions/stats", headers=teacher_headers)
    assert stats_res.status_code == status.HTTP_200_OK
    data = stats_res.json()
    assert "total" in data
    assert "by_status" in data
    assert "by_difficulty" in data
    assert "by_grade" in data
    assert "by_subject" in data
