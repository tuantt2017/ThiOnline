import pytest
from fastapi.testclient import TestClient
from app.services.word_scramble_service import WordScrambleService


def test_get_next_word_scramble_question_service(db, student_user):
    """Test generating word scramble questions for Vietnamese & English."""
    # Vietnamese Grade 4
    q_vn = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=4)
    assert q_vn.game_id.startswith("wsg_")
    assert q_vn.subject == "Tiếng Việt"
    assert q_vn.grade == 4
    assert len(q_vn.scrambled_letters) > 0
    assert q_vn.hint_meaning is not None

    # English Grade 5
    q_en = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Anh", grade=5)
    assert q_en.subject == "Tiếng Anh"
    assert q_en.grade == 5
    assert q_en.english_audio_prompt is not None


def test_verify_word_scramble_answer(db, student_user):
    """Test verifying answer, streak progression, and diamond reward."""
    q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=4)
    
    # Verify with correct target word from GAME_SESSIONS
    from app.services.word_scramble_service import GAME_SESSIONS
    target_word = GAME_SESSIONS[q.game_id]["target_word"]

    res_correct = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=4
    )
    assert res_correct.is_correct is True
    assert res_correct.current_streak == 5
    assert res_correct.earned_diamonds >= 1

    # Verify wrong answer resets streak
    res_wrong = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer="SAIHOANTOAN", streak_count=5
    )
    assert res_wrong.is_correct is False
    assert res_wrong.current_streak == 0


def test_word_scramble_api_endpoints(client: TestClient, student_headers):
    """Test API GET /next and POST /verify."""
    res_next = client.get("/api/v1/games/word-scramble/next?subject=Tiếng+Việt&grade=5", headers=student_headers)
    assert res_next.status_code == 200
    data = res_next.json()
    assert "game_id" in data
    assert "scrambled_letters" in data
    assert "hint_meaning" in data

    # Verify endpoint
    res_verify = client.post(
        "/api/v1/games/word-scramble/verify",
        json={"game_id": data["game_id"], "user_answer": "THIÊN NHIÊN", "streak_count": 0},
        headers=student_headers,
    )
    assert res_verify.status_code == 200
    verify_data = res_verify.json()
    assert "is_correct" in verify_data
    assert "explanation" in verify_data
