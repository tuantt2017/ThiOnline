import pytest
from fastapi.testclient import TestClient

from app.schemas.english_learning import PronunciationEvalRequest
from app.services.english_ai_service import EnglishAIService


def test_english_service_roadmap(db, student_user):
    roadmap = EnglishAIService.get_roadmap(db, student_user, "Tiếng Anh")
    assert roadmap.student_name == student_user.full_name
    assert len(roadmap.units) > 0
    assert roadmap.overall_vocabulary_score > 0.0
    assert "Coach Tiếng Anh" in roadmap.ai_daily_coaching_advice


def test_english_service_unit_detail():
    unit = EnglishAIService.get_unit_detail(1)
    assert unit.unit_id == 1
    assert len(unit.flashcards) >= 4
    assert len(unit.exercises) >= 3
    assert len(unit.speaking_prompts) >= 2


def test_evaluate_pronunciation_service():
    req = PronunciationEvalRequest(
        target_text="My family lives in a house.",
        spoken_text="My family lives in a house.",
    )
    res = EnglishAIService.evaluate_pronunciation(req)
    assert res.score == 100.0
    assert res.accuracy_level == "EXCELLENT"
    assert len(res.word_details) == 6

    req_partial = PronunciationEvalRequest(
        target_text="My family lives in a house.",
        spoken_text="My family in house",
    )
    res_partial = EnglishAIService.evaluate_pronunciation(req_partial)
    assert res_partial.score < 100.0
    assert res_partial.score > 0.0


def test_english_api_endpoints(client: TestClient, student_headers: dict):
    # GET Roadmap
    resp = client.get("/api/v1/english/roadmap", headers=student_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "units" in data
    assert "ai_daily_coaching_advice" in data

    # GET Unit detail
    resp_unit = client.get("/api/v1/english/units/1", headers=student_headers)
    assert resp_unit.status_code == 200
    unit_data = resp_unit.json()
    assert unit_data["unit_id"] == 1
    assert "flashcards" in unit_data
    assert "exercises" in unit_data
    assert "speaking_prompts" in unit_data

    # POST Generate Custom Unit
    custom_payload = {"topic": "Thời tiết & Các mùa trong năm", "grade": 5}
    resp_custom = client.post("/api/v1/english/generate-custom-unit", json=custom_payload, headers=student_headers)
    assert resp_custom.status_code == 200
    custom_data = resp_custom.json()
    assert custom_data["unit_id"] > 0
    assert custom_data["topic"] == "Thời tiết & Các mùa trong năm"
    ex_types = [ex["exercise_type"] for ex in custom_data["exercises"]]
    assert "WORD_TYPING" in ex_types
    assert "FILL_BLANK" in ex_types


def test_daily_8min_rotation_and_distinct_images():
    from app.schemas.english_learning import GenerateCustomEnglishUnitRequest

    # Test that multiple requests generate units with 100% distinct images across words
    req1 = GenerateCustomEnglishUnitRequest(topic="Thử Thách Tiếng Anh 8 Phút Hàng Ngày (07/10/2026) #1001", grade=5)
    unit1 = EnglishAIService.generate_custom_unit(req1)
    
    assert len(unit1.flashcards) == 6
    img_urls1 = [f.image_url for f in unit1.flashcards]
    # Verify no two flashcards have the same image URL
    assert len(set(img_urls1)) == len(img_urls1), "All flashcard images in unit 1 must be distinct"

    # Verify MATCH_IMAGE exercises have distinct media_urls
    match_exercises = [ex for ex in unit1.exercises if ex.exercise_type == "MATCH_IMAGE"]
    assert len(match_exercises) >= 2
    match_media = [ex.media_url for ex in match_exercises]
    assert len(set(match_media)) == len(match_media), "MATCH_IMAGE exercises must have different images"

    # Next session generation must rotate topic and produce distinct words
    req2 = GenerateCustomEnglishUnitRequest(topic="Thử Thách Tiếng Anh 8 Phút Hàng Ngày (08/10/2026) #1002", grade=5)
    unit2 = EnglishAIService.generate_custom_unit(req2)
    assert len(unit2.flashcards) == 6
    img_urls2 = [f.image_url for f in unit2.flashcards]
    assert len(set(img_urls2)) == len(img_urls2), "All flashcard images in unit 2 must be distinct"

    words1 = [f.word.lower() for f in unit1.flashcards]
    words2 = [f.word.lower() for f in unit2.flashcards]
    # Rotating units must have different vocabulary words
    assert words1 != words2, "Rotated units across days/sessions must not have identical vocabulary words"


