from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.models.reward import TransactionType, RedemptionStatus


class RewardItemBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    diamond_cost: int
    stock_quantity: int
    category: str = "Đồ dùng học tập"
    is_active: bool = True


class RewardItemCreate(RewardItemBase):
    pass


class RewardItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    diamond_cost: Optional[int] = None
    stock_quantity: Optional[int] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class RewardItemResponse(RewardItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiamondTransactionResponse(BaseModel):
    id: int
    user_id: int
    amount: int
    transaction_type: TransactionType
    description: str
    reference_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GiftRedemptionCreate(BaseModel):
    note: Optional[str] = None


class GiftRedemptionResponse(BaseModel):
    id: int
    user_id: int
    reward_item_id: int
    diamond_cost: int
    status: RedemptionStatus
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    reward_item: Optional[RewardItemResponse] = None
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RedemptionStatusUpdate(BaseModel):
    status: RedemptionStatus
    note: Optional[str] = None


class RewardBalanceResponse(BaseModel):
    diamond_balance: int
    total_earned: int
    total_spent: int
