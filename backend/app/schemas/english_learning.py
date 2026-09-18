from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class VocabFlashcard(BaseModel):
    id: int
    word: str
    part_of_speech: str = "noun"  # noun, verb, adjective, etc.
    ipa: str  # e.g., /ˈæp.əl/
    meaning: str  # e.g., Quả táo
    image_url: str  # SVG or illustration URL
    audio_text: str  # Text to speak via TTS
    example_sentence: str
    example_translation: str


class ExerciseOption(BaseModel):
    option_key: str  # A, B, C, D
    content: str
    image_url: Optional[str] = None


class MultimodalExercise(BaseModel):
    id: int
    exercise_type: str  # MATCH_IMAGE, LISTEN_SELECT, SPELLING, CONTEXT_FILL
    prompt: str
    media_url: Optional[str] = None  # Image or audio prompt
    audio_text: Optional[str] = None  # Text for TTS if listening exercise
    options: List[ExerciseOption]
    correct_answer: str
    explanation: str


class SpeakingPrompt(BaseModel):
    id: int
    target_text: str
    ipa: str
    meaning: str
    tip: Optional[str] = None


class EnglishUnitDetailResponse(BaseModel):
    unit_id: int
    title: str
    topic: str
    grade: int
    description: str
    flashcards: List[VocabFlashcard]
    exercises: List[MultimodalExercise]
    speaking_prompts: List[SpeakingPrompt]  # List of sentences/words for pronunciation lab


class PronunciationEvalRequest(BaseModel):
    target_text: str
    spoken_text: str
    unit_id: Optional[int] = None


class WordScoreDetail(BaseModel):
    word: str
    is_correct: bool
    confidence: float = 1.0


class PronunciationEvalResponse(BaseModel):
    target_text: str
    spoken_text: str
    score: float  # 0 to 100%
    accuracy_level: str  # EXCELLENT, GOOD, NEED_PRACTICE
    feedback: str
    word_details: List[WordScoreDetail]


class TopicUnitSummary(BaseModel):
    id: int
    title: str
    topic: str
    vocab_count: int
    exercise_count: int
    status: str = "AVAILABLE"  # AVAILABLE, COMPLETED, LOCKED
    score: Optional[float] = None


class EnglishRoadmapResponse(BaseModel):
    grade: int
    student_name: str
    overall_vocabulary_score: float = 85.0
    overall_listening_score: float = 80.0
    overall_speaking_score: float = 75.0
    overall_grammar_score: float = 78.0
    completed_units_count: int = 2
    total_units_count: int = 8
    units: List[TopicUnitSummary]
    ai_daily_coaching_advice: str


class GenerateCustomEnglishUnitRequest(BaseModel):
    topic: str  # e.g., "Family & Friends", "Weather & Seasons", "Present Simple Tense"
    grade: int = 5
    vocab_count: int = 4
    exercise_count: int = 3


class CompleteUnitRequest(BaseModel):
    score: float = 100.0


