import json
import logging
import re
from typing import Dict, List, Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.english_learning import (
    EnglishRoadmapResponse,
    EnglishUnitDetailResponse,
    ExerciseOption,
    MultimodalExercise,
    PronunciationEvalRequest,
    PronunciationEvalResponse,
    SpeakingPrompt,
    TopicUnitSummary,
    VocabFlashcard,
    WordScoreDetail,
)
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)

# Global in-memory store for AI-generated custom units
CUSTOM_UNITS_STORE: Dict[int, EnglishUnitDetailResponse] = {}
# Global in-memory store for completed units (unit_id -> score)
COMPLETED_UNITS_STORE: Dict[int, float] = {2: 92.0}

# Sample SGK GDPT 2018 Curriculum Units for Grade 4 - 9
ENGLISH_CURRICULUM_UNITS = [
    {
        "id": 1,
        "title": "Unit 1: My Family & Friends",
        "topic": "Family & Relationships",
        "grade": 5,
        "description": "Học từ vựng và câu về gia đình, bạn bè, nghề nghiệp và hoạt động hàng ngày.",
        "flashcards": [
            {
                "id": 101,
                "word": "family",
                "part_of_speech": "noun",
                "ipa": "/ˈfæm.əl.i/",
                "meaning": "gia đình",
                "image_url": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
                "audio_text": "family",
                "example_sentence": "I love spending weekends with my family.",
                "example_translation": "Tôi thích dành thời gian cuối tuần bên gia đình."
            },
            {
                "id": 102,
                "word": "teacher",
                "part_of_speech": "noun",
                "ipa": "/ˈtiː.tʃər/",
                "meaning": "giáo viên",
                "image_url": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=500&auto=format&fit=crop",
                "audio_text": "teacher",
                "example_sentence": "My English teacher is very kind and patient.",
                "example_translation": "Giáo viên Tiếng Anh của tôi rất tốt bụng và kiên nhẫn."
            },
            {
                "id": 103,
                "word": "doctor",
                "part_of_speech": "noun",
                "ipa": "/ˈdɒk.tər/",
                "meaning": "bác sĩ",
                "image_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop",
                "audio_text": "doctor",
                "example_sentence": "His mother is a doctor at the city hospital.",
                "example_translation": "Mẹ của anh ấy là bác sĩ ở bệnh viện thành phố."
            },
            {
                "id": 104,
                "word": "friendly",
                "part_of_speech": "adjective",
                "ipa": "/ˈfrend.li/",
                "meaning": "thân thiện",
                "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
                "audio_text": "friendly",
                "example_sentence": "Nam is a very friendly classmate.",
                "example_translation": "Nam là một người bạn cùng lớp rất thân thiện."
            }
        ],
        "exercises": [
            {
                "id": 201,
                "exercise_type": "MATCH_IMAGE",
                "prompt": "Từ vựng nào miêu tả nghề nghiệp 'bác sĩ' trong bức tranh?",
                "media_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop",
                "audio_text": "Choose the word for doctor",
                "options": [
                    {"option_key": "A", "content": "Teacher"},
                    {"option_key": "B", "content": "Doctor"},
                    {"option_key": "C", "content": "Engineer"},
                    {"option_key": "D", "content": "Driver"}
                ],
                "correct_answer": "B",
                "explanation": "'Doctor' có nghĩa là bác sĩ, phù hợp với bức tranh bệnh viện."
            },
            {
                "id": 202,
                "exercise_type": "LISTEN_SELECT",
                "prompt": "Nghe phát âm từ vựng và chọn từ Tiếng Anh chính xác:",
                "audio_text": "family",
                "options": [
                    {"option_key": "A", "content": "Family"},
                    {"option_key": "B", "content": "Famous"},
                    {"option_key": "C", "content": "Farmer"},
                    {"option_key": "D", "content": "Father"}
                ],
                "correct_answer": "A",
                "explanation": "Đoạn âm thanh vừa phát từ 'family' (/ˈfæm.əl.i/)."
            },
            {
                "id": 203,
                "exercise_type": "WORD_TYPING",
                "prompt": "✍️ Luyện gõ chính tả: Nghe phát âm hoặc nhìn nghĩa 'bác sĩ', hãy gõ chính xác từ Tiếng Anh:",
                "audio_text": "doctor",
                "options": [],
                "correct_answer": "doctor",
                "explanation": "Từ Tiếng Anh chính xác cho 'bác sĩ' là 'doctor' (d-o-c-t-o-r)."
            },
            {
                "id": 204,
                "exercise_type": "FILL_BLANK",
                "prompt": "📝 Điền từ còn thiếu vào câu: 'Nam is a very _____ classmate.' (Nghĩa: Nam là một bạn học rất thân thiện)",
                "audio_text": "friendly",
                "options": [],
                "correct_answer": "friendly",
                "explanation": "Từ còn thiếu là 'friendly' (f-r-i-e-n-d-l-y)."
            }
        ],
        "speaking_prompts": [
            {
                "id": 301,
                "target_text": "My family lives in a beautiful house.",
                "ipa": "/maɪ ˈfæm.əl.i lɪvz ɪn ə ˈbjuː.tɪ.fəl haʊs/",
                "meaning": "Gia đình tôi sống trong một ngôi nhà đẹp.",
                "tip": "Chú ý phát âm rõ âm đuôi /z/ trong từ 'lives' và /s/ trong từ 'house'."
            },
            {
                "id": 302,
                "target_text": "She is a kind teacher.",
                "ipa": "/ʃiː ɪz ə kaɪnd ˈtiː.tʃər/",
                "meaning": "Cô ấy là một giáo viên tốt bụng.",
                "tip": "Đọc nối âm nhẹ giữa 'is' và 'a'."
            }
        ]
    },
    {
        "id": 2,
        "title": "Unit 2: School Life & Subjects",
        "topic": "School & Education",
        "grade": 5,
        "description": "Từ vựng về các môn học, dụng cụ học tập và các hoạt động tại trường học.",
        "flashcards": [
            {
                "id": 105,
                "word": "classroom",
                "part_of_speech": "noun",
                "ipa": "/ˈklɑːs.ruːm/",
                "meaning": "lớp học",
                "image_url": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop",
                "audio_text": "classroom",
                "example_sentence": "Our classroom is bright and clean.",
                "example_translation": "Lớp học của chúng tôi rất sáng sủa và sạch sẽ."
            },
            {
                "id": 106,
                "word": "science",
                "part_of_speech": "noun",
                "ipa": "/ˈsaɪ.əns/",
                "meaning": "môn khoa học",
                "image_url": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop",
                "audio_text": "science",
                "example_sentence": "We conduct fun experiments in science class.",
                "example_translation": "Chúng tôi làm các thí nghiệm thú vị trong giờ khoa học."
            }
        ],
        "exercises": [
            {
                "id": 204,
                "exercise_type": "LISTEN_SELECT",
                "prompt": "Nghe âm thanh và chọn môn học đúng:",
                "audio_text": "science",
                "options": [
                    {"option_key": "A", "content": "Math"},
                    {"option_key": "B", "content": "Science"},
                    {"option_key": "C", "content": "English"},
                    {"option_key": "D", "content": "History"}
                ],
                "correct_answer": "B",
                "explanation": "Đoạn phát âm là 'science' (/ˈsaɪ.əns/)."
            }
        ],
        "speaking_prompts": [
            {
                "id": 303,
                "target_text": "We study English every day.",
                "ipa": "/wiː ˈstʌd.i ˈɪŋ.ɡlɪʃ ˈev.ri deɪ/",
                "meaning": "Chúng tôi học Tiếng Anh mỗi ngày.",
                "tip": "Phát âm chuẩn âm /ʃ/ ở cuối từ 'English'."
            }
        ]
    }
]


class EnglishAIService:
    """Service to handle Multimodal English Learning Hub, interactive roadmap, & AI Speech Recognition Evaluation."""

    @classmethod
    def get_roadmap(cls, db: Session, student: User, subject: Optional[str] = None) -> EnglishRoadmapResponse:
        grade = student.grade if student.grade and 4 <= student.grade <= 9 else 5
        student_name = student.full_name or "Học sinh"

        units_summary: List[TopicUnitSummary] = []
        completed_count = 0

        for u in ENGLISH_CURRICULUM_UNITS:
            u_id = u["id"]
            is_comp = u_id in COMPLETED_UNITS_STORE
            if is_comp:
                completed_count += 1
            units_summary.append(
                TopicUnitSummary(
                    id=u_id,
                    title=u["title"],
                    topic=u["topic"],
                    vocab_count=len(u.get("flashcards", [])),
                    exercise_count=len(u.get("exercises", [])),
                    status="COMPLETED" if is_comp else "AVAILABLE",
                    score=COMPLETED_UNITS_STORE.get(u_id) if is_comp else None,
                )
            )

        # Include custom generated AI units from memory store
        for custom_unit in CUSTOM_UNITS_STORE.values():
            u_id = custom_unit.unit_id
            is_comp = u_id in COMPLETED_UNITS_STORE
            if is_comp:
                completed_count += 1
            units_summary.append(
                TopicUnitSummary(
                    id=u_id,
                    title=custom_unit.title,
                    topic=custom_unit.topic,
                    vocab_count=len(custom_unit.flashcards),
                    exercise_count=len(custom_unit.exercises),
                    status="COMPLETED" if is_comp else "AVAILABLE",
                    score=COMPLETED_UNITS_STORE.get(u_id) if is_comp else None,
                )
            )

        advice = (
            f"🎧 **AI Coach Tiếng Anh hôm nay cho {student_name}**:\n"
            f"Bạn đã hoàn thành {completed_count}/{len(units_summary)} bài học Tiếng Anh! "
            f"Hãy tiếp tục luyện tập bài học tiếp theo hoặc bấm tạo bài học AI theo chủ đề tự chọn nhé!"
        )

        return EnglishRoadmapResponse(
            grade=grade,
            student_name=student_name,
            overall_vocabulary_score=88.5,
            overall_listening_score=82.0,
            overall_speaking_score=78.0,
            overall_grammar_score=84.0,
            completed_units_count=completed_count,
            total_units_count=len(units_summary),
            units=units_summary,
            ai_daily_coaching_advice=advice,
        )

    @classmethod
    def complete_unit(cls, unit_id: int, score: float = 100.0) -> Dict[str, Any]:
        COMPLETED_UNITS_STORE[unit_id] = round(score, 1)
        logger.info(f"Đã chuyển trạng thái bài học Tiếng Anh {unit_id} thành COMPLETED ({score}%)")
        return {
            "message": f"Bài học {unit_id} đã chuyển trạng thái Đã hoàn thành ({score}%)",
            "unit_id": unit_id,
            "status": "COMPLETED",
            "score": score,
        }

    @classmethod
    def get_unit_detail(cls, unit_id: int) -> EnglishUnitDetailResponse:
        # Check custom generated units in memory store first
        if unit_id in CUSTOM_UNITS_STORE:
            return CUSTOM_UNITS_STORE[unit_id]

        unit = next((u for u in ENGLISH_CURRICULUM_UNITS if u["id"] == unit_id), None)
        if not unit:
            unit = ENGLISH_CURRICULUM_UNITS[0]

        flashcards = [VocabFlashcard(**f) for f in unit.get("flashcards", [])]
        exercises = []
        for ex in unit.get("exercises", []):
            opts = [ExerciseOption(**o) for o in ex.get("options", [])]
            exercises.append(
                MultimodalExercise(
                    id=ex["id"],
                    exercise_type=ex["exercise_type"],
                    prompt=ex["prompt"],
                    media_url=ex.get("media_url"),
                    audio_text=ex.get("audio_text"),
                    options=opts,
                    correct_answer=ex["correct_answer"],
                    explanation=ex["explanation"],
                )
            )

        return EnglishUnitDetailResponse(
            unit_id=unit["id"],
            title=unit["title"],
            topic=unit["topic"],
            grade=unit["grade"],
            description=unit["description"],
            flashcards=flashcards,
            exercises=exercises,
            speaking_prompts=unit.get("speaking_prompts", []),
        )

    @classmethod
    def evaluate_pronunciation(cls, req: PronunciationEvalRequest) -> PronunciationEvalResponse:
        target = req.target_text.strip()
        spoken = req.spoken_text.strip()

        # Clean words for comparison
        def clean_words(text: str) -> List[str]:
            return re.findall(r"\b[a-zA-Z]+\b", text.lower())

        target_words = clean_words(target)
        spoken_words = clean_words(spoken)

        if not target_words:
            return PronunciationEvalResponse(
                target_text=target,
                spoken_text=spoken,
                score=100.0,
                accuracy_level="EXCELLENT",
                feedback="Phát âm rất xuất sắc!",
                word_details=[],
            )

        word_details: List[WordScoreDetail] = []
        correct_count = 0

        for tw in target_words:
            is_match = tw in spoken_words
            if is_match:
                correct_count += 1
            word_details.append(WordScoreDetail(word=tw, is_correct=is_match, confidence=0.95 if is_match else 0.4))

        score = round((correct_count / len(target_words)) * 100.0, 1)

        if score >= 85.0:
            level = "EXCELLENT"
            feedback = f"🎉 Tuyệt vời! Bạn đã phát âm chính xác {score}% câu. Ngữ điệu rất tự nhiên!"
        elif score >= 60.0:
            level = "GOOD"
            feedback = f"👍 Khá tốt ({score}%). Chú ý nhấn đúng trọng âm và phát âm rõ các từ chưa chính xác nhé!"
        else:
            level = "NEED_PRACTICE"
            feedback = f"💪 Đạt {score}%. Hãy bấm nghe loa mẫu phát âm lại 2 lần và thử đọc lại từng từ chậm rãi nhé!"

        return PronunciationEvalResponse(
            target_text=target,
            spoken_text=spoken,
            score=score,
            accuracy_level=level,
            feedback=feedback,
            word_details=word_details,
        )

    @classmethod
    def generate_custom_unit(cls, req: Any) -> EnglishUnitDetailResponse:
        topic_title = req.topic.strip() if req.topic else "General Practice"
        grade = req.grade if 4 <= req.grade <= 9 else 5
        custom_id = 900 + len(CUSTOM_UNITS_STORE) + 1

        # Try Gemini AI Generation first
        ai_res = cls._generate_with_gemini(topic_title=topic_title, grade=grade, custom_id=custom_id)
        if not ai_res:
            ai_res = cls._generate_topic_aware_fallback(topic_title=topic_title, grade=grade, custom_id=custom_id)

        # Cache custom unit in memory store
        CUSTOM_UNITS_STORE[custom_id] = ai_res
        return ai_res

    @classmethod
    def _generate_with_gemini(cls, topic_title: str, grade: int, custom_id: int) -> Optional[EnglishUnitDetailResponse]:
        if not GeminiKnowledgeService.is_gemini_configured():
            return None

        api_key = settings.GEMINI_API_KEY.strip()
        prompt = f"""Bạn là chuyên gia thiết kế bài học Tiếng Anh AI chuẩn GDPT 2018 cho học sinh Lớp {grade} tại Việt Nam.
Hãy biên soạn 1 bài học Tiếng Anh Đa Phương Thức AI hoàn chỉnh cho chủ đề: "{topic_title}".

Cấu trúc JSON yêu cầu trả về:
{{
  "title": "Unit: {topic_title}",
  "topic": "{topic_title}",
  "description": "Bài học Tiếng Anh AI tự sinh theo yêu cầu chủ đề {topic_title}.",
  "flashcards": [
    {{
      "word": "từ Tiếng Anh 1",
      "part_of_speech": "noun",
      "ipa": "/phát âm IPA/",
      "meaning": "Nghĩa Tiếng Việt",
      "image_url": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
      "audio_text": "từ phát âm",
      "example_sentence": "Ví dụ câu Tiếng Anh",
      "example_translation": "Dịch nghĩa ví dụ Tiếng Việt"
    }},
    {{
      "word": "từ Tiếng Anh 2",
      "part_of_speech": "verb",
      "ipa": "/phát âm IPA/",
      "meaning": "Nghĩa Tiếng Việt",
      "image_url": "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=500&auto=format&fit=crop",
      "audio_text": "từ phát âm",
      "example_sentence": "Ví dụ câu Tiếng Anh",
      "example_translation": "Dịch nghĩa ví dụ Tiếng Việt"
    }},
    {{
      "word": "từ Tiếng Anh 3",
      "part_of_speech": "adjective",
      "ipa": "/phát âm IPA/",
      "meaning": "Nghĩa Tiếng Việt",
      "image_url": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&auto=format&fit=crop",
      "audio_text": "từ phát âm",
      "example_sentence": "Ví dụ câu Tiếng Anh",
      "example_translation": "Dịch nghĩa ví dụ Tiếng Việt"
    }},
    {{
      "word": "từ Tiếng Anh 4",
      "part_of_speech": "noun",
      "ipa": "/phát âm IPA/",
      "meaning": "Nghĩa Tiếng Việt",
      "image_url": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop",
      "audio_text": "từ phát âm",
      "example_sentence": "Ví dụ câu Tiếng Anh",
      "example_translation": "Dịch nghĩa ví dụ Tiếng Việt"
    }}
  ],
  "exercises": [
    {{
      "exercise_type": "MATCH_IMAGE",
      "prompt": "Từ vựng nào miêu tả đúng nội dung về chủ đề {topic_title}?",
      "media_url": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
      "audio_text": "Choose the correct word",
      "options": [
        {{"option_key": "A", "content": "Đáp án 1"}},
        {{"option_key": "B", "content": "Đáp án 2"}},
        {{"option_key": "C", "content": "Đáp án 3"}},
        {{"option_key": "D", "content": "Đáp án 4"}}
      ],
      "correct_answer": "A",
      "explanation": "Giải thích của AI..."
    }},
    {{
      "exercise_type": "LISTEN_SELECT",
      "prompt": "Nghe phát âm từ vựng và chọn đáp án chính xác:",
      "audio_text": "Từ vựng chính",
      "options": [
        {{"option_key": "A", "content": "Đáp án 1"}},
        {{"option_key": "B", "content": "Đáp án 2"}},
        {{"option_key": "C", "content": "Đáp án 3"}},
        {{"option_key": "D", "content": "Đáp án 4"}}
      ],
      "correct_answer": "B",
      "explanation": "Giải thích nghe..."
    }}
  ],
  "speaking_prompts": [
    {{
      "target_text": "Câu nói Tiếng Anh 1 liên quan đến {topic_title}.",
      "ipa": "/phát âm IPA toàn câu/",
      "meaning": "Dịch nghĩa câu 1",
      "tip": "Mẹo nhấn âm và nối từ"
    }},
    {{
      "target_text": "Câu nói Tiếng Anh 2 liên quan đến {topic_title}.",
      "ipa": "/phát âm IPA toàn câu/",
      "meaning": "Dịch nghĩa câu 2",
      "tip": "Mẹo nói chuẩn tự nhiên"
    }}
  ]
}}

CHỈ TRẢ VỀ DUY NHẤT VĂN BẢN JSON HỢP LỆ."""

        models_to_try = [
            settings.GEMINI_MODEL,
            "gemini-3.8-flash",
            "gemini-3.5-flash",
            "gemini-2.5-flash",
            "gemini-flash-latest",
        ]
        models_to_try = list(dict.fromkeys([m.strip() for m in models_to_try if m and m.strip()]))

        with httpx.Client(timeout=30.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "responseMimeType": "application/json",
                    },
                }
                try:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip())
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            ai_dict = json.loads(cleaned)

                            flashcards = [
                                VocabFlashcard(id=custom_id * 10 + idx, **f)
                                for idx, f in enumerate(ai_dict.get("flashcards", []))
                            ]
                            exercises = []
                            for idx, ex in enumerate(ai_dict.get("exercises", [])):
                                opts = [ExerciseOption(**o) for o in ex.get("options", [])]
                                exercises.append(
                                    MultimodalExercise(
                                        id=custom_id * 20 + idx,
                                        exercise_type=ex.get("exercise_type", "LISTEN_SELECT"),
                                        prompt=ex.get("prompt", ""),
                                        media_url=ex.get("media_url"),
                                        audio_text=ex.get("audio_text"),
                                        options=opts,
                                        correct_answer=ex.get("correct_answer", "A"),
                                        explanation=ex.get("explanation", ""),
                                    )
                                )
                            speaking_prompts = [
                                SpeakingPrompt(id=custom_id * 30 + idx, **sp)
                                for idx, sp in enumerate(ai_dict.get("speaking_prompts", []))
                            ]

                            return EnglishUnitDetailResponse(
                                unit_id=custom_id,
                                title=ai_dict.get("title", f"AI Unit: {topic_title}"),
                                topic=ai_dict.get("topic", topic_title),
                                grade=grade,
                                description=ai_dict.get("description", f"Bài học Tiếng Anh AI tự tạo cho chủ đề {topic_title}"),
                                flashcards=flashcards,
                                exercises=exercises,
                                speaking_prompts=speaking_prompts,
                            )
                except Exception as e:
                    logger.warning(f"Lỗi khi gọi Gemini ({model_name}) tạo bài học Tiếng Anh: {e}")
        return None

    @classmethod
    def _generate_topic_aware_fallback(cls, topic_title: str, grade: int, custom_id: int) -> EnglishUnitDetailResponse:
        t_lower = topic_title.lower()

        if "thời tiết" in t_lower or "weather" in t_lower:
            words = [
                ("weather", "noun", "/ˈweð.ər/", "thời tiết", "What is the weather like today?", "Thời tiết hôm nay thế nào?"),
                ("sunny", "adjective", "/ˈsʌn.i/", "nắng đẹp", "It is very sunny in Hanoi today.", "Hôm nay trời rất nắng ở Hà Nội."),
                ("rainy", "adjective", "/ˈreɪ.ni/", "mưa", "Don't forget your umbrella on rainy days.", "Đừng quên mang ô vào những ngày mưa."),
                ("season", "noun", "/ˈsiː.zən/", "mùa trong năm", "Spring is my favorite season.", "Mùa xuân là mùa yêu thích của tôi."),
            ]
        elif "thì" in t_lower or "grammar" in t_lower or "quá khứ" in t_lower:
            words = [
                ("visited", "verb", "/ˈvɪz.ɪ.tɪd/", "đã thăm (quá khứ)", "We visited Da Nang last summer.", "Chúng tôi đã đi thăm Đà Nẵng mùa hè trước."),
                ("yesterday", "adverb", "/ˈjes.tə.deɪ/", "ngày hôm qua", "I played football with friends yesterday.", "Tôi đã chơi bóng đá cùng bạn bè hôm qua."),
                ("always", "adverb", "/ˈɔːl.weɪz/", "luôn luôn", "She always wakes up at 6 AM.", "Cô ấy luôn thức dậy lúc 6 giờ sáng."),
                ("tomorrow", "noun", "/təˈmɒr.əʊ/", "ngày mai", "We will have an English test tomorrow.", "Chúng tôi sẽ có bài kiểm tra Tiếng Anh ngày mai."),
            ]
        elif "động vật" in t_lower or "animal" in t_lower:
            words = [
                ("dolphin", "noun", "/ˈdɒl.fɪn/", "cá heo", "Dolphins are smart sea animals.", "Cá heo là động vật biển thông minh."),
                ("elephant", "noun", "/ˈel.ɪ.fənt/", "con voi", "The elephant is the largest land animal.", "Con voi là động vật trên bờ lớn nhất."),
                ("forest", "noun", "/ˈfɒr.ɪst/", "khu rừng", "Many animals live peacefully in the forest.", "Nhiều loài động vật sống yên bình trong rừng."),
                ("protect", "verb", "/prəˈtekt/", "bảo vệ", "We should protect wild animals.", "Chúng ta nên bảo vệ động vật hoang dã."),
            ]
        elif "sân bay" in t_lower or "du lịch" in t_lower or "travel" in t_lower:
            words = [
                ("airport", "noun", "/ˈeə.pɔːt/", "sân bay", "We arrived at Noi Bai airport on time.", "Chúng tôi đã đến sân bay Nội Bài đúng giờ."),
                ("passport", "noun", "/ˈpɑːs.pɔːt/", "hộ chiếu", "Keep your passport in a safe place.", "Hãy giữ hộ chiếu ở nơi an toàn."),
                ("luggage", "noun", "/ˈlʌɡ.ɪdʒ/", "hành lý", "Please check your luggage before boarding.", "Vui lòng kiểm tra hành lý trước khi lên máy bay."),
                ("flight", "noun", "/flaɪt/", "chuyến bay", "Our flight to Da Nang departs at 9 AM.", "Chuyến bay đi Đà Nẵng cất cánh lúc 9 giờ sáng."),
            ]
        else:
            words = [
                ("practice", "verb", "/ˈpræk.tɪs/", "luyện tập", f"I practice English for {topic_title} every day.", f"Tôi luyện tập Tiếng Anh chủ đề {topic_title} mỗi ngày."),
                ("knowledge", "noun", "/ˈnɒl.ɪdʒ/", "kiến thức", f"Learning about {topic_title} gives us great knowledge.", f"Học về {topic_title} mang lại kiến thức tuyệt vời."),
                ("explore", "verb", "/ɪkˈsplɔːr/", "khám phá", f"Let's explore key vocabulary for {topic_title}.", f"Hãy cùng khám phá từ vựng chính cho {topic_title}."),
                ("confident", "adjective", "/ˈkɒn.fɪ.dənt/", "tự tin", f"I feel confident speaking about {topic_title}.", f"Tôi cảm thấy tự tin khi nói về {topic_title}."),
            ]

        flashcards = [
            VocabFlashcard(
                id=custom_id * 10 + i,
                word=w[0],
                part_of_speech=w[1],
                ipa=w[2],
                meaning=w[3],
                image_url=f"https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
                audio_text=w[0],
                example_sentence=w[4],
                example_translation=w[5],
            )
            for i, w in enumerate(words)
        ]

        exercises = [
            MultimodalExercise(
                id=custom_id * 20 + 1,
                exercise_type="MATCH_IMAGE",
                prompt=f"Từ vựng nào nghĩa là '{words[0][3]}' liên quan đến chủ đề '{topic_title}'?",
                media_url="https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
                audio_text=words[0][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][0].capitalize()),
                ],
                correct_answer="A",
                explanation=f"'{words[0][0]}' có nghĩa là {words[0][3]}, phù hợp nhất cho ngữ cảnh bài học.",
            ),
            MultimodalExercise(
                id=custom_id * 20 + 2,
                exercise_type="LISTEN_SELECT",
                prompt=f"Nghe phát âm từ vựng chủ đề '{topic_title}' và chọn đáp án chính xác:",
                audio_text=words[1][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][0].capitalize()),
                ],
                correct_answer="B",
                explanation=f"Đoạn phát âm chuẩn là '{words[1][0]}' ({words[1][2]}).",
            ),
            MultimodalExercise(
                id=custom_id * 20 + 3,
                exercise_type="WORD_TYPING",
                prompt=f"✍️ Luyện gõ chính tả: Nghe phát âm hoặc nhìn nghĩa '{words[2][3]}', hãy gõ chính xác từ Tiếng Anh:",
                audio_text=words[2][0],
                options=[],
                correct_answer=words[2][0],
                explanation=f"Từ Tiếng Anh chính xác cho '{words[2][3]}' là '{words[2][0]}'.",
            ),
            MultimodalExercise(
                id=custom_id * 20 + 4,
                exercise_type="FILL_BLANK",
                prompt=f"📝 Điền từ còn thiếu vào câu: '{words[3][4].replace(words[3][0], '_____')}'",
                audio_text=words[3][4],
                options=[],
                correct_answer=words[3][0],
                explanation=f"Từ còn thiếu chính xác là '{words[3][0]}'. Dịch cả câu: {words[3][5]}",
            ),
        ]

        speaking_prompts = [
            SpeakingPrompt(
                id=custom_id * 30 + 1,
                target_text=words[0][4],
                ipa=f"/{words[0][0]} sentence/",
                meaning=words[0][5],
                tip=f"Chú ý nhấn đúng trọng âm của từ '{words[0][0]}'.",
            ),
            SpeakingPrompt(
                id=custom_id * 30 + 2,
                target_text=words[1][4],
                ipa=f"/{words[1][0]} sentence/",
                meaning=words[1][5],
                tip=f"Đọc trôi chảy và nối âm chuẩn bản ngữ.",
            ),
        ]

        return EnglishUnitDetailResponse(
            unit_id=custom_id,
            title=f"AI Unit: {topic_title}",
            topic=topic_title,
            grade=grade,
            description=f"Bài ôn tập Tiếng Anh AI tự sinh theo yêu cầu chủ đề: {topic_title}.",
            flashcards=flashcards,
            exercises=exercises,
            speaking_prompts=speaking_prompts,
        )

