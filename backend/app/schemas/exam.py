from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.exam import AttemptStatus, ExamStatus
from app.models.question import QuestionDifficulty, QuestionType
from app.schemas.question import QuestionResponse


class ExamQuestionCreateInput(BaseModel):
    question_id: int
    points: float = 1.0
    order_index: int = 0


class ExamCreateInput(BaseModel):
    title: str = Field(..., description="Tiêu đề đề thi")
    description: Optional[str] = Field(None, description="Mô tả đề thi")
    subject: str = Field(..., description="Môn học (Toán, Tiếng Việt...)")
    grade: int = Field(..., ge=4, le=9, description="Khối lớp (4 đến 9)")
    duration_minutes: int = Field(45, ge=5, le=180, description="Thời gian làm bài (phút)")
    total_points: float = Field(10.0, ge=1.0, le=100.0, description="Tổng điểm của đề")
    passing_score: float = Field(5.0, ge=0.0, le=100.0, description="Điểm đạt tối thiểu")
    shuffle_questions: bool = Field(True, description="Xáo trộn thứ tự câu hỏi")
    shuffle_options: bool = Field(True, description="Xáo trộn thứ tự phương án A/B/C/D")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    question_ids: Optional[List[int]] = Field(None, description="Danh sách ID câu hỏi đã chọn")
    assigned_student_ids: Optional[List[int]] = Field(None, description="ID các học sinh được giao đề")
    assigned_grade: Optional[int] = Field(None, description="Khối lớp được giao đề")


class ExamUpdateInput(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    grade: Optional[int] = None
    duration_minutes: Optional[int] = None
    total_points: Optional[float] = None
    passing_score: Optional[float] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    status: Optional[ExamStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    question_ids: Optional[List[int]] = None


class ExamQuestionResponse(BaseModel):
    id: int
    exam_id: int
    question_id: int
    order_index: int
    points: float
    question: Optional[QuestionResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ExamResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    subject: str
    grade: int
    duration_minutes: int
    total_questions: int
    total_points: float
    passing_score: float
    shuffle_questions: bool
    shuffle_options: bool
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: ExamStatus
    created_by_id: int
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    exam_questions: List[ExamQuestionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ExamListResponse(BaseModel):
    items: List[ExamResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# --- SECURITY EXAM SCHEMAS (MASKED FOR STUDENTS DURING EXAM) ---

class StudentOptionTakeResponse(BaseModel):
    option_key: str
    content: str
    order_index: int

    model_config = ConfigDict(from_attributes=True)


class StudentQuestionTakeResponse(BaseModel):
    id: int  # Question ID
    content: str
    question_type: QuestionType
    difficulty: QuestionDifficulty
    subject: str
    grade: int
    order_index: int
    points: float
    options: List[StudentOptionTakeResponse]


class StudentExamTakeResponse(BaseModel):
    attempt_id: int
    exam_id: int
    title: str
    subject: str
    grade: int
    duration_minutes: int
    started_at: datetime
    deadline_at: datetime
    remaining_seconds: int
    status: AttemptStatus
    questions: List[StudentQuestionTakeResponse]
    saved_answers: Dict[int, str] = Field(default_factory=dict, description="Bản đồ question_id -> selected_option_key")


class AnswerSubmitInput(BaseModel):
    question_id: int = Field(..., description="ID câu hỏi")
    selected_option_key: Optional[str] = Field(None, description="Phương án được chọn (A, B, C, D) hoặc None nếu bỏ chọn")


class AttemptAnswerResponse(BaseModel):
    id: int
    attempt_id: int
    question_id: int
    selected_option_key: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExamAttemptResultResponse(BaseModel):
    attempt_id: int
    exam_id: int
    exam_title: str
    status: AttemptStatus
    score: float
    percentage: float
    correct_count: int
    total_count: int
    passing_score: float
    is_passed: bool
    diamonds_awarded: int = 0
    started_at: datetime
    submitted_at: Optional[datetime] = None
    detailed_answers: List[Dict[str, Any]] = Field(default_factory=list)


class StudentAttemptReport(BaseModel):
    attempt_id: int
    student_id: int
    student_name: str
    student_email: str
    status: AttemptStatus
    score: float = 0.0
    percentage: float = 0.0
    correct_count: int = 0
    total_count: int = 0
    is_passed: bool = False
    started_at: datetime
    submitted_at: Optional[datetime] = None
    detailed_answers: List[Dict[str, Any]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)



class QuestionAnalyticsItem(BaseModel):
    question_id: int
    question_text: str
    correct_count: int = 0
    wrong_count: int = 0
    accuracy_rate: float = 0.0
    option_distribution: Dict[str, int] = Field(default_factory=dict)


class ExamReportResponse(BaseModel):
    exam_id: int
    exam_title: str
    subject: str
    grade: int
    duration_minutes: int
    passing_score: float
    total_points: float
    total_questions: int
    total_attempts: int
    submitted_count: int
    avg_score: float
    pass_count: int
    pass_rate: float
    highest_score: float
    lowest_score: float
    student_attempts: List[StudentAttemptReport] = []
    question_analytics: List[QuestionAnalyticsItem] = []



class TeacherExamsSummaryItem(BaseModel):
    exam_id: int
    title: str
    subject: str
    grade: int
    status: ExamStatus
    created_at: datetime
    total_attempts: int
    submitted_count: int
    avg_score: float
    pass_rate: float

