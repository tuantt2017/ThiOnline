from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_active_admin
from app.models.user import User
from app.models.reward import RedemptionStatus
from app.schemas.reward import (
    RewardItemResponse,
    RewardItemCreate,
    RewardItemUpdate,
    GiftRedemptionCreate,
    GiftRedemptionResponse,
    RedemptionStatusUpdate,
    RewardBalanceResponse,
    DiamondTransactionResponse,
)
from app.services.reward_service import RewardService

router = APIRouter()


@router.get("/balance", response_model=RewardBalanceResponse)
def get_reward_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current student diamond balance and lifetime earnings."""
    return RewardService.get_user_balance(db, current_user.id)


@router.get("/items", response_model=List[RewardItemResponse])
def get_active_reward_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get catalog of active gift items for redemption."""
    return RewardService.get_active_reward_items(db)


@router.post("/redeem/{item_id}", response_model=GiftRedemptionResponse)
def redeem_gift_item(
    item_id: int,
    data: Optional[GiftRedemptionCreate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Redeem a gift item using student's diamond balance."""
    note = data.note if data else None
    redemption = RewardService.redeem_gift(db, current_user.id, item_id, note)
    return {
        "id": redemption.id,
        "user_id": redemption.user_id,
        "reward_item_id": redemption.reward_item_id,
        "diamond_cost": redemption.diamond_cost,
        "status": redemption.status,
        "note": redemption.note,
        "created_at": redemption.created_at,
        "updated_at": redemption.updated_at,
        "reward_item": redemption.reward_item,
        "user_name": current_user.full_name,
    }


@router.post("/claim-ai-practice")
def claim_ai_practice_reward(
    unit_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Award 1 diamond for completing an AI practice unit."""
    return RewardService.award_ai_practice_diamonds(db, current_user.id, unit_id)


@router.get("/my-history")
def get_student_reward_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get student transactions and redemption history."""
    txs = RewardService.get_user_transactions(db, current_user.id)
    redemptions = RewardService.get_user_redemptions(db, current_user.id)
    return {
        "transactions": [
            DiamondTransactionResponse.model_validate(t) for t in txs
        ],
        "redemptions": redemptions,
    }


# ==================== ADMIN ENDPOINTS ====================


@router.get("/admin/items", response_model=List[RewardItemResponse])
@router.get("/admin/items/", response_model=List[RewardItemResponse], include_in_schema=False)
def admin_get_all_reward_items(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Get full list of gift items."""
    return RewardService.get_all_reward_items(db)


@router.post("/admin/items", response_model=RewardItemResponse)
@router.post("/admin/items/", response_model=RewardItemResponse, include_in_schema=False)
def admin_create_reward_item(
    data: RewardItemCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Create a new gift item."""
    return RewardService.create_reward_item(db, data)


@router.put("/admin/items/{item_id}", response_model=RewardItemResponse)
@router.put("/admin/items/{item_id}/", response_model=RewardItemResponse, include_in_schema=False)
def admin_update_reward_item(
    item_id: int,
    data: RewardItemUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Update an existing gift item or inventory."""
    return RewardService.update_reward_item(db, item_id, data)


@router.get("/admin/redemptions")
def admin_get_all_redemptions(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Get all student redemption requests."""
    return RewardService.get_all_redemptions(db)


@router.put("/admin/redemptions/{redemption_id}/status")
def admin_update_redemption_status(
    redemption_id: int,
    data: RedemptionStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Update redemption status (APPROVED, DELIVERED, CANCELLED)."""
    redemption = RewardService.update_redemption_status(
        db, redemption_id, data.status, data.note
    )
    return {
        "id": redemption.id,
        "user_id": redemption.user_id,
        "reward_item_id": redemption.reward_item_id,
        "diamond_cost": redemption.diamond_cost,
        "status": redemption.status,
        "note": redemption.note,
        "created_at": redemption.created_at,
        "updated_at": redemption.updated_at,
        "reward_item": redemption.reward_item,
        "user_name": redemption.user.full_name if redemption.user else None,
    }
