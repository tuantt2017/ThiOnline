export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  grade?: number | null;
  diamond_balance?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'offline';
  database: string;
  environment: string;
}

export const DocumentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DocumentType = {
  PDF: 'PDF',
  DOCX: 'DOCX',
  TXT: 'TXT',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];
export type KnowledgeNodeType =
  | 'SUBJECT'
  | 'GRADE'
  | 'BOOK'
  | 'CHAPTER'
  | 'LESSON'
  | 'TOPIC'
  | 'CONCEPT'
  | 'LEARNING_OBJECTIVE';

export interface Document {
  id: number;
  title: string;
  filename: string;
  file_type: DocumentType;
  file_size: number;
  subject: string;
  grade: number;
  book_series?: string | null;
  status: DocumentStatus;
  error_message?: string | null;
  total_pages?: number | null;
  chunk_count: number;
  extracted_metadata?: Record<string, any> | null;
  uploaded_by_id: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  char_count: number;
  page_number?: number | null;
  chapter?: string | null;
  lesson?: string | null;
  topic?: string | null;
  concept?: string | null;
  learning_objective?: string | null;
  chunk_metadata?: Record<string, any> | null;
  created_at: string;
}

export interface PaginatedChunks {
  items: DocumentChunk[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface KnowledgeNode {
  id: number;
  node_type: KnowledgeNodeType;
  title: string;
  description?: string | null;
  order_index: number;
  properties?: Record<string, any> | null;
  children: KnowledgeNode[];
}

export interface KnowledgeMapTree {
  document_id: number;
  title: string;
  subject: string;
  grade: number;
  book_series?: string | null;
  tree: KnowledgeNode[];
}

export interface KnowledgeOverviewItem {
  document_id: number;
  title: string;
  subject: string;
  grade: number;
  book_series?: string | null;
  tree: KnowledgeNode[];
}

export const QuestionType = {
  MULTIPLE_CHOICE_SINGLE: 'MULTIPLE_CHOICE_SINGLE',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const QuestionDifficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;
export type QuestionDifficulty = (typeof QuestionDifficulty)[keyof typeof QuestionDifficulty];

export const QuestionStatus = {
  DRAFT: 'DRAFT',
  REVIEW: 'REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export const QuestionSource = {
  MANUAL: 'MANUAL',
  WORD_IMPORT: 'WORD_IMPORT',
  AI_GENERATED: 'AI_GENERATED',
} as const;
export type QuestionSource = (typeof QuestionSource)[keyof typeof QuestionSource];

export interface QuestionOption {
  id?: number;
  question_id?: number;
  option_key: string;
  content: string;
  is_correct: boolean;
  explanation?: string | null;
  order_index: number;
}

export interface Question {
  id: number;
  content: string;
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  source: QuestionSource;
  subject: string;
  grade: number;
  chapter?: string | null;
  lesson?: string | null;
  topic?: string | null;
  learning_objective?: string | null;
  explanation?: string | null;
  knowledge_node_id?: number | null;
  document_id?: number | null;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  options: QuestionOption[];
}

export interface QuestionListResponse {
  items: Question[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface QuestionStats {
  total: number;
  by_status: Record<string, number>;
  by_difficulty: Record<string, number>;
  by_grade: Record<string, number>;
  by_subject: Record<string, number>;
}

export interface QuestionCreateInput {
  content: string;
  question_type?: QuestionType;
  difficulty: QuestionDifficulty;
  status?: QuestionStatus;
  source?: QuestionSource;
  subject: string;
  grade: number;
  chapter?: string;
  lesson?: string;
  topic?: string;
  learning_objective?: string;
  explanation?: string;
  options: {
    option_key: string;
    content: string;
    is_correct: boolean;
    explanation?: string;
    order_index: number;
  }[];
}

export interface ParsedQuestionItem {
  question_index: number;
  raw_header: string;
  content: string;
  options: QuestionOption[];
  correct_option?: string | null;
  explanation?: string | null;
  is_valid: boolean;
  error_message?: string | null;
}

export interface WordImportResult {
  total_detected: number;
  valid_count: number;
  invalid_count: number;
  imported_count: number;
  questions: ParsedQuestionItem[];
  errors: string[];
}

export interface DocumentSectionItem {
  title: string;
  lessons: string[];
}

export interface DocumentSectionsResponse {
  document_id: number;
  title: string;
  subject: string;
  grade: number;
  book_series?: string | null;
  chapters: DocumentSectionItem[];
  all_chapters: string[];
  all_topics: string[];
}

export interface AiQuestionGenerateRequest {
  subject: string;
  grade: number;
  document_id?: number | null;
  chapter?: string;
  chapters?: string[];
  lesson?: string;
  topic?: string;
  topics?: string[];
  count: number;
  difficulty_distribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  use_web_context: boolean;
  save_as_draft: boolean;
}

export interface AiGeneratedOption {
  key: string;
  text: string;
  is_correct: boolean;
}

export interface AiGeneratedQuestionItem {
  question_text: string;
  options: AiGeneratedOption[];
  difficulty: QuestionDifficulty;
  topic?: string | null;
  learning_objective?: string | null;
  explanation: string;
  knowledge_source?: {
    document_id?: number | null;
    document_title?: string | null;
    chapter?: string | null;
    lesson?: string | null;
    page?: number | null;
  } | null;
  context_source?: {
    type: string;
    title?: string | null;
    url?: string | null;
    summary?: string | null;
  } | null;
  is_valid: boolean;
  validation_errors: string[];
  created_question_id?: number | null;
}

export interface AiQuestionGenerateResponse {
  total_generated: number;
  valid_count: number;
  invalid_count: number;
  saved_count: number;
  questions: AiGeneratedQuestionItem[];
  errors: string[];
}

export const ExamStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ExamStatus = (typeof ExamStatus)[keyof typeof ExamStatus];

export const AttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  TIMED_OUT: 'TIMED_OUT',
} as const;
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export interface ExamQuestionResponse {
  id: number;
  exam_id: number;
  question_id: number;
  order_index: number;
  points: number;
  question?: Question;
}

export interface Exam {
  id: number;
  title: string;
  description?: string | null;
  subject: string;
  grade: number;
  duration_minutes: number;
  total_questions: number;
  total_points: number;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  start_time?: string | null;
  end_time?: string | null;
  status: ExamStatus;
  created_by_id: number;
  created_by_name?: string | null;
  created_by_role?: string | null;
  created_at: string;
  updated_at: string;
  exam_questions?: ExamQuestionResponse[];
}

export interface ExamListResponse {
  items: Exam[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ExamCreateInput {
  title: string;
  description?: string;
  subject: string;
  grade: number;
  duration_minutes: number;
  total_points: number;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  start_time?: string;
  end_time?: string;
  question_ids?: number[];
  assigned_student_ids?: number[];
  assigned_grade?: number;
}

export interface StudentOptionTakeResponse {
  option_key: string;
  content: string;
  order_index: number;
}

export interface StudentQuestionTakeResponse {
  id: number;
  content: string;
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  subject: string;
  grade: number;
  order_index: number;
  points: number;
  options: StudentOptionTakeResponse[];
}

export interface StudentExamTakeResponse {
  attempt_id: number;
  exam_id: number;
  title: string;
  subject: string;
  grade: number;
  duration_minutes: number;
  started_at: string;
  deadline_at: string;
  remaining_seconds: number;
  status: AttemptStatus;
  questions: StudentQuestionTakeResponse[];
  saved_answers: Record<number, string>;
}

export interface ExamAttemptResultResponse {
  attempt_id: number;
  exam_id: number;
  exam_title: string;
  status: AttemptStatus;
  score: number;
  percentage: number;
  correct_count: number;
  total_count: number;
  passing_score: number;
  is_passed: boolean;
  diamonds_awarded?: number;
  started_at: string;
  submitted_at?: string | null;
  detailed_answers: {
    question_id: number;
    question_text: string;
    selected_option_key?: string | null;
    correct_option_key?: string | null;
    is_correct: boolean;
    points_earned: number;
    explanation?: string | null;
    options: {
      option_key: string;
      content: string;
      is_correct: boolean;
    }[];
  }[];
}

export interface AttemptAnswerResponse {
  message: string;
  attempt_id: number;
  question_id: number;
  selected_option_key?: string | null;
}

export interface StudentAttemptReport {

  attempt_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  status: AttemptStatus;
  score: number;
  percentage: number;
  correct_count: number;
  total_count: number;
  is_passed: boolean;
  started_at: string;
  submitted_at?: string | null;
  detailed_answers?: {
    question_id: number;
    question_text: string;
    selected_option_key?: string | null;
    correct_option_key?: string | null;
    is_correct: boolean;
    points_earned: number;
    explanation?: string | null;
    options: {
      option_key: string;
      content: string;
      is_correct: boolean;
    }[];
  }[];
}

export interface QuestionAnalyticsItem {
  question_id: number;
  question_text: string;
  correct_count: number;
  wrong_count: number;
  accuracy_rate: number;
  option_distribution: Record<string, number>;
}

export interface ExamReportResponse {
  exam_id: number;
  exam_title: string;
  subject: string;
  grade: number;
  duration_minutes: number;
  passing_score: number;
  total_points: number;
  total_questions: number;
  total_attempts: number;
  submitted_count: number;
  avg_score: number;
  pass_count: number;
  pass_rate: number;
  highest_score: number;
  lowest_score: number;
  student_attempts: StudentAttemptReport[];
  question_analytics?: QuestionAnalyticsItem[];
}


export interface TeacherExamsSummaryItem {
  exam_id: number;
  title: string;
  subject: string;
  grade: number;
  status: ExamStatus;
  created_at: string;
  total_attempts: number;
  submitted_count: number;
  avg_score: number;
  pass_rate: number;
}

export interface AiTutorFeedbackItem {
  question_id: number;
  question_text: string;
  selected_option_key?: string | null;
  selected_option_text?: string | null;
  correct_option_key: string;
  correct_option_text: string;
  why_wrong: string;
  correct_concept: string;
  study_hint: string;
  source_reference?: string | null;
}

export interface AiTutorResponse {
  attempt_id: number;
  total_incorrect: number;
  score: number;
  percentage: number;
  summary_advice: string;
  feedbacks: AiTutorFeedbackItem[];
}

export interface AdaptivePracticeRequest {
  subject: string;
  count: number;
  document_id?: number;
  topics?: string[];
}

export interface AdaptivePracticeResponse {
  exam_id: number;
  attempt_id: number;
  title: string;
  subject: string;
  grade: number;
  total_questions: number;
  duration_minutes: number;
  weak_topics_targeted: string[];
  message: string;
}

export interface SgkCitation {
  document_title: string;
  chapter: string;
  lesson: string;
  page_number?: number | null;
  snippet: string;
}

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatMessageInput {
  message: string;
  subject: string;
  grade?: number;
  conversation_history?: ChatMessageItem[];
}

export interface ChatMessageResponse {
  reply: string;
  subject: string;
  grade: number;
  citations: SgkCitation[];
  suggested_followups: string[];
}

export interface TopicMasteryItem {
  chapter: string;
  lesson: string;
  topic?: string | null;
  total_questions: number;
  correct_count: number;
  mastery_percentage: number;
  status_level: 'MASTERED' | 'PRACTICE_NEEDED' | 'WEAK';
  page_reference?: number | null;
}

export interface LearningRoadmapResponse {
  subject: string;
  grade: number;
  overall_mastery_percentage: number;
  total_attempts: number;
  mastered_count: number;
  practice_needed_count: number;
  weak_count: number;
  chapter_breakdown: TopicMasteryItem[];
  ai_daily_action: string;
  recommended_weak_topics: string[];
}

export interface StudentRiskItem {
  student_id: number;
  student_name: string;
  email: string;
  grade: number;
  avg_score: number;
  total_attempts: number;
  risk_level: 'GOOD' | 'MONITOR' | 'HIGH_RISK';
  weak_topics: string[];
  recent_trend: 'UP' | 'STABLE' | 'DOWN';
}

export interface ClassKnowledgeGapItem {
  chapter: string;
  lesson: string;
  error_rate: number;
  affected_students_count: number;
  teaching_recommendation: string;
}

export interface StudentAiEvaluationResponse {
  student_id: number;
  student_name: string;
  grade: number;
  overall_comment: string;
  strengths: string[];
  weaknesses: string[];
  parent_note: string;
  action_plan: string;
}

export interface TeacherClassOverviewResponse {
  subject: string;
  grade: number;
  total_students: number;
  avg_class_score: number;
  pass_rate: number;
  high_risk_count: number;
  monitor_count: number;
  good_count: number;
  risk_students: StudentRiskItem[];
  class_knowledge_gaps: ClassKnowledgeGapItem[];
  ai_teaching_advice: string;
}

export interface AssignRemedialRequest {
  student_ids: number[];
  subject: string;
  grade: number;
  topic?: string;
  question_count?: number;
}

export interface AssignRemedialResponse {
  message: string;
  assigned_count: number;
}

export interface VocabFlashcard {
  id: number;
  word: string;
  part_of_speech: string;
  ipa: string;
  meaning: string;
  image_url: string;
  audio_text: string;
  example_sentence: string;
  example_translation: string;
}

export interface ExerciseOption {
  option_key: string;
  content: string;
  image_url?: string | null;
}

export interface MultimodalExercise {
  id: number;
  exercise_type: 'MATCH_IMAGE' | 'LISTEN_SELECT' | 'SPELLING' | 'CONTEXT_FILL' | 'WORD_TYPING' | 'FILL_BLANK' | string;
  prompt: string;
  media_url?: string | null;
  audio_text?: string | null;
  options: ExerciseOption[];
  correct_answer: string;
  explanation: string;
}

export interface SpeakingPrompt {
  id: number;
  target_text: string;
  ipa: string;
  meaning: string;
  tip?: string;
}

export interface EnglishUnitDetailResponse {
  unit_id: number;
  title: string;
  topic: string;
  grade: number;
  description: string;
  flashcards: VocabFlashcard[];
  exercises: MultimodalExercise[];
  speaking_prompts: SpeakingPrompt[];
}

export interface WordScoreDetail {
  word: string;
  is_correct: boolean;
  confidence: number;
}

export interface PronunciationEvalResponse {
  target_text: string;
  spoken_text: string;
  score: number;
  accuracy_level: 'EXCELLENT' | 'GOOD' | 'NEED_PRACTICE';
  feedback: string;
  word_details: WordScoreDetail[];
}

export interface TopicUnitSummary {
  id: number;
  title: string;
  topic: string;
  vocab_count: number;
  exercise_count: number;
  status: 'AVAILABLE' | 'COMPLETED' | 'LOCKED';
  score?: number | null;
}

export interface EnglishRoadmapResponse {
  grade: number;
  student_name: string;
  overall_vocabulary_score: number;
  overall_listening_score: number;
  overall_speaking_score: number;
  overall_grammar_score: number;
  completed_units_count: number;
  total_units_count: number;
  units: TopicUnitSummary[];
  ai_daily_coaching_advice: string;
}

export interface RewardItem {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  diamond_cost: number;
  stock_quantity: number;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiamondTransaction {
  id: number;
  user_id: number;
  amount: number;
  transaction_type: 'EXAM_REWARD' | 'AI_PRACTICE_REWARD' | 'GIFT_REDEMPTION' | 'ADMIN_BONUS';
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface GiftRedemption {
  id: number;
  user_id: number;
  reward_item_id: number;
  diamond_cost: number;
  status: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'CANCELLED';
  note?: string;
  created_at: string;
  updated_at: string;
  reward_item?: RewardItem;
  user_name?: string;
}

export interface WordScrambleQuestion {
  game_id: string;
  subject: string;
  grade: number;
  mode?: 'word' | 'sentence';
  stage?: number;
  total_stages?: number;
  scrambled_letters: string[];
  letter_count: number;
  hint_meaning: string;
  hint_sgk_lesson?: string | null;
  first_letter_hint?: string | null;
  english_audio_prompt?: string | null;
  reward_diamonds: number;
  pre_filled_hints?: {
    target_index: number;
    scrambled_index: number;
    letter: string;
  }[];
}

export interface WordScrambleVerifyRequest {
  game_id: string;
  user_answer: string;
  streak_count: number;
}

export interface WordScrambleVerifyResponse {
  is_correct: boolean;
  target_word: string;
  user_answer: string;
  explanation: string;
  current_streak: number;
  earned_diamonds: number;
  new_diamond_balance?: number | null;
}


export interface RewardBalance {
  diamond_balance: number;
  total_earned: number;
  total_spent: number;
}

export interface DocumentSectionItem {
  title: string;
  lessons: string[];
}

export interface DocumentSectionsResponse {
  document_id: number;
  title: string;
  subject: string;
  grade: number;
  book_series?: string | null;
  chapters: DocumentSectionItem[];
  all_chapters: string[];
  all_topics: string[];
}




