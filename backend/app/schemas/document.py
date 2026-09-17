from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.document import DocumentStatus, DocumentType, KnowledgeNodeType


class DocumentBase(BaseModel):
    title: str
    subject: str
    grade: int
    book_series: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentResponse(DocumentBase):
    id: int
    filename: str
    file_type: DocumentType
    file_size: int
    status: DocumentStatus
    error_message: Optional[str] = None
    total_pages: Optional[int] = None
    chunk_count: int
    extracted_metadata: Optional[Dict[str, Any]] = None
    uploaded_by_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentChunkResponse(BaseModel):
    id: int
    document_id: int
    chunk_index: int
    content: str
    char_count: int
    page_number: Optional[int] = None
    chapter: Optional[str] = None
    lesson: Optional[str] = None
    topic: Optional[str] = None
    concept: Optional[str] = None
    learning_objective: Optional[str] = None
    chunk_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedChunksResponse(BaseModel):
    items: List[DocumentChunkResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class KnowledgeNodeResponse(BaseModel):
    id: int
    node_type: KnowledgeNodeType
    title: str
    description: Optional[str] = None
    order_index: int
    properties: Optional[Dict[str, Any]] = None
    children: List["KnowledgeNodeResponse"] = []

    model_config = ConfigDict(from_attributes=True)


class KnowledgeMapTreeResponse(BaseModel):
    document_id: int
    title: str
    subject: str
    grade: int
    book_series: Optional[str] = None
    tree: List[KnowledgeNodeResponse]


class KnowledgeOverviewItem(BaseModel):
    document_id: int
    title: str
    subject: str
    grade: int
    book_series: Optional[str] = None
    tree: List[KnowledgeNodeResponse]


class DocumentSectionItem(BaseModel):
    title: str
    lessons: List[str] = []


class DocumentSectionsResponse(BaseModel):
    document_id: int
    title: str
    subject: str
    grade: int
    book_series: Optional[str] = None
    chapters: List[DocumentSectionItem] = []
    all_chapters: List[str] = []
    all_topics: List[str] = []

