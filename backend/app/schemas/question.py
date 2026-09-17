from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.question import (
    QuestionDifficulty,
    QuestionSource,
    QuestionStatus,
    QuestionType,
)


class QuestionOptionBase(BaseModel):
    option_key: str = Field(..., description="Nhãn phương án (A, B, C, D)")
    content: str = Field(..., description="Nội dung phương án")
    is_correct: bool = Field(False, description="Phương án đúng")
    explanation: Optional[str] = Field(None, description="Giải thích riêng cho phương án này")
    order_index: int = Field(0, description="Thứ tự hiển thị (0, 1, 2, 3)")


class QuestionOptionCreate(QuestionOptionBase):
    pass


class QuestionOptionResponse(QuestionOptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int


class QuestionBase(BaseModel):
    content: str = Field(..., min_length=3, description="Nội dung câu hỏi")
    question_type: QuestionType = Field(
        default=QuestionType.MULTIPLE_CHOICE_SINGLE,
        description="Loại câu hỏi (trắc nghiệm 1 đáp án)",
    )
    difficulty: QuestionDifficulty = Field(
        default=QuestionDifficulty.MEDIUM,
        description="Độ khó (EASY, MEDIUM, HARD)",
    )
    status: QuestionStatus = Field(
        default=QuestionStatus.DRAFT,
        description="Trạng thái câu hỏi",
    )
    source: QuestionSource = Field(
        default=QuestionSource.MANUAL,
        description="Nguồn tạo (MANUAL, WORD_IMPORT, AI_GENERATED)",
    )
    subject: str = Field(..., min_length=1, description="Môn học (Toán, Tiếng Việt...)")
    grade: int = Field(..., ge=4, le=9, description="Khối lớp (Lớp 4 đến Lớp 9)")
    chapter: Optional[str] = Field(None, description="Chương")
    lesson: Optional[str] = Field(None, description="Bài học")
    topic: Optional[str] = Field(None, description="Chủ đề kiến thức")
    learning_objective: Optional[str] = Field(None, description="Mục tiêu cần đạt")
    explanation: Optional[str] = Field(None, description="Lời giải / Giải thích chi tiết")
    knowledge_node_id: Optional[int] = Field(None, description="ID nút tri thức trong Knowledge Map")
    document_id: Optional[int] = Field(None, description="ID tài liệu SGK gốc")


class QuestionCreate(QuestionBase):
    options: List[QuestionOptionCreate] = Field(
        ...,
        min_length=2,
        description="Danh sách phương án (thường là 4 phương án A, B, C, D)",
    )

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: List[QuestionOptionCreate]) -> List[QuestionOptionCreate]:
        if not v:
            raise ValueError("Câu hỏi phải có ít nhất 2 phương án lựa chọn")
        
        correct_count = sum(1 for opt in v if opt.is_correct)
        if correct_count != 1:
            raise ValueError(f"Câu hỏi trắc nghiệm phải có chính xác 1 đáp án đúng (hiện có: {correct_count})")
        
        # Kiểm tra trùng key
        keys = [opt.option_key.strip().upper() for opt in v]
        if len(keys) != len(set(keys)):
            raise ValueError("Các nhãn phương án không được trùng lặp (ví dụ: A, B, C, D)")
        
        return v


class QuestionUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=3)
    difficulty: Optional[QuestionDifficulty] = None
    status: Optional[QuestionStatus] = None
    subject: Optional[str] = None
    grade: Optional[int] = Field(None, ge=4, le=9)
    chapter: Optional[str] = None
    lesson: Optional[str] = None
    topic: Optional[str] = None
    learning_objective: Optional[str] = None
    explanation: Optional[str] = None
    knowledge_node_id: Optional[int] = None
    document_id: Optional[int] = None
    options: Optional[List[QuestionOptionCreate]] = None

    @field_validator("options")
    @classmethod
    def validate_options_if_present(
        cls, v: Optional[List[QuestionOptionCreate]]
    ) -> Optional[List[QuestionOptionCreate]]:
        if v is not None:
            if len(v) < 2:
                raise ValueError("Câu hỏi phải có ít nhất 2 phương án lựa chọn")
            correct_count = sum(1 for opt in v if opt.is_correct)
            if correct_count != 1:
                raise ValueError(f"Câu hỏi phải có chính xác 1 đáp án đúng (hiện có: {correct_count})")
            keys = [opt.option_key.strip().upper() for opt in v]
            if len(keys) != len(set(keys)):
                raise ValueError("Các nhãn phương án không được trùng lặp")
        return v


class QuestionResponse(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    options: List[QuestionOptionResponse] = []


class QuestionListResponse(BaseModel):
    items: List[QuestionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class QuestionStatusUpdate(BaseModel):
    status: QuestionStatus = Field(..., description="Trạng thái mới cần cập nhật")


class BatchStatusUpdate(BaseModel):
    question_ids: List[int] = Field(..., min_length=1, description="Danh sách ID câu hỏi cần cập nhật")
    status: QuestionStatus = Field(..., description="Trạng thái mới (APPROVED, REJECTED, v.v.)")


class QuestionStatsResponse(BaseModel):
    total: int
    by_status: Dict[str, int]
    by_difficulty: Dict[str, int]
    by_grade: Dict[str, int]
    by_subject: Dict[str, int]


class ParsedQuestionItem(BaseModel):
    question_index: int
    raw_header: str
    content: str
    options: List[QuestionOptionCreate]
    correct_option: Optional[str]
    explanation: Optional[str]
    is_valid: bool
    error_message: Optional[str] = None


class WordImportResult(BaseModel):
    total_detected: int
    valid_count: int
    invalid_count: int
    imported_count: int
    questions: List[ParsedQuestionItem]
    errors: List[str]
