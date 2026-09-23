import random
import uuid
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.word_scramble import (
    WordScrambleQuestionResponse,
    WordScrambleVerifyResponse,
)
from app.services.reward_service import RewardService
from app.services.trial_guard_service import TrialGuardService

logger = logging.getLogger(__name__)

# In-Memory Cache Registry for active game sessions
GAME_SESSIONS: Dict[str, Dict[str, Any]] = {}

# Curated SGK Curriculum Word Bank (GDPT Lớp 4 - 9)
VIETNAMESE_SGK_WORDS = [
    {
        "word": "YÊU THƯƠNG",
        "grade": 4,
        "hint": "Tình cảm gắn bó, quan tâm sâu sắc giữa con người với con người.",
        "lesson": "SGK Tiếng Việt 4 - Chủ điểm 'Chắp cánh ước mơ'",
    },
    {
        "word": "ĐOÀN KẾT",
        "grade": 4,
        "hint": "Sự kết hợp tập thể thành một khối thống nhất vì mục tiêu chung.",
        "lesson": "SGK Tiếng Việt 4 - Bài tập đọc 'Măng mọc thẳng'",
    },
    {
        "word": "TRUNG THỰC",
        "grade": 4,
        "hint": "Tôn trọng sự thật, không dối trá, thành thật với bản thân và người khác.",
        "lesson": "SGK Tiếng Việt 4 - Luyện từ và câu 'Tính trung thực'",
    },
    {
        "word": "CHĂM CHỈ",
        "grade": 4,
        "hint": "Chịu khó, siêng năng làm việc và học tập liên tục.",
        "lesson": "SGK Tiếng Việt 4 - Đọc mở rộng",
    },
    {
        "word": "THIÊN NHIÊN",
        "grade": 5,
        "hint": "Tất cả những gì tồn tại xung quanh con người không do con người tạo ra.",
        "lesson": "SGK Tiếng Việt 5 - Chủ điểm 'Mẹ Thiên Nhiên'",
    },
    {
        "word": "UỐNG NƯỚC NHỚ NGUỒN",
        "grade": 5,
        "hint": "Thành ngữ thể hiện lòng biết ơn sâu sắc đối với thế hệ đi trước.",
        "lesson": "SGK Tiếng Việt 5 - Bài 'Người công dân số một'",
    },
    {
        "word": "AN TOÀN GIAO THÔNG",
        "grade": 5,
        "hint": "Ý thức chấp hành luật pháp khi tham gia di chuyển trên đường phố.",
        "lesson": "SGK Tiếng Việt 5 - Hoạt động trải nghiệm GDPT",
    },
    {
        "word": "TÌNH LÀNG NGHĨA XÓM",
        "grade": 5,
        "hint": "Sự gắn kết, yêu thương, giúp đỡ lẫn nhau giữa các gia đình hàng xóm.",
        "lesson": "SGK Tiếng Việt 5 - Tập đọc 'Chuỗi ngọc xanh'",
    },
    {
        "word": "TỰ DO ĐỘC LẬP",
        "grade": 6,
        "hint": "Quyền chủ quyền thiêng liêng của một dân tộc, không bị phụ thuộc.",
        "lesson": "SGK Ngữ Văn 6 - Văn bản 'Tuyên ngôn Độc lập'",
    },
    {
        "word": "TRUYỀN THỐNG",
        "grade": 6,
        "hint": "Những giá trị văn hóa, tinh thần tốt đẹp được truyền từ đời này sang đời khác.",
        "lesson": "SGK Ngữ Văn 6 - Văn học dân gian Việt Nam",
    },
    {
        "word": "SÁNG TẠO TRI THỨC",
        "grade": 7,
        "hint": "Hành động phát minh, làm mới kiến thức khoa học và đời sống.",
        "lesson": "SGK Ngữ Văn 7 - Đọc hiểu văn bản thông tin",
    },
    {
        "word": "TRÍ TUỆ NHÂN TẠO",
        "grade": 8,
        "hint": "Công nghệ máy tính thông minh mô phỏng khả năng tư duy con người.",
        "lesson": "SGK Ngữ Văn & Tin học 8 - Bài đọc mở rộng",
    },
    {
        "word": "TRI ÂN THẦY CÔ",
        "grade": 9,
        "hint": "Tấm lòng ghi nhớ và kính trọng công ơn dạy dỗ của thầy cô giáo.",
        "lesson": "SGK Ngữ Văn 9 - Văn bản biểu cảm",
    },
]

ENGLISH_SGK_WORDS = [
    {
        "word": "FAMILY",
        "grade": 4,
        "hint": "A group of parents and their children living together in a home.",
        "lesson": "English Grade 4 - Unit 2: All About My Family",
    },
    {
        "word": "SCHOOL",
        "grade": 4,
        "hint": "A place where children go to be educated and learn new things.",
        "lesson": "English Grade 4 - Unit 1: Welcome to School",
    },
    {
        "word": "DOCTOR",
        "grade": 4,
        "hint": "A qualified person who treats sick or injured people.",
        "lesson": "English Grade 4 - Unit 5: Jobs and Professions",
    },
    {
        "word": "SUMMER",
        "grade": 5,
        "hint": "The warmest season of the year, between spring and autumn.",
        "lesson": "English Grade 5 - Unit 3: My Summer Holiday",
    },
    {
        "word": "COMMUNITY",
        "grade": 5,
        "hint": "A group of people living in the same place or having a particular characteristic in common.",
        "lesson": "English Grade 5 - Unit 7: Helping Our Community",
    },
    {
        "word": "ENVIRONMENT",
        "grade": 5,
        "hint": "The natural world, including land, water, air, plants, and animals.",
        "lesson": "English Grade 5 - Unit 9: Protecting Green Earth",
    },
    {
        "word": "TECHNOLOGY",
        "grade": 6,
        "hint": "Machinery and equipment developed from scientific knowledge.",
        "lesson": "English Grade 6 - Unit 10: Our Houses in the Future",
    },
    {
        "word": "BEAUTIFUL",
        "grade": 6,
        "hint": "Pleasing the senses or mind aesthetically.",
        "lesson": "English Grade 6 - Unit 4: My Neighbourhood",
    },
    {
        "word": "TRADITIONAL",
        "grade": 7,
        "hint": "Existing in or as part of a tradition; long-established.",
        "lesson": "English Grade 7 - Unit 5: Food and Drink",
    },
    {
        "word": "EDUCATION",
        "grade": 8,
        "hint": "The process of receiving or giving systematic instruction.",
        "lesson": "English Grade 8 - Unit 8: Shopping and Learning",
    },
    {
        "word": "INTELLIGENCE",
        "grade": 9,
        "hint": "The ability to acquire and apply knowledge and skills.",
        "lesson": "English Grade 9 - Unit 11: Electronic Devices",
    },
]


class WordScrambleService:
    @staticmethod
    def _scramble_letters(word: str) -> List[str]:
        """Scrambles characters in a word while preserving spaces."""
        clean_word = word.strip().upper()
        # Extract all non-space characters
        chars = [c for c in clean_word if c != " "]
        
        # Shuffle until it doesn't match original order
        shuffled = chars.copy()
        if len(shuffled) > 1:
            for _ in range(10):
                random.shuffle(shuffled)
                if "".join(shuffled) != "".join(chars):
                    break
        return shuffled

    @staticmethod
    def get_next_question(
        db: Session,
        student: User,
        subject: str = "Tiếng Việt",
        grade: Optional[int] = None,
    ) -> WordScrambleQuestionResponse:
        """
        Generates a word scramble game session tailored to student grade & subject.
        Applies trial guard enforcement for demo accounts.
        """
        TrialGuardService.check_and_increment_trial_usage(db, student, "game_vua_tu_vung")

        applied_grade = grade or student.grade or 5
        target_subject = "Tiếng Anh" if "anh" in subject.lower() or "english" in subject.lower() else "Tiếng Việt"

        # Select matching item list
        source_bank = ENGLISH_SGK_WORDS if target_subject == "Tiếng Anh" else VIETNAMESE_SGK_WORDS
        filtered = [item for item in source_bank if item["grade"] == applied_grade]
        if not filtered:
            filtered = source_bank  # fallback if exact grade empty

        selected_item = random.choice(filtered)
        target_word = selected_item["word"].upper()
        scrambled = WordScrambleService._scramble_letters(target_word)

        game_id = f"wsg_{uuid.uuid4().hex[:12]}"
        
        # Save session data
        GAME_SESSIONS[game_id] = {
            "game_id": game_id,
            "user_id": student.id,
            "target_word": target_word,
            "subject": target_subject,
            "grade": applied_grade,
            "hint_meaning": selected_item["hint"],
            "hint_sgk_lesson": selected_item["lesson"],
        }

        # First letter hint (ignoring spaces)
        clean_target = target_word.replace(" ", "")
        first_letter = clean_target[0] if clean_target else ""

        return WordScrambleQuestionResponse(
            game_id=game_id,
            subject=target_subject,
            grade=applied_grade,
            scrambled_letters=scrambled,
            letter_count=len(clean_target),
            hint_meaning=selected_item["hint"],
            hint_sgk_lesson=selected_item["lesson"],
            first_letter_hint=first_letter,
            english_audio_prompt=target_word if target_subject == "Tiếng Anh" else None,
            reward_diamonds=1,
        )

    @staticmethod
    def verify_answer(
        db: Session,
        student: User,
        game_id: str,
        user_answer: str,
        streak_count: int = 0,
    ) -> WordScrambleVerifyResponse:
        """
        Verifies student's built word, updates streak, and awards diamonds on milestones.
        """
        session = GAME_SESSIONS.get(game_id)
        if not session:
            # Fallback if session expired or restarted
            clean_ans = user_answer.strip().upper()
            return WordScrambleVerifyResponse(
                is_correct=False,
                target_word=clean_ans,
                user_answer=clean_ans,
                explanation="Phiên trò chơi đã hết hạn. Vui lòng bấm 'Từ Tiếp Theo' để bắt đầu câu mới.",
                current_streak=0,
                earned_diamonds=0,
                new_diamond_balance=student.diamond_balance or 0,
            )

        target = session["target_word"].strip().upper()
        # Strip all whitespace for robust comparison
        norm_target = target.replace(" ", "")
        norm_user = user_answer.strip().upper().replace(" ", "")

        is_correct = norm_user == norm_target

        earned_diamonds = 0
        new_balance = student.diamond_balance or 0
        new_streak = streak_count + 1 if is_correct else 0

        # Award 1 Diamond on every 5 consecutive correct streak milestones
        if is_correct and new_streak > 0 and new_streak % 5 == 0:
            reward_res = RewardService.award_ai_practice_diamonds(
                db, student.id, unit_id=f"word_scramble_streak_{new_streak}"
            )
            earned_diamonds = reward_res.get("awarded", 1)
            new_balance = reward_res.get("new_balance", new_balance)

        explanation = (
            f"🎉 Chính xác! Từ ghép chuẩn SGK: '{target}'. "
            f"Ghi nhớ: {session['hint_meaning']} ({session['hint_sgk_lesson']})."
            if is_correct
            else f"❌ Chưa chính xác! Đáp án đúng là '{target}'. "
            f"Nghĩa từ: {session['hint_meaning']}."
        )

        return WordScrambleVerifyResponse(
            is_correct=is_correct,
            target_word=target,
            user_answer=user_answer.strip().upper(),
            explanation=explanation,
            current_streak=new_streak,
            earned_diamonds=earned_diamonds,
            new_diamond_balance=new_balance,
        )
