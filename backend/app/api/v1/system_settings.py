from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_admin
from app.models.user import User
from app.services.trial_guard_service import TrialGuardService

router = APIRouter(prefix="/system-settings", tags=["system-settings"])


class TrialLimitUpdateInput(BaseModel):
    max_uses: int


class TrialLimitResponse(BaseModel):
    trial_max_uses: int


@router.get("/trial-limit", response_model=TrialLimitResponse)
def get_trial_limit(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Get current dynamic trial max usage limit."""
    limit = TrialGuardService.get_trial_max_uses(db)
    return {"trial_max_uses": limit}


@router.put("/trial-limit", response_model=TrialLimitResponse)
def update_trial_limit(
    data: TrialLimitUpdateInput,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Admin: Update dynamic trial max usage limit."""
    if admin.is_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản Demo không được phép sửa cấu hình hạn mức hệ thống.",
        )
    new_limit = TrialGuardService.set_trial_max_uses(db, data.max_uses)
    return {"trial_max_uses": new_limit}
