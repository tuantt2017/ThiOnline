from typing import List, Optional
from pydantic import BaseModel, Field


class TopicMasteryItem(BaseModel):
    chapter: str = Field(..., description="Tên Chương / Chủ đề SGK")
    lesson: str = Field(..., description="Tên Bài học SGK")
    topic: Optional[str] = Field(None, description="Tiểu mục / Phân môn")
    total_questions: int = Field(0, description="Tổng số câu hỏi đã làm trong chủ đề này")
    correct_count: int = Field(0, description="Số câu làm đúng")
    mastery_percentage: float = Field(0.0, description="Tỷ lệ thành thạo 0.0 - 100.0%")
    status_level: str = Field(..., description="'MASTERED' (🟢 Đã vững), 'PRACTICE_NEEDED' (🟡 Cần rèn luyện), 'WEAK' (🔴 Điểm yếu)")
    page_reference: Optional[int] = Field(None, description="Trang tham chiếu trong SGK")


class LearningRoadmapResponse(BaseModel):
    subject: str = Field(..., description="Môn học đang xem lộ trình")
    grade: int = Field(..., description="Khối lớp học sinh")
    overall_mastery_percentage: float = Field(0.0, description="Điểm thành thạo tổng quan 0.0 - 100.0%")
    total_attempts: int = Field(0, description="Tổng số lượt làm bài thi đã thực hiện")
    mastered_count: int = Field(0, description="Số lượng chương/bài đã đạt 🟢 Đã vững")
    practice_needed_count: int = Field(0, description="Số lượng chương/bài 🟡 Cần rèn luyện")
    weak_count: int = Field(0, description="Số lượng chương/bài 🔴 Điểm yếu")
    chapter_breakdown: List[TopicMasteryItem] = Field(default=[], description="Danh sách chi tiết mức độ thành thạo từng chương/bài")
    ai_daily_action: str = Field(..., description="Gợi ý hành động ôn tập cụ thể từng ngày từ AI")
    recommended_weak_topics: List[str] = Field(default=[], description="Danh sách các chủ đề yếu nhất cần ưu tiên ôn tập")
