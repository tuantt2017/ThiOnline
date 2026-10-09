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
    assert data["question_index"] >= 1
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


def test_word_scramble_database_progress_persistence(db, student_user):
    """Test that stage progress is persisted in Database across service calls & server restarts."""
    # Save progress to DB for Grade 5 Tiếng Việt
    WordScrambleService.save_user_progress(
        db=db,
        student=student_user,
        subject="Tiếng Việt",
        grade=5,
        stage=3,
        question_index=7,
        streak=4,
    )

    # Clear in-memory dictionary cache to simulate server restart / new login session
    from app.services.word_scramble_service import USER_STAGE_PROGRESS
    USER_STAGE_PROGRESS.clear()

    # Retrieve progress from DB
    prog = WordScrambleService.get_user_progress(db=db, student=student_user, subject="Tiếng Việt", grade=5)
    assert prog["stage"] == 3
    assert prog["question_index"] == 7
    assert prog["streak"] == 4

    # Verify next question automatically resumes at Stage 3, Question 7 from DB
    q = WordScrambleService.get_next_question(db=db, student=student_user, subject="Tiếng Việt", grade=5, stage=1, question_index=1)
    assert q.stage == 3
    assert q.question_index == 7


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


def test_word_scramble_infinite_stages_and_collection(client: TestClient, student_headers, db, student_user):
    """Test Infinite Stages (stage > 15), rank titles, emoji clues, and Vocabulary Album collection API."""
    # 1. Test infinite stage 16 question
    res_stage16 = client.get("/api/v1/games/word-scramble/next?subject=Tiếng+Việt&grade=5&stage=16&question_index=1", headers=student_headers)
    assert res_stage16.status_code == 200
    data16 = res_stage16.json()
    assert data16["stage"] == 16
    assert data16["is_infinite_stage"] is True
    assert "Đại Tướng" in data16["rank_title"] or "Vô Cực" in data16["rank_title"]
    assert data16["theme_title"] is not None
    assert "emoji_clues" in data16
    assert len(data16["emoji_clues"]) > 0

    # 2. Test answering correctly saves to collection
    target_word = data16["target_word"]
    res_verify = client.post(
        "/api/v1/games/word-scramble/verify",
        json={"game_id": data16["game_id"], "user_answer": target_word, "streak_count": 0},
        headers=student_headers,
    )
    assert res_verify.status_code == 200
    verify_data = res_verify.json()
    assert verify_data["is_correct"] is True
    assert verify_data["unlocked_new_word"] is True

    # 3. Test retrieving collection from API
    res_coll = client.get("/api/v1/games/word-scramble/collection?subject=Tiếng+Việt", headers=student_headers)
    assert res_coll.status_code == 200
    coll_data = res_coll.json()
    assert coll_data["total_collected"] >= 1
    collected_words = [item["word"] for item in coll_data["items"]]
    assert target_word in collected_words


def test_word_scramble_stage_batch_preparation_and_cache(client: TestClient, student_headers, db, student_user):
    """Test single-call stage batch generation, caching, and /prepare-stage endpoint."""
    # 1. Direct service test
    words, is_cached_1, _ = WordScrambleService.prepare_stage_words(
        user_id=student_user.id,
        subject="Tiếng Việt",
        grade=5,
        stage=4,
        force_refresh=True,
    )
    assert len(words) >= 5
    assert is_cached_1 is False

    # Second call for same stage must be cached (0 latency)
    words2, is_cached_2, _ = WordScrambleService.prepare_stage_words(
        user_id=student_user.id,
        subject="Tiếng Việt",
        grade=5,
        stage=4,
        force_refresh=False,
    )
    assert len(words2) == len(words)
    assert is_cached_2 is True

    # 2. Test API /prepare-stage
    res_prep = client.post(
        "/api/v1/games/word-scramble/prepare-stage",
        json={"subject": "Tiếng Việt", "grade": 5, "stage": 4, "force_refresh": False},
        headers=student_headers,
    )
    assert res_prep.status_code == 200
    data_prep = res_prep.json()
    assert data_prep["status"] == "ready"
    assert data_prep["stage"] == 4
    assert data_prep["total_words"] >= 5
    assert data_prep["is_cached"] is True

    # 3. Test force_refresh on /next
    res_next_fresh = client.get(
        "/api/v1/games/word-scramble/next?subject=Tiếng+Việt&grade=5&stage=4&question_index=1&force_refresh=true",
        headers=student_headers,
    )
    assert res_next_fresh.status_code == 200
    assert res_next_fresh.json()["game_id"].startswith("wsg_")


