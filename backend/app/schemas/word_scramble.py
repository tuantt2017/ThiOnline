from typing import List, Optional
from pydantic import BaseModel, Field


class WordScrambleQuestionResponse(BaseModel):
    game_id: str = Field(..., description="ID phiên câu hỏi")
    subject: str = Field(..., description="Môn học (Tiếng Việt / Tiếng Anh)")
    grade: int = Field(..., description="Khối lớp (4-9)")
    scrambled_letters: List[str] = Field(..., description="Danh sách các ký tự / tiếng đảo lộn")
    letter_count: int = Field(..., description="Số lượng ký tự / tiếng")
    hint_meaning: str = Field(..., description="Gợi ý nghĩa của từ / ngữ cảnh")
    hint_sgk_lesson: Optional[str] = Field(None, description="Vị trí bài học SGK GDPT 2018")
    first_letter_hint: Optional[str] = Field(None, description="Gợi ý ký tự đầu tiên")
    english_audio_prompt: Optional[str] = Field(None, description="Văn bản phát âm chuẩn Tiếng Anh (nếu là môn Tiếng Anh)")
    reward_diamonds: int = Field(default=1, description="Số kim cương thưởng khi đạt streak 5 câu đúng")


class WordScrambleVerifyRequest(BaseModel):
    game_id: str = Field(..., description="ID phiên câu hỏi")
    user_answer: str = Field(..., description="Từ do học sinh ghép lại")
    streak_count: int = Field(default=0, description="Chuỗi thắng hiện tại của học sinh")


class WordScrambleVerifyResponse(BaseModel):
    is_correct: bool = Field(..., description="Kết quả kiểm tra từ đúng hay sai")
    target_word: str = Field(..., description="Từ đáp án chính xác")
    user_answer: str = Field(..., description="Từ của học sinh")
    explanation: str = Field(..., description="Giải thích chi tiết nghĩa của từ & ngữ cảnh SGK")
    current_streak: int = Field(..., description="Chuỗi câu trả lời đúng liên tiếp mới")
    earned_diamonds: int = Field(default=0, description="Số kim cương được thưởng lượt này (nếu có)")
    new_diamond_balance: Optional[int] = Field(None, description="Số dư kim cương mới nhất")
