import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class TransactionType(str, enum.Enum):
    EXAM_REWARD = "EXAM_REWARD"
    AI_PRACTICE_REWARD = "AI_PRACTICE_REWARD"
    GIFT_REDEMPTION = "GIFT_REDEMPTION"
    ADMIN_BONUS = "ADMIN_BONUS"


class RedemptionStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class RewardItem(Base):
    __tablename__ = "reward_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    diamond_cost = Column(Integer, nullable=False, default=10)
    stock_quantity = Column(Integer, nullable=False, default=100)
    category = Column(String(100), nullable=False, default="Đồ dùng học tập")
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class DiamondTransaction(Base):
    __tablename__ = "diamond_transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    transaction_type = Column(
        Enum(TransactionType, name="transactiontype", native_enum=False),
        nullable=False,
    )
    description = Column(String(255), nullable=False)
    reference_id = Column(String(100), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User", backref="diamond_transactions")


class GiftRedemption(Base):
    __tablename__ = "gift_redemptions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reward_item_id = Column(Integer, ForeignKey("reward_items.id", ondelete="CASCADE"), nullable=False)
    diamond_cost = Column(Integer, nullable=False)
    status = Column(
        Enum(RedemptionStatus, name="redemptionstatus", native_enum=False),
        default=RedemptionStatus.PENDING,
        nullable=False,
    )
    note = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", backref="gift_redemptions")
    reward_item = relationship("RewardItem", backref="redemptions")
