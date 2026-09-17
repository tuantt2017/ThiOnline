from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SgkCitation(BaseModel):
    document_title: str = Field(..., description="Tên tài liệu / Sách giáo khoa")
    chapter: str = Field(..., description="Tên Chủ đề / Chương")
    lesson: str = Field(..., description="Tên Bài học")
    page_number: Optional[int] = Field(None, description="Số trang trong SGK")
    snippet: str = Field(..., description="Đoạn kiến thức ngắn trích dẫn từ SGK")


class ChatMessageItem(BaseModel):
    role: str = Field(..., description="'user' hoặc 'assistant'")
    content: str = Field(..., description="Nội dung tin nhắn")


class ChatMessageInput(BaseModel):
    message: str = Field(..., min_length=1, description="Nội dung câu hỏi của học sinh")
    subject: str = Field(..., description="Môn học (Toán, Tiếng Việt, Tiếng Anh, Khoa học, Lịch sử & Địa lí, Tin học)")
    grade: Optional[int] = Field(None, ge=4, le=9, description="Khối lớp (4-9). Nếu để trống sẽ lấy khối lớp của học sinh")
    conversation_history: Optional[List[ChatMessageItem]] = Field(default=[], description="Lịch sử hội thoại trước đó")


class ChatMessageResponse(BaseModel):
    reply: str = Field(..., description="Câu trả lời của Trợ Lý AI")
    subject: str = Field(..., description="Môn học")
    grade: int = Field(..., description="Khối lớp được áp dụng")
    citations: List[SgkCitation] = Field(default=[], description="Danh sách trích dẫn nguồn SGK đối chiếu")
    suggested_followups: List[str] = Field(default=[], description="Gợi ý câu hỏi đào sâu kiến thức tiếp theo")
