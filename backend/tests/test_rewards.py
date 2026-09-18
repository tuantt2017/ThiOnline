import pytest
from app.models.user import User, UserRole
from app.models.reward import RewardItem, DiamondTransaction, GiftRedemption, RedemptionStatus
from app.services.reward_service import RewardService


def test_reward_service_exam_rules(db):
    student = User(
        email="reward_student@example.com",
        hashed_password="hash",
        full_name="Student Reward Tester",
        role=UserRole.STUDENT,
        diamond_balance=0,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # Attempt 1: score 7.5 (< 9.0) -> gets 1 diamond
    res1 = RewardService.award_exam_diamonds(db, student.id, exam_id=1, score=7.5, attempt_id=101)
    assert res1["awarded"] == 1
    assert res1["new_balance"] == 1

    # Attempt 2: score 8.0 (< 9.0) -> already earned 1 diamond for this exam, so 0 additional
    res2 = RewardService.award_exam_diamonds(db, student.id, exam_id=1, score=8.0, attempt_id=102)
    assert res2["awarded"] == 0

    # Attempt 3: score 9.5 (>= 9.0) -> improved to top tier (2 diamonds total for exam), earns +1 bonus diamond
    res3 = RewardService.award_exam_diamonds(db, student.id, exam_id=1, score=9.5, attempt_id=103)
    assert res3["awarded"] == 1
    assert res3["new_balance"] == 2

    # Attempt 4: score 10.0 (>= 9.0) -> already reached 2 diamonds cap for exam, earns 0 additional
    res4 = RewardService.award_exam_diamonds(db, student.id, exam_id=1, score=10.0, attempt_id=104)
    assert res4["awarded"] == 0
    assert res4["new_balance"] == 2


def test_ai_practice_reward_rule(db):
    student = User(
        email="ai_practice_student@example.com",
        hashed_password="hash",
        full_name="AI Student",
        role=UserRole.STUDENT,
        diamond_balance=5,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    res = RewardService.award_ai_practice_diamonds(db, student.id, "unit_1_family")
    assert res["awarded"] == 1
    assert res["new_balance"] == 6


def test_gift_redemption_flow(db):
    student = User(
        email="redeemer@example.com",
        hashed_password="hash",
        full_name="Redeemer",
        role=UserRole.STUDENT,
        diamond_balance=15,
    )
    db.add(student)

    item = RewardItem(
        title="Bút Dạ Quang Smart",
        description="Thích hợp đánh dấu ghi chú",
        diamond_cost=10,
        stock_quantity=5,
        is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(student)
    db.refresh(item)

    # Success redemption
    redemption = RewardService.redeem_gift(db, student.id, item.id, note="Lớp 5A1")
    assert redemption.diamond_cost == 10
    assert redemption.status == RedemptionStatus.PENDING

    db.refresh(student)
    db.refresh(item)
    assert student.diamond_balance == 5
    assert item.stock_quantity == 4

    # Insufficient balance attempt
    with pytest.raises(Exception):
        RewardService.redeem_gift(db, student.id, item.id)

    # Cancel redemption & refund
    RewardService.update_redemption_status(db, redemption.id, RedemptionStatus.CANCELLED)
    db.refresh(student)
    db.refresh(item)
    assert student.diamond_balance == 15
    assert item.stock_quantity == 5


def test_reward_api_endpoints(client, student_user, student_headers, admin_headers, db):
    # Student checks balance
    r_bal = client.get("/api/v1/rewards/balance", headers=student_headers)
    assert r_bal.status_code == 200
    bal_data = r_bal.json()
    assert "diamond_balance" in bal_data

    # Student checks items catalog
    r_items = client.get("/api/v1/rewards/items", headers=student_headers)
    assert r_items.status_code == 200

    # Claim AI practice reward
    r_ai = client.post("/api/v1/rewards/claim-ai-practice?unit_id=unit_1", headers=student_headers)
    assert r_ai.status_code == 200
    assert r_ai.json()["awarded"] == 1

    # Admin creates new gift item
    r_create = client.post(
        "/api/v1/rewards/admin/items",
        headers=admin_headers,
        json={
            "title": "Bình Nước Học Sinh 500ml",
            "description": "Bình nước giữ nhiệt inox 304",
            "image_url": "https://example.com/flask.jpg",
            "diamond_cost": 25,
            "stock_quantity": 20,
            "category": "Đồ dùng cá nhân",
            "is_active": True,
        },
    )
    assert r_create.status_code == 200
    new_item = r_create.json()
    assert new_item["title"] == "Bình Nước Học Sinh 500ml"

    # Admin lists all redemptions
    r_redemptions = client.get("/api/v1/rewards/admin/redemptions", headers=admin_headers)
    assert r_redemptions.status_code == 200
