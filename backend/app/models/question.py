import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE_SINGLE = "MULTIPLE_CHOICE_SINGLE"


class QuestionDifficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class QuestionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    REVIEW = "REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"


class QuestionSource(str, enum.Enum):
    MANUAL = "MANUAL"
    WORD_IMPORT = "WORD_IMPORT"
    AI_GENERATED = "AI_GENERATED"


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    content = Column(Text, nullable=False)
    question_type = Column(
        Enum(QuestionType, name="questiontype", native_enum=False),
        default=QuestionType.MULTIPLE_CHOICE_SINGLE,
        nullable=False,
    )
    difficulty = Column(
        Enum(QuestionDifficulty, name="questiondifficulty", native_enum=False),
        default=QuestionDifficulty.MEDIUM,
        nullable=False,
        index=True,
    )
    status = Column(
        Enum(QuestionStatus, name="questionstatus", native_enum=False),
        default=QuestionStatus.DRAFT,
        nullable=False,
        index=True,
    )
    source = Column(
        Enum(QuestionSource, name="questionsource", native_enum=False),
        default=QuestionSource.MANUAL,
        nullable=False,
    )
    subject = Column(String(100), nullable=False, index=True)
    grade = Column(Integer, nullable=False, index=True)  # Grades 4 to 9
    chapter = Column(String(255), nullable=True)
    lesson = Column(String(255), nullable=True)
    topic = Column(String(255), nullable=True)
    learning_objective = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)

    knowledge_node_id = Column(
        Integer,
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

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

    # Relationships
    options = relationship(
        "QuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.order_index",
        lazy="joined",
    )
    created_by = relationship("User", foreign_keys=[created_by_id])
    knowledge_node = relationship("KnowledgeNode", foreign_keys=[knowledge_node_id])
    document = relationship("Document", foreign_keys=[document_id])

    __table_args__ = (
        Index("ix_questions_subject_grade_status", "subject", "grade", "status"),
    )

    def __repr__(self) -> str:
        return f"<Question id={self.id} subject='{self.subject}' grade={self.grade} status='{self.status}'>"


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question_id = Column(
        Integer,
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    option_key = Column(String(10), nullable=False)  # "A", "B", "C", "D"
    content = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    explanation = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)

    # Relationships
    question = relationship("Question", back_populates="options")

    def __repr__(self) -> str:
        return f"<QuestionOption id={self.id} question_id={self.question_id} key='{self.option_key}' is_correct={self.is_correct}>"
