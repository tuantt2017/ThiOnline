import logging
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.system_setting import SystemSetting, TrialFeatureUsage
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

DEFAULT_TRIAL_MAX_USES = 1


class TrialGuardService:
    @staticmethod
    def get_trial_max_uses(db: Session) -> int:
        """Retrieves the dynamic trial max usage limit configured by Admin (default: 1)."""
        setting = (
            db.query(SystemSetting)
            .filter(SystemSetting.key == "trial_max_uses")
            .first()
        )
        if not setting:
            return DEFAULT_TRIAL_MAX_USES
        try:
            val = int(setting.value)
            return max(1, val)
        except (ValueError, TypeError):
            return DEFAULT_TRIAL_MAX_USES

    @staticmethod
    def set_trial_max_uses(db: Session, max_uses: int) -> int:
        """Admin configures the dynamic trial max usage limit."""
        target_val = max(1, max_uses)
        setting = (
            db.query(SystemSetting)
            .filter(SystemSetting.key == "trial_max_uses")
            .first()
        )
        if not setting:
            setting = SystemSetting(
                key="trial_max_uses",
                value=str(target_val),
                description="Hạn mức số lượt dùng thử tối đa cho tài khoản Demo",
            )
            db.add(setting)
        else:
            setting.value = str(target_val)

        db.commit()
        db.refresh(setting)
        return target_val

    @staticmethod
    def check_and_increment_trial_usage(
        db: Session, user: User, feature_name: str
    ) -> None:
        """
        Enforces one-time (or N-time dynamic) trial limit on demo users.
        If user is a demo account and has reached max_uses for the feature, raises HTTP 403 Forbidden.
        """
        if not user or not getattr(user, "is_demo", False):
            return

        max_uses = TrialGuardService.get_trial_max_uses(db)
        feature_key = feature_name.strip().lower()

        usage = (
            db.query(TrialFeatureUsage)
            .filter(
                TrialFeatureUsage.user_id == user.id,
                TrialFeatureUsage.feature_key == feature_key,
            )
            .first()
        )

        if not usage:
            usage = TrialFeatureUsage(
                user_id=user.id,
                feature_key=feature_key,
                usage_count=0,
            )
            db.add(usage)
            db.flush()

        if usage.usage_count >= max_uses:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"🔒 Bạn đã sử dụng hết hạn mức dùng thử ({usage.usage_count}/{max_uses} lượt) "
                    f"cho tính năng '{feature_name}'. Vui lòng đăng ký tài khoản chính thức để mở khóa không giới hạn!"
                ),
            )

        usage.usage_count += 1
        db.commit()

    @staticmethod
    def get_or_create_demo_user(db: Session, role: UserRole) -> User:
        """Gets or creates isolated sandbox demo user for 1-click trial login."""
        role_str = role.value if hasattr(role, "value") else str(role)
        email = f"demo_{role_str.lower()}@example.com"
        full_names = {
            "STUDENT": "Học Sinh Trải Nghiệm (Demo)",
            "TEACHER": "Giáo Viên Trải Nghiệm (Demo)",
            "ADMIN": "Quản Trị Viên Trải Nghiệm (Demo)",
        }
        full_name = full_names.get(role_str, f"Tài Khoản Dùng Thử ({role_str})")

        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash("DemoPass123!"),
                full_name=full_name,
                role=role,
                grade=5 if role_str == "STUDENT" else None,
                is_active=True,
                is_demo=True,
                diamond_balance=10 if role_str == "STUDENT" else 0,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Ensure is_demo flag and role match requested demo role
            if not user.is_demo or user.role != role:
                user.is_demo = True
                user.role = role
                db.commit()
                db.refresh(user)

        return user

