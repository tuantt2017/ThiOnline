import json
import random
import uuid
import logging
import re
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.word_scramble import (
    WordScrambleQuestionResponse,
    WordScrambleVerifyResponse,
)
from app.services.reward_service import RewardService
from app.services.trial_guard_service import TrialGuardService
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)

# In-Memory Cache Registry for active game sessions
GAME_SESSIONS: Dict[str, Dict[str, Any]] = {}

# Expanded SGK Curriculum Word Bank (GDPT Lớp 4 - 9)
VIETNAMESE_SGK_WORDS: List[Dict[str, Any]] = [
    # Lớp 4
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
        "lesson": "SGK Tiếng Việt 4 - Bài đọc mở rộng",
    },
    {
        "word": "KHIÊM TỐN",
        "grade": 4,
        "hint": "Phẩm chất tốt đẹp, không tự kiêu tự đại, luôn kính trọng người khác.",
        "lesson": "SGK Tiếng Việt 4 - Luyện từ và câu 'Đức tính khiêm tốn'",
    },
    {
        "word": "DŨNG CẢM",
        "grade": 4,
        "hint": "Không sợ nguy hiểm, khó khăn, sẵn sàng bảo vệ lẽ phải.",
        "lesson": "SGK Tiếng Việt 4 - Tập đọc 'Khí thế dũng cảm'",
    },
    {
        "word": "KIÊN TRÌ",
        "grade": 4,
        "hint": "Nhẫn nại, không nản lòng trước mọi thử thách để đạt mục tiêu.",
        "lesson": "SGK Tiếng Việt 4 - Bài 'Có công mài sắt'",
    },
    {
        "word": "KỶ LUẬT",
        "grade": 4,
        "hint": "Ý thức tuân thủ quy định chung của tập thể và nhà trường.",
        "lesson": "SGK Tiếng Việt 4 - Bài học nếp sống văn minh",
    },

    # Lớp 5
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
        "word": "BẢO VỆ MÔI TRƯỜNG",
        "grade": 5,
        "hint": "Hành động giữ gìn không khí, nguồn nước và cây xanh sạch đẹp.",
        "lesson": "SGK Tiếng Việt 5 - Bài 'Hành tinh xanh của chúng ta'",
    },
    {
        "word": "TÔN SƯ TRỌNG ĐẠO",
        "grade": 5,
        "hint": "Thành ngữ dạy học sinh kính trọng thầy cô và coi trọng đạo học.",
        "lesson": "SGK Tiếng Việt 5 - Chủ điểm 'Nghĩa thầy trò'",
    },
    {
        "word": "HỌC ĐI ĐÔI VỚI HÀNH",
        "grade": 5,
        "hint": "Quy tắc học tập: vừa tiếp thu lý thuyết vừa áp dụng thực hành.",
        "lesson": "SGK Tiếng Việt 5 - Luyện từ và câu",
    },
    {
        "word": "GIANG SƠN CẨM VÓC",
        "grade": 5,
        "hint": "Hình ảnh ẩn dụ vẻ đẹp tươi đẹp, hùng vĩ của đất nước Việt Nam.",
        "lesson": "SGK Tiếng Việt 5 - Tập đọc 'Đất nước'",
    },

    # Lớp 6
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
        "word": "VĂN HÓA DÂN TỘC",
        "grade": 6,
        "hint": "Bản sắc tinh thần, phong tục tập quán đặc trưng của đất nước.",
        "lesson": "SGK Ngữ Văn 6 - Bài 'Thánh Gióng & Sơn Tinh Thủy Tinh'",
    },
    {
        "word": "LÒNG TỰ HÀO",
        "grade": 6,
        "hint": "Cảm xúc hãnh diện về lịch sử dựng nước và giữ nước anh hùng.",
        "lesson": "SGK Ngữ Văn 6 - Truyền thuyết Lạc Long Quân",
    },

    # Lớp 7
    {
        "word": "SÁNG TẠO TRI THỨC",
        "grade": 7,
        "hint": "Hành động phát minh, làm mới kiến thức khoa học và đời sống.",
        "lesson": "SGK Ngữ Văn 7 - Đọc hiểu văn bản thông tin",
    },
    {
        "word": "BẢO TỒN DI SẢN",
        "grade": 7,
        "hint": "Hoạt động gìn giữ danh lam thắng cảnh và di tích lịch sử.",
        "lesson": "SGK Ngữ Văn 7 - Văn bản 'Ca Huế trên sông Hương'",
    },
    {
        "word": "TINH THẦN YÊU NƯỚC",
        "grade": 7,
        "hint": "Lòng nồng nàn yêu quê hương, đất nước của nhân dân ta.",
        "lesson": "SGK Ngữ Văn 7 - Văn bản 'Tinh thần yêu nước của nhân dân ta'",
    },

    # Lớp 8
    {
        "word": "TRÍ TUỆ NHÂN TẠO",
        "grade": 8,
        "hint": "Công nghệ máy tính thông minh mô phỏng khả năng tư duy con người.",
        "lesson": "SGK Ngữ Văn & Tin học 8 - Bài đọc mở rộng",
    },
    {
        "word": "TRÁCH NHIỆM XÃ HỘI",
        "grade": 8,
        "hint": "Ý thức đóng góp công sức xây dựng cộng đồng văn minh, giàu đẹp.",
        "lesson": "SGK Ngữ Văn 8 - Văn bản nghị luận",
    },
    {
        "word": "ĐỔI MỚI SÁNG TẠO",
        "grade": 8,
        "hint": "Tinh thần suy nghĩ khác biệt, ứng dụng công nghệ hiện đại vào thực tiễn.",
        "lesson": "SGK Ngữ Văn 8 - Chủ điểm 'Thế giới tương lai'",
    },

    # Lớp 9
    {
        "word": "TRI ÂN THẦY CÔ",
        "grade": 9,
        "hint": "Tấm lòng ghi nhớ và kính trọng công ơn dạy dỗ của thầy cô giáo.",
        "lesson": "SGK Ngữ Văn 9 - Văn bản biểu cảm",
    },
    {
        "word": "KHẢO THÍ TRỰC TUYẾN",
        "grade": 9,
        "hint": "Phương pháp kiểm tra, đánh giá năng lực học sinh trên nền tảng kỹ thuật số.",
        "lesson": "SGK Ngữ Văn & Tin học 9 - Ứng dụng số hóa",
    },
    {
        "word": "HỘI NHẬP QUỐC TẾ",
        "grade": 9,
        "hint": "Mở rộng giao lưu văn hóa, kinh tế và khoa học với các quốc gia trên thế giới.",
        "lesson": "SGK Ngữ Văn 9 - Văn bản 'Bàn về đọc sách & Hội nhập'",
    },
]

ENGLISH_SGK_WORDS: List[Dict[str, Any]] = [
    # Grade 4
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
        "word": "TEACHER",
        "grade": 4,
        "hint": "A person who helps students to acquire knowledge and competence.",
        "lesson": "English Grade 4 - Unit 5: People at Work",
    },
    {
        "word": "PLAYGROUND",
        "grade": 4,
        "hint": "An outdoor area provided for children to play in at school.",
        "lesson": "English Grade 4 - Unit 3: School Activities",
    },

    # Grade 5
    {
        "word": "SUMMER",
        "grade": 5,
        "hint": "The warmest season of the year, between spring and autumn.",
        "lesson": "English Grade 5 - Unit 3: My Summer Holiday",
    },
    {
        "word": "COMMUNITY",
        "grade": 5,
        "hint": "A group of people living in the same place sharing common interests.",
        "lesson": "English Grade 5 - Unit 7: Helping Our Community",
    },
    {
        "word": "ENVIRONMENT",
        "grade": 5,
        "hint": "The natural world including land, water, air, plants, and animals.",
        "lesson": "English Grade 5 - Unit 9: Protecting Green Earth",
    },
    {
        "word": "CLASSROOM",
        "grade": 5,
        "hint": "A room in a school where lessons take place.",
        "lesson": "English Grade 5 - Unit 2: School Facilities",
    },
    {
        "word": "IMPORTANT",
        "grade": 5,
        "hint": "Of great significance or value; having high priority.",
        "lesson": "English Grade 5 - Unit 6: Good Habits",
    },

    # Grade 6
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
        "word": "FRIENDSHIP",
        "grade": 6,
        "hint": "The emotion or relationship between friends.",
        "lesson": "English Grade 6 - Unit 3: My Friends",
    },
    {
        "word": "GARDENING",
        "grade": 6,
        "hint": "The activity of tending and cultivating a garden.",
        "lesson": "English Grade 6 - Unit 1: My Hobbies",
    },

    # Grade 7
    {
        "word": "TRADITIONAL",
        "grade": 7,
        "hint": "Existing in or as part of a tradition; long-established.",
        "lesson": "English Grade 7 - Unit 5: Food and Drink",
    },
    {
        "word": "VOLUNTEER",
        "grade": 7,
        "hint": "A person who freely offers to take part in an enterprise or undertaking.",
        "lesson": "English Grade 7 - Unit 3: Community Service",
    },
    {
        "word": "CELEBRATION",
        "grade": 7,
        "hint": "The action of marking one's pleasure at an important occasion.",
        "lesson": "English Grade 7 - Unit 9: Festivals Around the World",
    },

    # Grade 8
    {
        "word": "EDUCATION",
        "grade": 8,
        "hint": "The process of receiving or giving systematic instruction.",
        "lesson": "English Grade 8 - Unit 8: Shopping and Learning",
    },
    {
        "word": "ATMOSPHERE",
        "grade": 8,
        "hint": "The envelope of gases surrounding the earth or another planet.",
        "lesson": "English Grade 8 - Unit 11: Science and Technology",
    },
    {
        "word": "GENERATION",
        "grade": 8,
        "hint": "All of the people born and living at about the same time.",
        "lesson": "English Grade 8 - Unit 4: Custom and Tradition",
    },

    # Grade 9
    {
        "word": "INTELLIGENCE",
        "grade": 9,
        "hint": "The ability to acquire and apply knowledge and skills.",
        "lesson": "English Grade 9 - Unit 11: Electronic Devices",
    },
    {
        "word": "INDEPENDENCE",
        "grade": 9,
        "hint": "The fact or state of being independent and self-governing.",
        "lesson": "English Grade 9 - Unit 6: Vietnam Then and Now",
    },
    {
        "word": "VOCABULARY",
        "grade": 9,
        "hint": "A body of words used in a particular language or study.",
        "lesson": "English Grade 9 - Unit 9: English in the World",
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
            for _ in range(12):
                random.shuffle(shuffled)
                if "".join(shuffled) != "".join(chars):
                    break
        return shuffled

    @classmethod
    def _generate_word_with_gemini(
        cls, subject: str, grade: int
    ) -> Optional[Dict[str, Any]]:
        """
        Calls Google Gemini AI to dynamically generate a new SGK word/phrase item
        for Grade 4-9 curriculum, expanding the word bank dynamically.
        """
        if not GeminiKnowledgeService.is_gemini_configured():
            return None

        api_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
        if not api_key:
            return None

        is_english = "anh" in subject.lower() or "english" in subject.lower()
        sub_name = "Tiếng Anh" if is_english else "Tiếng Việt"

        prompt = f"""Bạn là chuyên gia biên soạn chương trình Sách Giáo Khoa (SGK GDPT 2018) Việt Nam.
Hãy sinh ngẫu nhiên 01 từ ghép hoặc cụm từ có nghĩa thuộc môn **{sub_name} Lớp {grade}** để tạo trò chơi xếp chữ (Word Scramble).

YÊU CẦU:
1. Môn Tiếng Việt: Sinh từ ghép (2-4 tiếng), từ láy có nghĩa hoặc thành ngữ ngắn gọn (ví dụ: 'TRUNG THỰC', 'YÊU THƯƠNG', 'BẢO VỆ MÔI TRƯỜNG', 'UỐNG NƯỚC NHỚ NGUỒN').
2. Môn Tiếng Anh: Sinh từ vựng / cụm từ Tiếng Anh SGK Lớp {grade} (ví dụ: 'ENVIRONMENT', 'BEAUTIFUL', 'COMMUNITY', 'TECHNOLOGY').
3. Từ xuất bằng chữ IN HOA. Định nghĩa (`hint`) ngắn gọn (1 câu), sinh động phù hợp học sinh Lớp {grade}. `lesson` trích dẫn Tên chủ điểm / bài học SGK Lớp {grade}.

YÊU CẦU ĐẦU RA JSON CHÍNH XÁC:
{{
  "word": "TỪ_IN_HOA",
  "hint": "Định nghĩa ngắn gọn 1 câu...",
  "lesson": "SGK {sub_name} {grade} - Tên bài học / chủ đề"
}}
"""
        models_to_try = [
            settings.GEMINI_MODEL,
            "gemini-3.8-flash",
            "gemini-3.5-flash",
            "gemini-2.5-flash",
            "gemini-flash-latest",
        ]
        models_to_try = list(dict.fromkeys([m.strip() for m in models_to_try if m and m.strip()]))

        with httpx.Client(timeout=10.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.85,
                        "responseMimeType": "application/json",
                    },
                }
                try:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text_content = candidates[0]["content"]["parts"][0]["text"]
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip())
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            parsed = json.loads(cleaned)

                            word_val = str(parsed.get("word", "")).strip().upper()
                            hint_val = str(parsed.get("hint", "")).strip()
                            lesson_val = str(parsed.get("lesson", "")).strip()

                            if word_val and hint_val:
                                item = {
                                    "word": word_val,
                                    "grade": grade,
                                    "hint": hint_val,
                                    "lesson": lesson_val or f"SGK {sub_name} Lớp {grade}",
                                }
                                # Cache generated item into memory bank so pool grows dynamically
                                target_bank = ENGLISH_SGK_WORDS if is_english else VIETNAMESE_SGK_WORDS
                                if not any(x["word"] == word_val for x in target_bank):
                                    target_bank.append(item)
                                return item
                except Exception as exc:
                    logger.warning(f"Mô hình AI Gemini {model_name} khi tạo từ vựng gặp lỗi: {exc}")

        return None

    @classmethod
    def get_next_question(
        cls,
        db: Session,
        student: User,
        subject: str = "Tiếng Việt",
        grade: Optional[int] = None,
    ) -> WordScrambleQuestionResponse:
        """
        Generates a word scramble game session tailored to student grade & subject.
        Uses AI Gemini expansion for infinite dynamic word variety.
        Applies trial guard enforcement for demo accounts.
        """
        TrialGuardService.check_and_increment_trial_usage(db, student, "game_vua_tu_vung")

        applied_grade = grade or student.grade or 5
        target_subject = "Tiếng Anh" if "anh" in subject.lower() or "english" in subject.lower() else "Tiếng Việt"

        # Try generating a fresh word with Gemini AI with 50% probability (or if pool is small)
        selected_item = None
        if random.random() < 0.5:
            selected_item = cls._generate_word_with_gemini(target_subject, applied_grade)

        # Fallback to expanded curated bank
        if not selected_item:
            source_bank = ENGLISH_SGK_WORDS if target_subject == "Tiếng Anh" else VIETNAMESE_SGK_WORDS
            filtered = [item for item in source_bank if item["grade"] == applied_grade]
            if not filtered:
                filtered = source_bank  # fallback if exact grade empty
            selected_item = random.choice(filtered)

        target_word = selected_item["word"].upper()
        scrambled = cls._scramble_letters(target_word)

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

    @classmethod
    def verify_answer(
        cls,
        db: Session,
        student: User,
        game_id: str,
        user_answer: str,
        streak_count: int = 0,
    ) -> WordScrambleVerifyResponse:
        """
        Verifies student's built word, updates streak, and awards diamonds on 10-consecutive streak milestones.
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
        target_subject = session.get("subject", "Môn học")
        # Strip all whitespace for robust comparison
        norm_target = target.replace(" ", "")
        norm_user = user_answer.strip().upper().replace(" ", "")

        is_correct = norm_user == norm_target

        earned_diamonds = 0
        new_balance = student.diamond_balance or 0
        new_streak = streak_count + 1 if is_correct else 0

        # RULE UPDATE: Award 1 Diamond only on every 10 consecutive correct streak milestone per subject
        # DAILY CAP: Maximum 2 diamonds per day from Word Scramble game
        if is_correct and new_streak > 0 and new_streak % 10 == 0:
            reward_res = RewardService.award_word_scramble_diamonds(
                db,
                student.id,
                reference_id=f"streak_{target_subject}_{new_streak}",
                max_daily_diamonds=2,
            )
            earned_diamonds = reward_res.get("awarded", 0)
            new_balance = reward_res.get("new_balance", new_balance)

        explanation = (
            f"🎉 Chính xác! Từ ghép chuẩn SGK: '{target}'. "
            f"Ghi nhớ: {session['hint_meaning']} ({session['hint_sgk_lesson']})."
            if is_correct
            else f"❌ Chưa chính xác! Đáp án đúng là '{target}'. "
            f"Nghĩa từ: {session['hint_meaning']}."
        )

        if is_correct and new_streak > 0 and new_streak % 10 == 0 and earned_diamonds == 0:
            explanation += " (ℹ️ Bạn đã đạt hạn mức nhận tối đa 2 💎 Kim Cương/ngày từ trò chơi Vua Từ Vựng. Hãy quay lại thử sức vào ngày mai nhé!)"


        return WordScrambleVerifyResponse(
            is_correct=is_correct,
            target_word=target,
            user_answer=user_answer.strip().upper(),
            explanation=explanation,
            current_streak=new_streak,
            earned_diamonds=earned_diamonds,
            new_diamond_balance=new_balance,
        )
