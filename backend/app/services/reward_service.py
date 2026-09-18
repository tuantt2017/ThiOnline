from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.user import User
from app.models.reward import (
    RewardItem,
    DiamondTransaction,
    GiftRedemption,
    TransactionType,
    RedemptionStatus,
)
from app.schemas.reward import RewardItemCreate, RewardItemUpdate


class RewardService:
    @staticmethod
    def get_user_balance(db: Session, user_id: int) -> dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        total_earned = (
            db.query(func.sum(DiamondTransaction.amount))
            .filter(DiamondTransaction.user_id == user_id, DiamondTransaction.amount > 0)
            .scalar()
            or 0
        )
        total_spent_raw = (
            db.query(func.sum(DiamondTransaction.amount))
            .filter(DiamondTransaction.user_id == user_id, DiamondTransaction.amount < 0)
            .scalar()
            or 0
        )

        return {
            "diamond_balance": user.diamond_balance or 0,
            "total_earned": int(total_earned),
            "total_spent": abs(int(total_spent_raw)),
        }

    @staticmethod
    def award_exam_diamonds(
        db: Session, user_id: int, exam_id: int, score: float, attempt_id: int
    ) -> dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"awarded": 0, "total_earned_for_exam": 0}

        # Target reward for this score
        target_diamonds = 2 if score >= 9.0 else 1

        # Check total diamonds already earned by user for this exam
        prefix = f"exam_{exam_id}_"
        existing_txs = (
            db.query(DiamondTransaction)
            .filter(
                DiamondTransaction.user_id == user_id,
                DiamondTransaction.transaction_type == TransactionType.EXAM_REWARD,
                DiamondTransaction.reference_id.like(f"{prefix}%"),
            )
            .all()
        )
        prev_earned = sum(tx.amount for tx in existing_txs)

        new_award = max(0, target_diamonds - prev_earned)
        if new_award > 0:
            user.diamond_balance = (user.diamond_balance or 0) + new_award
            desc = (
                f"Thưởng {new_award} 💎 - Đạt {score:.1f} điểm bài thi"
                if new_award == target_diamonds
                else f"Thưởng bổ sung {new_award} 💎 - Nâng điểm bài thi lên {score:.1f}"
            )
            tx = DiamondTransaction(
                user_id=user_id,
                amount=new_award,
                transaction_type=TransactionType.EXAM_REWARD,
                description=desc,
                reference_id=f"exam_{exam_id}_attempt_{attempt_id}",
            )
            db.add(tx)
            db.commit()
            db.refresh(user)

        return {
            "awarded": new_award,
            "total_earned_for_exam": prev_earned + new_award,
            "new_balance": user.diamond_balance,
        }

    @staticmethod
    def award_ai_practice_diamonds(db: Session, user_id: int, unit_id: str) -> dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"awarded": 0}

        user.diamond_balance = (user.diamond_balance or 0) + 1
        tx = DiamondTransaction(
            user_id=user_id,
            amount=1,
            transaction_type=TransactionType.AI_PRACTICE_REWARD,
            description="Thưởng 1 💎 - Hoàn thành bài ôn luyện Tiếng Anh AI",
            reference_id=f"unit_{unit_id}",
        )
        db.add(tx)
        db.commit()
        db.refresh(user)

        return {"awarded": 1, "new_balance": user.diamond_balance}

    @staticmethod
    def get_active_reward_items(db: Session) -> List[RewardItem]:
        return (
            db.query(RewardItem)
            .filter(RewardItem.is_active == True)
            .order_by(RewardItem.diamond_cost.asc())
            .all()
        )

    @staticmethod
    def get_all_reward_items(db: Session) -> List[RewardItem]:
        return db.query(RewardItem).order_by(RewardItem.id.desc()).all()

    @staticmethod
    def create_reward_item(db: Session, data: RewardItemCreate) -> RewardItem:
        item = RewardItem(**data.model_dump())
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update_reward_item(
        db: Session, item_id: int, data: RewardItemUpdate
    ) -> RewardItem:
        item = db.query(RewardItem).filter(RewardItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Vật phẩm không tồn tại")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def redeem_gift(
        db: Session, user_id: int, item_id: int, note: Optional[str] = None
    ) -> GiftRedemption:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        item = db.query(RewardItem).filter(RewardItem.id == item_id).first()
        if not item or not item.is_active:
            raise HTTPException(
                status_code=400, detail="Vật phẩm quà tặng không còn tồn tại hoặc đã bị ẩn"
            )

        if item.stock_quantity <= 0:
            raise HTTPException(
                status_code=400, detail="Vật phẩm quà tặng hiện đã hết hàng trong kho"
            )

        if (user.diamond_balance or 0) < item.diamond_cost:
            raise HTTPException(
                status_code=400,
                detail=f"Số dư Kim Cương không đủ ({user.diamond_balance}/{item.diamond_cost} 💎)",
            )

        # Process deduction
        user.diamond_balance -= item.diamond_cost
        item.stock_quantity -= 1

        redemption = GiftRedemption(
            user_id=user_id,
            reward_item_id=item.id,
            diamond_cost=item.diamond_cost,
            status=RedemptionStatus.PENDING,
            note=note,
        )
        db.add(redemption)
        db.flush()

        # Add transaction record
        tx = DiamondTransaction(
            user_id=user_id,
            amount=-item.diamond_cost,
            transaction_type=TransactionType.GIFT_REDEMPTION,
            description=f"Đổi quà: {item.title}",
            reference_id=f"redemption_{redemption.id}",
        )
        db.add(tx)
        db.commit()
        db.refresh(redemption)
        return redemption

    @staticmethod
    def get_user_transactions(db: Session, user_id: int) -> List[DiamondTransaction]:
        return (
            db.query(DiamondTransaction)
            .filter(DiamondTransaction.user_id == user_id)
            .order_by(DiamondTransaction.created_at.desc())
            .all()
        )

    @staticmethod
    def get_user_redemptions(db: Session, user_id: int) -> List[dict]:
        redemptions = (
            db.query(GiftRedemption)
            .filter(GiftRedemption.user_id == user_id)
            .order_by(GiftRedemption.created_at.desc())
            .all()
        )
        result = []
        for r in redemptions:
            result.append(
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "reward_item_id": r.reward_item_id,
                    "diamond_cost": r.diamond_cost,
                    "status": r.status,
                    "note": r.note,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                    "reward_item": r.reward_item,
                    "user_name": r.user.full_name if r.user else None,
                }
            )
        return result

    @staticmethod
    def get_all_redemptions(db: Session) -> List[dict]:
        redemptions = (
            db.query(GiftRedemption).order_by(GiftRedemption.created_at.desc()).all()
        )
        result = []
        for r in redemptions:
            result.append(
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "reward_item_id": r.reward_item_id,
                    "diamond_cost": r.diamond_cost,
                    "status": r.status,
                    "note": r.note,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                    "reward_item": r.reward_item,
                    "user_name": r.user.full_name if r.user else None,
                }
            )
        return result

    @staticmethod
    def update_redemption_status(
        db: Session, redemption_id: int, new_status: RedemptionStatus, note: Optional[str] = None
    ) -> GiftRedemption:
        redemption = (
            db.query(GiftRedemption)
            .filter(GiftRedemption.id == redemption_id)
            .first()
        )
        if not redemption:
            raise HTTPException(status_code=404, detail="Đơn đổi quà không tồn tại")

        old_status = redemption.status
        if old_status == new_status:
            return redemption

        # Refund if status changes to CANCELLED from non-cancelled
        if new_status == RedemptionStatus.CANCELLED and old_status != RedemptionStatus.CANCELLED:
            user = db.query(User).filter(User.id == redemption.user_id).first()
            if user:
                user.diamond_balance = (user.diamond_balance or 0) + redemption.diamond_cost
                tx = DiamondTransaction(
                    user_id=user.id,
                    amount=redemption.diamond_cost,
                    transaction_type=TransactionType.ADMIN_BONUS,
                    description=f"Hoàn kim cương - Hủy đơn đổi quà #{redemption.id}",
                    reference_id=f"refund_{redemption.id}",
                )
                db.add(tx)

            # Restore stock
            item = db.query(RewardItem).filter(RewardItem.id == redemption.reward_item_id).first()
            if item:
                item.stock_quantity += 1

        redemption.status = new_status
        if note is not None:
            redemption.note = note

        db.commit()
        db.refresh(redemption)
        return redemption
