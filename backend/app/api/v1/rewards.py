import logging
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
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
from app.services.trial_guard_service import TrialGuardService

logger = logging.getLogger(__name__)

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
    TrialGuardService.check_and_increment_trial_usage(db, current_user, "doi_qua_tang")
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


@router.delete("/admin/items/{item_id}")
@router.delete("/admin/items/{item_id}/", include_in_schema=False)
def admin_delete_reward_item(
    item_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Delete a gift item (or deactivate if redemptions exist)."""
    return RewardService.delete_reward_item(db, item_id)


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


@router.get("/image-proxy", summary="Proxy hình ảnh quà tặng ngoài (như ảnh .webp Shopee/susercontent)")
def reward_image_proxy(url: str):
    """
    Public proxy for external reward images (including .webp, .png, .jpg, .svg)
    that block hotlinking by checking the browser Referer header (e.g. susercontent.com, Shopee, etc.).
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL hình ảnh không hợp lệ")

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        }
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            resp = client.get(clean_url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Không thể tải ảnh từ máy chủ nguồn")

            content_type = resp.headers.get("content-type", "image/webp")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400, s-maxage=86400",
                },
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Lỗi khi proxy ảnh quà tặng {clean_url}: {e}")
        raise HTTPException(status_code=502, detail="Lỗi kết nối tới máy chủ nguồn ảnh")

