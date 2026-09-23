import pytest
from fastapi.testclient import TestClient
from app.services.word_scramble_service import WordScrambleService, GAME_SESSIONS


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


def test_verify_word_scramble_10_streak_reward_rule(db, student_user):
    """Test 10-streak reward rule: Only award diamonds at multiples of 10 consecutive correct answers."""
    q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=4)
    target_word = GAME_SESSIONS[q.game_id]["target_word"]

    # Streak 5 does NOT award diamonds anymore
    res_streak5 = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=4
    )
    assert res_streak5.is_correct is True
    assert res_streak5.current_streak == 5
    assert res_streak5.earned_diamonds == 0

    # Streak 10 DOES award diamonds
    res_streak10 = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=9
    )
    assert res_streak10.is_correct is True
    assert res_streak10.current_streak == 10

    # Verify wrong answer resets streak to 0
    res_wrong = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer="SAIHOANTOAN", streak_count=10
    )
    assert res_wrong.is_correct is False
    assert res_wrong.current_streak == 0


def test_word_scramble_daily_cap_2_diamonds(db, student_user):
    """Test that Word Scramble game caps rewards at maximum 2 diamonds per day."""
    q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=4)
    target_word = GAME_SESSIONS[q.game_id]["target_word"]

    # 1st 10-streak milestone: awards 1 diamond
    r1 = WordScrambleService.verify_answer(db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=9)
    assert r1.earned_diamonds == 1

    # 2nd 10-streak milestone: awards 1 diamond (total = 2)
    r2 = WordScrambleService.verify_answer(db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=19)
    assert r2.earned_diamonds == 1

    # 3rd 10-streak milestone on same day: awards 0 diamonds due to daily cap 2
    r3 = WordScrambleService.verify_answer(db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=29)
    assert r3.earned_diamonds == 0
    assert "hạn mức nhận tối đa 2 💎" in r3.explanation


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
