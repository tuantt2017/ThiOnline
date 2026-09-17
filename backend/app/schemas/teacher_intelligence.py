from typing import List, Optional
from pydantic import BaseModel, Field


class StudentRiskItem(BaseModel):
    student_id: int = Field(..., description="ID học sinh")
    student_name: str = Field(..., description="Họ và tên học sinh")
    email: str = Field(..., description="Email học sinh")
    grade: int = Field(..., description="Khối lớp")
    avg_score: float = Field(0.0, description="Điểm trung bình các bài thi đã nộp")
    total_attempts: int = Field(0, description="Tổng số bài thi đã làm")
    risk_level: str = Field(..., description="'GOOD' (🟢 Học lực Tốt/Khá), 'MONITOR' (🟡 Cần Theo Dõi), 'HIGH_RISK' (🔴 Nguy Cơ Hổng Kiến Thức)")
    weak_topics: List[str] = Field(default=[], description="Danh sách các chủ đề SGK học sinh làm sai nhiều")
    recent_trend: str = Field('STABLE', description="'UP' (Đang tiến bộ), 'STABLE' (Ổn định), 'DOWN' (Sút giảm)")


class ClassKnowledgeGapItem(BaseModel):
    chapter: str = Field(..., description="Tên Chương / Chủ đề SGK")
    lesson: str = Field(..., description="Tên Bài học SGK")
    error_rate: float = Field(0.0, description="Tỷ lệ học sinh làm sai bài này (%)")
    affected_students_count: int = Field(0, description="Số lượng học sinh làm sai bài này")
    teaching_recommendation: str = Field(..., description="Gợi ý hoạt động giảng dạy cho giáo viên")


class StudentAiEvaluationResponse(BaseModel):
    student_id: int = Field(..., description="ID học sinh")
    student_name: str = Field(..., description="Tên học sinh")
    grade: int = Field(..., description="Khối lớp")
    overall_comment: str = Field(..., description="Nhận xét tổng quan học lực và thái độ học tập")
    strengths: List[str] = Field(default=[], description="Các điểm mạnh của học sinh")
    weaknesses: List[str] = Field(default=[], description="Các lỗ hổng kiến thức cần khắc phục")
    parent_note: str = Field(..., description="Lời nhắn ngắn gửi Phụ huynh học sinh")
    action_plan: str = Field(..., description="Kế hoạch và lộ trình phấn đấu tiếp theo")


class TeacherClassOverviewResponse(BaseModel):
    subject: str = Field(..., description="Môn học đang quản lý")
    grade: int = Field(..., description="Khối lớp đang quản lý")
    total_students: int = Field(0, description="Tổng số học sinh trong khối/lớp")
    avg_class_score: float = Field(0.0, description="Điểm trung bình toàn lớp")
    pass_rate: float = Field(0.0, description="Tỷ lệ đạt của cả lớp (%)")
    high_risk_count: int = Field(0, description="Số lượng học sinh thuộc nhóm 🔴 Nguy cơ cao")
    monitor_count: int = Field(0, description="Số lượng học sinh thuộc nhóm 🟡 Cần theo dõi")
    good_count: int = Field(0, description="Số lượng học sinh thuộc nhóm 🟢 Tốt/Khá")
    risk_students: List[StudentRiskItem] = Field(default=[], description="Danh sách học sinh kèm phân loại rủi ro")
    class_knowledge_gaps: List[ClassKnowledgeGapItem] = Field(default=[], description="Bản đồ lỗ hổng kiến thức toàn lớp")
    ai_teaching_advice: str = Field(..., description="Gợi ý chiến lược giảng dạy chung cho giáo viên")


class AssignRemedialRequest(BaseModel):
    student_ids: List[int] = Field(..., min_length=1, description="Danh sách ID học sinh cần giao bài")
    subject: str = Field(..., description="Môn học")
    grade: int = Field(..., description="Khối lớp")
    topic: Optional[str] = Field(None, description="Chủ đề / Bài học SGK cần tập trung ôn tập")
    question_count: int = Field(5, ge=3, le=20, description="Số câu hỏi trong bài tự luyện")


class AssignRemedialResponse(BaseModel):
    exam_id: int = Field(..., description="ID đề thi ôn tập được tạo")
    title: str = Field(..., description="Tên đề thi")
    assigned_count: int = Field(..., description="Số học sinh được giao đề")
    message: str = Field(..., description="Thông báo kết quả")
