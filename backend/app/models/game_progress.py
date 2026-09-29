from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.models.base import Base


class UserGameProgress(Base):
    __tablename__ = "user_game_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    game_type = Column(String(50), nullable=False, default="word_scramble")
    subject = Column(String(50), nullable=False, default="Tiếng Việt")
    grade = Column(Integer, nullable=False, default=5)
    stage = Column(Integer, nullable=False, default=1)
    question_index = Column(Integer, nullable=False, default=1)
    streak = Column(Integer, nullable=False, default=0)

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "game_type", "subject", "grade", name="uq_user_game_subject_grade"),
    )

    def __repr__(self) -> str:
        return f"<UserGameProgress user_id={self.user_id} subject='{self.subject}' grade={self.grade} stage={self.stage} q={self.question_index}>"
