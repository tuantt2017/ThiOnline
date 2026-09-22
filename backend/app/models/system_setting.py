from sqlalchemy import Column, Integer, String
from app.models.base import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)


class TrialFeatureUsage(Base):
    __tablename__ = "trial_feature_usages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    feature_key = Column(String(100), nullable=False, index=True)
    usage_count = Column(Integer, default=0, nullable=False)
