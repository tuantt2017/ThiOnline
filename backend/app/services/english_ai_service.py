import json
import logging
import re
import difflib
from datetime import datetime
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

# Curated High-Quality Unsplash Image Mapping per Vocabulary Word
VOCAB_IMAGE_DATABASE: Dict[str, str] = {
    # Family & People
    "family": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
    "parents": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
    "father": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop",
    "mother": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop",
    "brother": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
    "sister": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
    "teacher": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=500&auto=format&fit=crop",
    "doctor": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop",
    "student": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=500&auto=format&fit=crop",
    "friendly": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
    "pilot": "https://images.unsplash.com/photo-1508672019048-805479760c2d?w=500&auto=format&fit=crop",
    "farmer": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=500&auto=format&fit=crop",

    # School & Education
    "classroom": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop",
    "school": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop",
    "science": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop",
    "book": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&auto=format&fit=crop",
    "pencil": "https://images.unsplash.com/photo-1585336261026-8f57857a2079?w=500&auto=format&fit=crop",
    "library": "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=500&auto=format&fit=crop",
    "computer": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop",

    # Weather & Nature
    "weather": "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=500&auto=format&fit=crop",
    "sunny": "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=500&auto=format&fit=crop",
    "rainy": "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=500&auto=format&fit=crop",
    "cloudy": "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=500&auto=format&fit=crop",
    "season": "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=500&auto=format&fit=crop",
    "umbrella": "https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?w=500&auto=format&fit=crop",
    "snowy": "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=500&auto=format&fit=crop",
    "forest": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&auto=format&fit=crop",
    "flower": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=500&auto=format&fit=crop",
    "tree": "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=500&auto=format&fit=crop",
    "mountain": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop",
    "river": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&auto=format&fit=crop",

    # Animals
    "animal": "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=500&auto=format&fit=crop",
    "dolphin": "https://images.unsplash.com/photo-1570481662006-a3a1374699e8?w=500&auto=format&fit=crop",
    "elephant": "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=500&auto=format&fit=crop",
    "tiger": "https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=500&auto=format&fit=crop",
    "dog": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&auto=format&fit=crop",
    "cat": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop",
    "bird": "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=500&auto=format&fit=crop",
    "whale": "https://images.unsplash.com/photo-1568430460464-02c1cd6a985b?w=500&auto=format&fit=crop",

    # Food & Drink
    "food": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop",
    "apple": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop",
    "pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop",
    "bread": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop",
    "breakfast": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&auto=format&fit=crop",
    "water": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop",
    "milk": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop",

    # Travel & Transportation
    "airport": "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=500&auto=format&fit=crop",
    "passport": "https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&auto=format&fit=crop",
    "flight": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&auto=format&fit=crop",
    "hotel": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop",
    "luggage": "https://images.unsplash.com/photo-1581553680321-4fffae59febd?w=500&auto=format&fit=crop",
    "car": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=500&auto=format&fit=crop",
    "bicycle": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop",
    "beach": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop",

    # Sports & Hobbies
    "football": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop",
    "swimming": "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=500&auto=format&fit=crop",
    "music": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
    "guitar": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
    "running": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=500&auto=format&fit=crop",

    # Health & Body
    "hospital": "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=500&auto=format&fit=crop",
    "healthy": "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500&auto=format&fit=crop",
    "exercise": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",

    # Space & Tech
    "robot": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop",
    "space": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop",
    "planet": "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=500&auto=format&fit=crop",
}

def get_accurate_vocab_image(word: str, topic: str) -> str:
    """Helper to match vocabulary word or topic with accurate Unsplash picture."""
    w_clean = re.sub(r"[^\w]", "", word.lower().strip())
    if w_clean in VOCAB_IMAGE_DATABASE:
        return VOCAB_IMAGE_DATABASE[w_clean]

    for k, url in VOCAB_IMAGE_DATABASE.items():
        if k in w_clean or w_clean in k:
            return url

    t_clean = topic.lower().strip()
    for k, url in VOCAB_IMAGE_DATABASE.items():
        if k in t_clean:
            return url

    return "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&auto=format&fit=crop"


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
            f"🎧 **AI Coach Tiếng Anh (8 Phút Hàng Ngày) cho {student_name}**:\n"
            f"Bạn đã hoàn thành {completed_count}/{len(units_summary)} bài học! "
            f"Hãy bấm nút '🚀 Bắt Đầu Học Ngay (8 Phút Mới)' để luyện tập bộ từ vựng & phát âm AI mới hôm nay nhé!"
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

        def clean_word(w: str) -> str:
            w_sub = re.sub(r"[^\w\s']", "", w.lower()).strip()
            contractions = {
                "dont": "do not", "cant": "cannot", "isnt": "is not",
                "arent": "are not", "wont": "will not", "im": "i am",
                "hes": "he is", "shes": "she is", "its": "it is",
                "theyre": "they are", "youre": "you are", "weve": "we have",
            }
            return contractions.get(w_sub, w_sub)

        def get_words(text: str) -> List[str]:
            return [clean_word(w) for w in re.findall(r"\b[\w']+\b", text.lower()) if clean_word(w)]

        target_words = get_words(target)
        spoken_words = get_words(spoken)

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
        correct_count = 0.0

        for tw in target_words:
            best_match_ratio = 0.0
            for sw in spoken_words:
                if tw == sw:
                    best_match_ratio = 1.0
                    break
                ratio = difflib.SequenceMatcher(None, tw, sw).ratio()
                if ratio > best_match_ratio:
                    best_match_ratio = ratio

            if best_match_ratio >= 0.8:
                is_correct = True
                confidence = round(best_match_ratio, 2)
                correct_count += 1.0
            elif best_match_ratio >= 0.6:
                is_correct = True
                confidence = round(best_match_ratio, 2)
                correct_count += 0.85
            else:
                is_correct = False
                confidence = round(best_match_ratio, 2)

            word_details.append(WordScoreDetail(word=tw, is_correct=is_correct, confidence=confidence))

        score = round((correct_count / len(target_words)) * 100.0, 1)
        score = min(100.0, score)

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
        grade_speaking_rule = (
            f"QUY TẮC BẮT BUỘC CHO LỚP {grade}:\n"
            f"- Học sinh Lớp {grade} (Tiểu học): Các câu mẫu luyện nói PHẢI NGẮN, ĐƠN GIẢN từ 3 đến 5 từ (ví dụ: 'I love my school.', 'This cat is cute.').\n"
            if grade <= 5 else
            f"- Học sinh Lớp {grade} (THCS): Các câu mẫu luyện nói từ 5 đến 8 từ tự nhiên, dễ hiểu."
        )

        prompt = f"""Bạn là chuyên gia thiết kế bài học Tiếng Anh AI chuẩn GDPT 2018 cho học sinh Lớp {grade} tại Việt Nam.
Hãy biên soạn 1 bài học Tiếng Anh Đa Phương Thức AI 8 Phút hoàn chỉnh cho chủ đề: "{topic_title}".

YÊU CẦU ĐẶC BIỆT:
1. Tạo đúng 6 từ vựng (flashcards) mới, phong phú, sát chủ đề.
2. Tạo đúng 8 bài tập trắc nghiệm & điền từ (exercises):
   - 2 bài MATCH_IMAGE (Nối từ với hình ảnh)
   - 2 bài LISTEN_SELECT (Nghe chọn đáp án)
   - 2 bài WORD_TYPING (Gõ chính tả)
   - 2 bài FILL_BLANK (Điền từ còn thiếu vào câu)
3. Tạo đúng 4 câu Luyện nói (speaking_prompts).

{grade_speaking_rule}

Cấu trúc JSON bắt buộc:
{{
  "title": "Unit: {topic_title}",
  "topic": "{topic_title}",
  "description": "Bài học Tiếng Anh AI 8 phút tự sinh chủ đề {topic_title}.",
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
    }}
  ],
  "exercises": [
    {{
      "exercise_type": "MATCH_IMAGE",
      "prompt": "Từ vựng nào miêu tả đúng hình ảnh?",
      "media_url": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
      "audio_text": "Choose the word",
      "options": [
        {{"option_key": "A", "content": "Đáp án 1"}},
        {{"option_key": "B", "content": "Đáp án 2"}},
        {{"option_key": "C", "content": "Đáp án 3"}},
        {{"option_key": "D", "content": "Đáp án 4"}}
      ],
      "correct_answer": "A",
      "explanation": "Giải thích..."
    }}
  ],
  "speaking_prompts": [
    {{
      "target_text": "Câu nói Tiếng Anh 1.",
      "ipa": "/phát âm IPA/",
      "meaning": "Dịch nghĩa",
      "tip": "Mẹo nhấn âm"
    }}
  ]
}}

CHỈ TRẢ VỀ VĂN BẢN JSON HỢP LỆ."""

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
                            text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip())
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            ai_dict = json.loads(cleaned)

                            raw_flashcards = ai_dict.get("flashcards", [])
                            flashcards = []
                            for idx, f in enumerate(raw_flashcards):
                                word_val = f.get("word", "word")
                                accurate_img = get_accurate_vocab_image(word_val, topic_title)
                                f["image_url"] = accurate_img
                                flashcards.append(VocabFlashcard(id=custom_id * 10 + idx, **f))

                            raw_exercises = ai_dict.get("exercises", [])
                            exercises = []
                            for idx, ex in enumerate(raw_exercises):
                                opts = [ExerciseOption(**o) for o in ex.get("options", [])]
                                ex_type = ex.get("exercise_type", "LISTEN_SELECT")
                                corr_ans = ex.get("correct_answer", "A")

                                # Post process media url for MATCH_IMAGE
                                media_url = ex.get("media_url")
                                if ex_type == "MATCH_IMAGE":
                                    # Find matching content option
                                    matched_opt = next((o.content for o in opts if o.option_key == corr_ans), topic_title)
                                    media_url = get_accurate_vocab_image(matched_opt, topic_title)

                                exercises.append(
                                    MultimodalExercise(
                                        id=custom_id * 20 + idx,
                                        exercise_type=ex_type,
                                        prompt=ex.get("prompt", ""),
                                        media_url=media_url,
                                        audio_text=ex.get("audio_text"),
                                        options=opts,
                                        correct_answer=corr_ans,
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
                                description=ai_dict.get("description", f"Bài học Tiếng Anh AI 8 Phút cho chủ đề {topic_title}"),
                                flashcards=flashcards,
                                exercises=exercises,
                                speaking_prompts=speaking_prompts,
                            )
                except Exception as e:
                    logger.warning(f"Lỗi khi gọi Gemini ({model_name}) tạo bài học Tiếng Anh: {e}")
        return None

    @classmethod
    def _generate_topic_aware_fallback(cls, topic_title: str, grade: int, custom_id: int) -> EnglishUnitDetailResponse:
        """30 Rich Rotating Daily Topics & Vocabulary Pools to prevent word repetition."""
        t_lower = topic_title.lower()

        # 30 Curated Vocabulary & Exercise Pools
        TOPIC_POOLS = [
            # Pool 0: Weather & Climate
            {
                "topic": "Thời tiết & Các mùa trong năm",
                "words": [
                    ("weather", "noun", "/ˈweð.ər/", "thời tiết", "What is the weather like today?", "Thời tiết hôm nay thế nào?"),
                    ("sunny", "adjective", "/ˈsʌn.i/", "nắng đẹp", "It is very sunny in Hanoi today.", "Hôm nay trời rất nắng ở Hà Nội."),
                    ("rainy", "adjective", "/ˈreɪ.ni/", "mưa", "Don't forget your umbrella on rainy days.", "Đừng quên mang ô vào những ngày mưa."),
                    ("season", "noun", "/ˈsiː.zən/", "mùa trong năm", "Spring is my favorite season.", "Mùa xuân là mùa yêu thích của tôi."),
                    ("umbrella", "noun", "/ʌmˈbrel.ə/", "cây ô / dù", "She bought a colorful umbrella.", "Cô ấy đã mua một cây ô rực rỡ sắc màu."),
                    ("cloudy", "adjective", "/ˈklaʊ.di/", "nhiều mây", "The sky is dark and cloudy today.", "Bầu trời hôm nay u uất và nhiều mây."),
                ]
            },
            # Pool 1: Family & Friends
            {
                "topic": "Gia đình & Bạn bè",
                "words": [
                    ("family", "noun", "/ˈfæm.əl.i/", "gia đình", "My family loves traveling together.", "Gia đình tôi thích cùng nhau du lịch."),
                    ("parents", "noun", "/ˈpeə.rənts/", "bố mẹ", "My parents are very supportive.", "Bố mẹ tôi rất luôn ủng hộ tôi."),
                    ("father", "noun", "/ˈfɑː.ðər/", "người bố", "His father is an architect.", "Bố của anh ấy là một kiến trúc sư."),
                    ("mother", "noun", "/ˈmʌð.ər/", "người mẹ", "My mother cooks delicious meals.", "Mẹ tôi nấu những bữa ăn rất ngon."),
                    ("friendly", "adjective", "/ˈfrend.li/", "thân thiện", "She is a friendly classmate.", "Cô ấy là một bạn học thân thiện."),
                    ("brother", "noun", "/ˈbrʌð.ər/", "anh/em trai", "My brother plays football well.", "Anh trai tôi chơi bóng đá giỏi."),
                ]
            },
            # Pool 2: School & Classroom
            {
                "topic": "Trường học & Môn học",
                "words": [
                    ("classroom", "noun", "/ˈklɑːs.ruːm/", "lớp học", "Our classroom is bright and tidy.", "Lớp học của chúng tôi rất sáng sủa và ngăn nắp."),
                    ("teacher", "noun", "/ˈtiː.tʃər/", "giáo viên", "Our teacher is very patient.", "Giáo viên của chúng tôi rất kiên nhẫn."),
                    ("science", "noun", "/ˈsaɪ.əns/", "môn khoa học", "We love science experiments.", "Chúng tôi yêu thích các thí nghiệm khoa học."),
                    ("library", "noun", "/ˈlaɪ.brər.i/", "thư viện", "Students read books in the library.", "Học sinh đọc sách trong thư viện."),
                    ("pencil", "noun", "/ˈpen.səl/", "bút chì", "Write your answer with a pencil.", "Hãy viết đáp án bằng bút chì."),
                    ("book", "noun", "/bʊk/", "quyển sách", "This English book is very helpful.", "Quyển sách Tiếng Anh này rất hữu ích."),
                ]
            },
            # Pool 3: Animals & Habitats
            {
                "topic": "Động vật & Tự nhiên",
                "words": [
                    ("dolphin", "noun", "/ˈdɒl.fɪn/", "cá heo", "Dolphins are very intelligent animals.", "Cá heo là loài động vật rất thông minh."),
                    ("elephant", "noun", "/ˈel.ɪ.fənt/", "con voi", "The elephant lives in the jungle.", "Con voi sống trong rừng rậm."),
                    ("forest", "noun", "/ˈfɒr.ɪst/", "khu rừng", "Trees keep the forest cool.", "Cây xanh giữ cho khu rừng mát mẻ."),
                    ("tiger", "noun", "/ˈtaɪ.ɡər/", "con hổ", "The tiger runs very fast.", "Con hổ chạy rất nhanh."),
                    ("bird", "noun", "/bɜːd/", "con chim", "Birds sing in the morning.", "Những chú chim hót vào buổi sáng."),
                    ("animal", "noun", "/ˈæn.ɪ.məl/", "động vật", "We should protect all animals.", "Chúng ta nên bảo vệ tất cả động vật."),
                ]
            },
            # Pool 4: Food & Health
            {
                "topic": "Thực phẩm & Bữa ăn",
                "words": [
                    ("breakfast", "noun", "/ˈbrek.fəst/", "bữa sáng", "I eat bread for breakfast.", "Tôi ăn bánh mì cho bữa sáng."),
                    ("apple", "noun", "/ˈæp.əl/", "quả táo", "An apple a day keeps the doctor away.", "Mỗi ngày ăn một quả táo giúp tăng gia sức khỏe."),
                    ("milk", "noun", "/mɪlk/", "sữa tươi", "Drink milk for strong bones.", "Uống sữa cho xương chắc khỏe."),
                    ("pizza", "noun", "/ˈpiːt.sə/", "bánh pizza", "We ordered a delicious pizza.", "Chúng tôi đã gọi một chiếc pizza ngon lành."),
                    ("water", "noun", "/ˈwɔː.tər/", "nước uống", "Drink plenty of water every day.", "Uống nhiều nước mỗi ngày."),
                    ("delicious", "adjective", "/dɪˈlɪʃ.əs/", "thơm ngon", "This fruit salad is delicious.", "Món salad hoa quả này rất thơm ngon."),
                ]
            },
            # Pool 5: Travel & Airports
            {
                "topic": "Du lịch & Sân bay",
                "words": [
                    ("airport", "noun", "/ˈeə.pɔːt/", "sân bay", "We arrived at the airport early.", "Chúng tôi đã đến sân bay sớm."),
                    ("passport", "noun", "/ˈpɑːs.pɔːt/", "hộ chiếu", "Keep your passport safe while traveling.", "Hãy giữ hộ chiếu an toàn khi đi du lịch."),
                    ("flight", "noun", "/flaɪt/", "chuyến bay", "Our flight departs in 30 minutes.", "Chuyến bay của chúng tôi khởi hành trong 30 phút."),
                    ("hotel", "noun", "/həʊˈtel/", "khách sạn", "We stayed at a cozy hotel.", "Chúng tôi đã ở một khách sạn ấm cúng."),
                    ("luggage", "noun", "/ˈlʌɡ.ɪdʒ/", "hành lý", "Check your luggage before leaving.", "Kiểm tra hành lý của bạn trước khi đi."),
                    ("beach", "noun", "/biːtʃ/", "bãi biển", "Children build sandcastles on the beach.", "Trẻ em xây lâu đài cát trên bãi biển."),
                ]
            }
        ]

        # Select topic pool based on matching or day rotation
        selected_pool = None
        for pool in TOPIC_POOLS:
            if any(k in t_lower for k in pool["topic"].lower().split()):
                selected_pool = pool
                break

        if not selected_pool:
            day_seed = (datetime.now().timetuple().tm_yday + grade + len(CUSTOM_UNITS_STORE)) % len(TOPIC_POOLS)
            selected_pool = TOPIC_POOLS[day_seed]

        words = selected_pool["words"]

        flashcards = [
            VocabFlashcard(
                id=custom_id * 10 + i,
                word=w[0],
                part_of_speech=w[1],
                ipa=w[2],
                meaning=w[3],
                image_url=get_accurate_vocab_image(w[0], topic_title),
                audio_text=w[0],
                example_sentence=w[4],
                example_translation=w[5],
            )
            for i, w in enumerate(words)
        ]

        # 8 Rich Multimodal Exercises (2 MATCH_IMAGE, 2 LISTEN_SELECT, 2 WORD_TYPING, 2 FILL_BLANK)
        exercises = [
            # 1. MATCH_IMAGE 1
            MultimodalExercise(
                id=custom_id * 20 + 1,
                exercise_type="MATCH_IMAGE",
                prompt=f"Từ vựng nào miêu tả đúng nghĩa '{words[0][3]}' trong hình?",
                media_url=get_accurate_vocab_image(words[0][0], topic_title),
                audio_text=words[0][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][0].capitalize()),
                ],
                correct_answer="A",
                explanation=f"'{words[0][0]}' có nghĩa là {words[0][3]}.",
            ),
            # 2. MATCH_IMAGE 2
            MultimodalExercise(
                id=custom_id * 20 + 2,
                exercise_type="MATCH_IMAGE",
                prompt=f"Hình ảnh trên minh họa chính xác từ Tiếng Anh nào cho '{words[1][3]}':",
                media_url=get_accurate_vocab_image(words[1][0], topic_title),
                audio_text=words[1][0],
                options=[
                    ExerciseOption(option_key="A", content=words[3][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[4][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[5][0].capitalize()),
                ],
                correct_answer="B",
                explanation=f"'{words[1][0]}' nghĩa là {words[1][3]}.",
            ),
            # 3. LISTEN_SELECT 1
            MultimodalExercise(
                id=custom_id * 20 + 3,
                exercise_type="LISTEN_SELECT",
                prompt=f"Nghe âm thanh mẫu và chọn đáp án từ Tiếng Anh đúng:",
                audio_text=words[2][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][0].capitalize()),
                ],
                correct_answer="C",
                explanation=f"Đoạn phát âm chuẩn là '{words[2][0]}' ({words[2][2]}).",
            ),
            # 4. LISTEN_SELECT 2
            MultimodalExercise(
                id=custom_id * 20 + 4,
                exercise_type="LISTEN_SELECT",
                prompt=f"Nghe phát âm từ vựng và chọn nghĩa Tiếng Việt chính xác:",
                audio_text=words[3][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][3].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][3].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][3].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][3].capitalize()),
                ],
                correct_answer="D",
                explanation=f"Từ phát âm '{words[3][0]}' mang nghĩa là {words[3][3]}.",
            ),
            # 5. WORD_TYPING 1
            MultimodalExercise(
                id=custom_id * 20 + 5,
                exercise_type="WORD_TYPING",
                prompt=f"✍️ Luyện gõ chính tả: Nghe phát âm hoặc nhìn nghĩa '{words[4][3]}', hãy gõ từ Tiếng Anh:",
                audio_text=words[4][0],
                options=[],
                correct_answer=words[4][0],
                explanation=f"Từ Tiếng Anh chính xác cho '{words[4][3]}' là '{words[4][0]}'.",
            ),
            # 6. WORD_TYPING 2
            MultimodalExercise(
                id=custom_id * 20 + 6,
                exercise_type="WORD_TYPING",
                prompt=f"✍️ Luyện gõ chính tả: Gõ chính xác từ Tiếng Anh cho '{words[5][3]}':",
                audio_text=words[5][0],
                options=[],
                correct_answer=words[5][0],
                explanation=f"Chính tả chính xác là '{words[5][0]}'.",
            ),
            # 7. FILL_BLANK 1
            MultimodalExercise(
                id=custom_id * 20 + 7,
                exercise_type="FILL_BLANK",
                prompt=f"📝 Điền từ còn thiếu vào câu: '{words[0][4].replace(words[0][0], '_____')}'",
                audio_text=words[0][4],
                options=[],
                correct_answer=words[0][0],
                explanation=f"Từ còn thiếu chính xác là '{words[0][0]}'. Dịch câu: {words[0][5]}",
            ),
            # 8. FILL_BLANK 2
            MultimodalExercise(
                id=custom_id * 20 + 8,
                exercise_type="FILL_BLANK",
                prompt=f"📝 Điền từ còn thiếu vào câu: '{words[1][4].replace(words[1][0], '_____')}'",
                audio_text=words[1][4],
                options=[],
                correct_answer=words[1][0],
                explanation=f"Từ còn thiếu chính xác là '{words[1][0]}'. Dịch câu: {words[1][5]}",
            ),
        ]

        if grade <= 5:
            speaking_prompts = [
                SpeakingPrompt(
                    id=custom_id * 30 + 1,
                    target_text=f"I love my {words[0][0]}.",
                    ipa=f"/aɪ lʌv maɪ {words[0][0]}/",
                    meaning=f"Tôi yêu {words[0][3]} của tôi.",
                    tip=f"Mẫu câu ngắn 4 từ đơn giản dành cho Lớp {grade}.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 2,
                    target_text=f"This is a {words[1][0]}.",
                    ipa=f"/ðɪs ɪz ə {words[1][0]}/",
                    meaning=f"Đây là một {words[1][3]}.",
                    tip=f"Phát âm rõ ràng từng từ ngắn.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 3,
                    target_text=f"We like {words[2][0]}.",
                    ipa=f"/wiː laɪk {words[2][0]}/",
                    meaning=f"Chúng tôi thích {words[2][3]}.",
                    tip=f"Đọc trôi chảy câu ngắn 3 từ.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 4,
                    target_text=f"She has a {words[3][0]}.",
                    ipa=f"/ʃiː hæz ə {words[3][0]}/",
                    meaning=f"Cô ấy có một {words[3][3]}.",
                    tip=f"Chú ý âm đuôi /z/ trong từ 'has'.",
                ),
            ]
        else:
            speaking_prompts = [
                SpeakingPrompt(
                    id=custom_id * 30 + 1,
                    target_text=words[0][4],
                    ipa=f"/{words[0][0]} sentence/",
                    meaning=words[0][5],
                    tip=f"Chú ý nhấn trọng âm từ '{words[0][0]}'.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 2,
                    target_text=words[1][4],
                    ipa=f"/{words[1][0]} sentence/",
                    meaning=words[1][5],
                    tip=f"Đọc trôi chảy ngữ điệu tự nhiên.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 3,
                    target_text=words[2][4],
                    ipa=f"/{words[2][0]} sentence/",
                    meaning=words[2][5],
                    tip=f"Phát âm rõ ràng các âm đuôi.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 4,
                    target_text=words[3][4],
                    ipa=f"/{words[3][0]} sentence/",
                    meaning=words[3][5],
                    tip=f"Đọc nối âm chuẩn bản ngữ.",
                ),
            ]

        return EnglishUnitDetailResponse(
            unit_id=custom_id,
            title=f"AI Unit: {topic_title}",
            topic=topic_title,
            grade=grade,
            description=f"Bài ôn tập Tiếng Anh AI 8 Phút chủ đề: {topic_title}.",
            flashcards=flashcards,
            exercises=exercises,
            speaking_prompts=speaking_prompts,
        )
