from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.question import QuestionDifficulty, QuestionStatus


class DifficultyDistribution(BaseModel):
    easy: int = Field(30, ge=0, le=100, description="Tỷ lệ câu dễ (%)")
    medium: int = Field(50, ge=0, le=100, description="Tỷ lệ câu trung bình (%)")
    hard: int = Field(20, ge=0, le=100, description="Tỷ lệ câu khó (%)")


class AiQuestionGenerateRequest(BaseModel):
    subject: str = Field(..., description="Môn học (Toán, Tiếng Việt, Tiếng Anh...)")
    grade: int = Field(..., ge=4, le=9, description="Khối lớp (4 đến 9)")
    document_id: Optional[int] = Field(None, description="ID tài liệu SGK đính kèm")
    chapter: Optional[str] = Field(None, description="Chương / Chủ đề")
    chapters: Optional[List[str]] = Field(default_factory=list, description="Danh sách các Chương/Chủ đề được chọn")
    lesson: Optional[str] = Field(None, description="Bài học")
    topic: Optional[str] = Field(None, description="Tiểu mục / Chủ đề con")
    topics: Optional[List[str]] = Field(default_factory=list, description="Danh sách các Bài học/Chủ đề con được chọn")
    count: int = Field(5, ge=1, le=20, description="Số lượng câu hỏi cần sinh (1 đến 20)")
    difficulty_distribution: DifficultyDistribution = Field(
        default_factory=DifficultyDistribution
    )
    use_web_context: bool = Field(
        True, description="Sử dụng ngữ cảnh thực tế (Web Context) để làm câu hỏi sinh động"
    )
    save_as_draft: bool = Field(
        True, description="Tự động lưu vào Ngân hàng câu hỏi dưới dạng DRAFT/REVIEW"
    )


class KnowledgeSourceInfo(BaseModel):
    document_id: Optional[int] = None
    document_title: Optional[str] = None
    chapter: Optional[str] = None
    lesson: Optional[str] = None
    page: Optional[int] = None


class ContextSourceInfo(BaseModel):
    type: str = Field("textbook", description="Loại bối cảnh: 'web' hoặc 'textbook'")
    title: Optional[str] = None
    url: Optional[str] = None
    summary: Optional[str] = None


class AiGeneratedOption(BaseModel):
    key: str = Field(..., description="Mã phương án (A, B, C, D)")
    text: str = Field(..., description="Nội dung phương án")
    is_correct: bool = Field(False, description="Đáp án đúng hay sai")


class AiGeneratedQuestionItem(BaseModel):
    question_text: str = Field(..., description="Nội dung câu hỏi")
    options: List[AiGeneratedOption] = Field(..., description="Danh sách 4 phương án")
    difficulty: QuestionDifficulty = Field(QuestionDifficulty.MEDIUM, description="Độ khó câu hỏi")
    topic: Optional[str] = None
    learning_objective: Optional[str] = None
    explanation: str = Field(..., description="Lời giải / Giải thích chi tiết")
    knowledge_source: Optional[KnowledgeSourceInfo] = None
    context_source: Optional[ContextSourceInfo] = None
    is_valid: bool = Field(True, description="Câu hỏi hợp lệ theo quy tắc backend")
    validation_errors: List[str] = Field(default_factory=list, description="Danh sách lỗi nếu có")
    created_question_id: Optional[int] = Field(None, description="ID câu hỏi đã lưu vào CSDL")


class AiQuestionGenerateResponse(BaseModel):
    total_generated: int
    valid_count: int
    invalid_count: int
    saved_count: int
    questions: List[AiGeneratedQuestionItem]
    errors: List[str] = Field(default_factory=list)


class AiTutorFeedbackItem(BaseModel):
    question_id: int
    question_text: str
    selected_option_key: Optional[str] = None
    selected_option_text: Optional[str] = None
    correct_option_key: str
    correct_option_text: str
    why_wrong: str = Field(..., description="Giải thích tại sao phương án đã chọn chưa đúng")
    correct_concept: str = Field(..., description="Khái niệm và kiến thức cốt lõi theo SGK")
    study_hint: str = Field(..., description="Gợi ý phương pháp học tập và bài học cần xem lại")
    source_reference: Optional[str] = Field(None, description="Trích dẫn bài học / SGK tương ứng")


class AiTutorResponse(BaseModel):
    attempt_id: int
    total_incorrect: int
    score: float
    percentage: float
    summary_advice: str = Field(..., description="Đánh giá tổng quan và lời khuyên gia sư AI cho toàn bài làm")
    feedbacks: List[AiTutorFeedbackItem] = Field(default_factory=list)


class AdaptivePracticeRequest(BaseModel):
    subject: str = Field(..., description="Môn học (Toán, Tiếng Việt, Tiếng Anh...)")
    count: int = Field(5, ge=3, le=20, description="Số lượng câu hỏi cần luyện tập (3 đến 20)")


class AdaptivePracticeResponse(BaseModel):
    exam_id: int
    attempt_id: int
    title: str
    subject: str
    grade: int
    total_questions: int
    duration_minutes: int
    weak_topics_targeted: List[str] = Field(default_factory=list, description="Danh sách các chủ đề điểm yếu được AI tập trung củng cố")
    message: str = Field(..., description="Thông điệp hướng dẫn từ trợ lý AI")


