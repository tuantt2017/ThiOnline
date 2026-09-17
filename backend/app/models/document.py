import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class DocumentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DocumentType(str, enum.Enum):
    PDF = "PDF"
    DOCX = "DOCX"
    TXT = "TXT"


class KnowledgeNodeType(str, enum.Enum):
    SUBJECT = "SUBJECT"
    GRADE = "GRADE"
    BOOK = "BOOK"
    CHAPTER = "CHAPTER"
    LESSON = "LESSON"
    TOPIC = "TOPIC"
    CONCEPT = "CONCEPT"
    LEARNING_OBJECTIVE = "LEARNING_OBJECTIVE"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(
        Enum(DocumentType, name="documenttype", native_enum=False),
        nullable=False,
    )
    file_size = Column(Integer, nullable=False)  # in bytes
    subject = Column(String(100), nullable=False, index=True)
    grade = Column(Integer, nullable=False, index=True)
    book_series = Column(String(100), nullable=True)
    status = Column(
        Enum(DocumentStatus, name="documentstatus", native_enum=False),
        default=DocumentStatus.PENDING,
        nullable=False,
        index=True,
    )
    error_message = Column(Text, nullable=True)
    total_pages = Column(Integer, nullable=True)
    chunk_count = Column(Integer, default=0, nullable=False)
    extracted_metadata = Column(JSON, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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

    uploader = relationship("User", backref="documents")
    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentChunk.chunk_index",
    )
    knowledge_nodes = relationship(
        "KnowledgeNode",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="KnowledgeNode.order_index",
    )

    def __repr__(self) -> str:
        return f"<Document id={self.id} title='{self.title}' status='{self.status}'>"


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    char_count = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)
    chapter = Column(String(255), nullable=True, index=True)
    lesson = Column(String(255), nullable=True, index=True)
    topic = Column(String(255), nullable=True)
    concept = Column(String(255), nullable=True)
    learning_objective = Column(Text, nullable=True)
    chunk_metadata = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    document = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<DocumentChunk id={self.id} doc={self.document_id} index={self.chunk_index}>"


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    parent_id = Column(
        Integer,
        ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    node_type = Column(
        Enum(KnowledgeNodeType, name="knowledgenodetype", native_enum=False),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    properties = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    document = relationship("Document", back_populates="knowledge_nodes")
    parent = relationship("KnowledgeNode", remote_side=[id], backref="children")

    def __repr__(self) -> str:
        return f"<KnowledgeNode id={self.id} type='{self.node_type}' title='{self.title}'>"
