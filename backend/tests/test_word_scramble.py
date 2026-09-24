import pytest
from fastapi.testclient import TestClient
from app.services.word_scramble_service import WordScrambleService, GAME_SESSIONS, ENGLISH_BLACKLIST_WORDS


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


def test_word_scramble_language_isolation(db, student_user):
    """Test strict separation: English questions MUST be pure English, Vietnamese questions MUST NOT be pure English words."""
    # Test 10 consecutive Vietnamese questions
    for _ in range(10):
        q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=5)
        target = GAME_SESSIONS[q.game_id]["target_word"]
        # Must not be an English blacklist word
        assert target not in ENGLISH_BLACKLIST_WORDS

    # Test 10 consecutive English questions
    for _ in range(10):
        q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Anh", grade=5)
        target = GAME_SESSIONS[q.game_id]["target_word"]
        # Must be valid English ASCII
        assert WordScrambleService._is_valid_english_word(target) is True


def test_word_scramble_non_repetition(db, student_user):
    """Test that consecutive question requests do not repeat the exact same target word."""
    served_words = []
    for _ in range(8):
        q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=4)
        target = GAME_SESSIONS[q.game_id]["target_word"]
        served_words.append(target)

    # In 8 consecutive calls, all 8 words should be distinct
    assert len(set(served_words)) == 8


def test_verify_word_scramble_7_streak_reward_rule(db, student_user):
    """Test 7-streak reward rule: Only award diamonds at multiples of 7 consecutive correct answers."""
    q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=4)
    target_word = GAME_SESSIONS[q.game_id]["target_word"]

    # Streak 5 does NOT award diamonds
    res_streak5 = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=4
    )
    assert res_streak5.is_correct is True
    assert res_streak5.current_streak == 5
    assert res_streak5.earned_diamonds == 0

    # Streak 7 DOES award diamonds
    res_streak7 = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=6
    )
    assert res_streak7.is_correct is True
    assert res_streak7.current_streak == 7
    assert res_streak7.earned_diamonds == 1

    # Verify wrong answer resets streak to 0
    res_wrong = WordScrambleService.verify_answer(
        db, student_user, game_id=q.game_id, user_answer="SAIHOANTOAN", streak_count=7
    )
    assert res_wrong.is_correct is False
    assert res_wrong.current_streak == 0


def test_word_scramble_daily_cap_2_diamonds(db, student_user):
    """Test that Word Scramble game caps rewards at maximum 2 diamonds per day."""
    q = WordScrambleService.get_next_question(db, student_user, subject="Tiếng Việt", grade=4)
    target_word = GAME_SESSIONS[q.game_id]["target_word"]

    # 1st 7-streak milestone: awards 1 diamond
    r1 = WordScrambleService.verify_answer(db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=6)
    assert r1.earned_diamonds == 1

    # 2nd 7-streak milestone: awards 1 diamond (total = 2)
    r2 = WordScrambleService.verify_answer(db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=13)
    assert r2.earned_diamonds == 1

    # 3rd 7-streak milestone on same day: awards 0 diamonds due to daily cap 2
    r3 = WordScrambleService.verify_answer(db, student_user, game_id=q.game_id, user_answer=target_word, streak_count=20)
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
    assert data["question_index"] == 1
    assert data["total_questions_per_stage"] == 10

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


def test_pre_filled_hints_generation():
    """Test _generate_pre_filled_hints method."""
    target_items = ["UỐNG", "NƯỚC", "NHỚ", "NGUỒN"]
    scrambled_items = ["NGUỒN", "UỐNG", "NHỚ", "NƯỚC"]

    # Generate hints multiple times to test structure
    for _ in range(20):
        hints = WordScrambleService._generate_pre_filled_hints(target_items, scrambled_items)
        if hints:
            for h in hints:
                assert "target_index" in h
                assert "scrambled_index" in h
                assert "letter" in h
                assert target_items[h["target_index"]] == h["letter"]
                assert scrambled_items[h["scrambled_index"]] == h["letter"]

