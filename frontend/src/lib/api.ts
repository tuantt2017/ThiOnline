import {
  AuthResponse,
  SystemHealth,
  User,
  Document,
  DocumentChunk,
  PaginatedChunks,
  KnowledgeMapTree,
  KnowledgeOverviewItem,
  DocumentSectionsResponse,
  Question,
  QuestionListResponse,
  QuestionStats,
  QuestionCreateInput,
  WordImportResult,
  AiQuestionGenerateRequest,
  AiQuestionGenerateResponse,
  Exam,
  ExamListResponse,
  ExamCreateInput,
  StudentExamTakeResponse,
  ExamAttemptResultResponse,
  AttemptAnswerResponse,
  ExamReportResponse,
  TeacherExamsSummaryItem,
  AiTutorResponse,
  AdaptivePracticeRequest,
  AdaptivePracticeResponse,
  ChatMessageInput,
  ChatMessageResponse,
  LearningRoadmapResponse,
  TeacherClassOverviewResponse,
  StudentAiEvaluationResponse,
  AssignRemedialRequest,
  AssignRemedialResponse,
  EnglishUnitDetailResponse,
  PronunciationEvalResponse,
  EnglishRoadmapResponse as EnglishAiRoadmapResponse,
  RewardItem,
  DiamondTransaction,
  GiftRedemption,
  RewardBalance,
  WordScrambleQuestion,
  WordScrambleVerifyResponse,
  WordScrambleProgressResponse,
  WordScrambleProgressSaveRequest,
} from '@/types';





function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const isLocalhostClient =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // On HTTPS web pages, force relative path if NEXT_PUBLIC_API_URL is insecure http:// to prevent Mixed Content blocking
    if (isHttps && process.env.NEXT_PUBLIC_API_URL?.startsWith('http://')) {
      return '';
    }

    // On real production domains/IPs, fallback to relative path if NEXT_PUBLIC_API_URL points to localhost/127.0.0.1
    if (!isLocalhostClient && process.env.NEXT_PUBLIC_API_URL) {
      if (
        process.env.NEXT_PUBLIC_API_URL.includes('127.0.0.1') ||
        process.env.NEXT_PUBLIC_API_URL.includes('localhost')
      ) {
        return '';
      }
    }
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return '';
  }
  return 'http://127.0.0.1:8000';
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiBase = getApiBase();
  const url = apiBase ? `${apiBase}${endpoint}` : endpoint;

  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // AbortController timeout to accommodate cloud cold starts (65s)
  let signal = options.signal;
  let controller: AbortController | null = null;
  if (!signal && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    signal = controller.signal;
    setTimeout(() => controller?.abort(), 65000);
  }

  try {
    let response!: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal,
      });
    } catch (netError: any) {
      // Retry using alternative host targets (127.0.0.1 <-> localhost or direct backend server port 8000)
      const candidateBases: string[] = [];
      if (apiBase.includes('localhost')) {
        candidateBases.push(apiBase.replace('localhost', '127.0.0.1'));
      } else if (apiBase.includes('127.0.0.1')) {
        candidateBases.push(apiBase.replace('127.0.0.1', 'localhost'));
      } else if (typeof window !== 'undefined') {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
          candidateBases.push('http://127.0.0.1:8000', 'http://localhost:8000');
        } else {
          // Direct connection to Render backend live URL or web server domain
          candidateBases.push('https://thionline.onrender.com', `${window.location.protocol}//${window.location.hostname}:8000`);
        }
      }

      let succeeded = false;
      for (const altBase of candidateBases) {
        try {
          const altUrl = `${altBase}${endpoint}`;
          const altController = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const altTimer = altController ? setTimeout(() => altController.abort(), 4000) : null;
          response = await fetch(altUrl, {
            ...options,
            headers,
            signal: altController ? altController.signal : undefined,
          });
          if (altTimer) clearTimeout(altTimer);
          succeeded = true;
          break;
        } catch {
          // Continue to next candidate
        }
      }

      if (!succeeded) {
        console.error('[API Connection Error Target]', { url, apiBase, endpoint, error: netError });
        throw netError;
      }
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && typeof window !== 'undefined') {
        if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('last_activity');
        }
      }
      const errorMessage = data?.detail || data?.message || `HTTP error! status: ${response.status}`;
      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }

    const isNetworkError =
      !error?.status ||
      error?.name === 'TypeError' ||
      error?.name === 'AbortError' ||
      typeof error?.message !== 'string' ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError') ||
      error?.message?.includes('fetch failed') ||
      error?.message?.includes('Load failed');

    const cleanMsg = isNetworkError
      ? `Không thể kết nối đến máy chủ Backend (Target: ${url}). Vui lòng kiểm tra lại dịch vụ Backend hoặc chờ máy chủ khởi động.`
      : error?.message || 'Lỗi không xác định khi kết nối API';

    throw new ApiError(cleanMsg, isNetworkError ? 503 : 500);
  }
}

export const api = {
  // Auth endpoints (with auto-retry for Render cloud cold-starts)
  login: async (email: string, password: string): Promise<AuthResponse> => {
    let lastErr: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await request<AuthResponse>('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      } catch (err: any) {
        lastErr = err;
        if (attempt < 2 && (err?.status === 503 || err?.status === 500 || err?.name === 'ApiError' || err?.message?.includes('Backend'))) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  },

  demoLogin: async (role: string): Promise<AuthResponse> => {
    let lastErr: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await request<AuthResponse>('/api/v1/auth/demo-login', {
          method: 'POST',
          body: JSON.stringify({ role }),
        });
      } catch (err: any) {
        lastErr = err;
        if (attempt < 2 && (err?.status === 503 || err?.status === 500 || err?.name === 'ApiError' || err?.message?.includes('Backend'))) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  },

  register: async (email: string, full_name: string, password: string, grade?: number): Promise<User> => {
    return request<User>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, full_name, password, grade }),
    });
  },



  getMe: async (): Promise<User> => {
    return request<User>('/api/v1/auth/me', {
      method: 'GET',
    });
  },

  seedUsers: async (): Promise<{ message: string; created_users: string[] }> => {
    return request<{ message: string; created_users: string[] }>('/api/v1/auth/seed', {
      method: 'POST',
    });
  },

  // Users endpoints (Admin only)
  getUsers: async (): Promise<User[]> => {
    return request<User[]>('/api/v1/users/', {
      method: 'GET',
    });
  },

  updateUserStatus: async (userId: number, isActive: boolean): Promise<User> => {
    return request<User>(`/api/v1/users/${userId}/status?is_active=${isActive}`, {
      method: 'PUT',
    });
  },

  createUser: async (data: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    grade?: number | null;
  }): Promise<User> => {
    return request<User>('/api/v1/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Document & Knowledge Map endpoints
  uploadDocument: async (formData: FormData): Promise<Document> => {
    return request<Document>('/api/v1/documents/upload', {
      method: 'POST',
      body: formData,
    });
  },

  getDocuments: async (params?: {
    subject?: string;
    grade?: number;
    status?: string;
  }): Promise<Document[]> => {
    const query = new URLSearchParams();
    if (params?.subject) query.append('subject', params.subject);
    if (params?.grade) query.append('grade', params.grade.toString());
    if (params?.status) query.append('status', params.status);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<Document[]>(`/api/v1/documents/${queryString}`, {
      method: 'GET',
    });
  },

  getDocumentById: async (id: number): Promise<Document> => {
    return request<Document>(`/api/v1/documents/${id}`, {
      method: 'GET',
    });
  },

  getDocumentChunks: async (
    id: number,
    params?: { page?: number; page_size?: number; search?: string; chapter?: string }
  ): Promise<PaginatedChunks> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.chapter) query.append('chapter', params.chapter);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<PaginatedChunks>(`/api/v1/documents/${id}/chunks${queryString}`, {
      method: 'GET',
    });
  },

  getDocumentKnowledgeMap: async (id: number): Promise<KnowledgeMapTree> => {
    return request<KnowledgeMapTree>(`/api/v1/documents/${id}/knowledge-map`, {
      method: 'GET',
    });
  },

  getDocumentSections: async (id: number): Promise<DocumentSectionsResponse> => {
    return request<DocumentSectionsResponse>(`/api/v1/documents/${id}/sections`, {
      method: 'GET',
    });
  },

  getKnowledgeMapOverview: async (): Promise<KnowledgeOverviewItem[]> => {
    return request<KnowledgeOverviewItem[]>('/api/v1/documents/knowledge-map/overview', {
      method: 'GET',
    });
  },

  retryDocument: async (id: number): Promise<Document> => {
    return request<Document>(`/api/v1/documents/${id}/retry`, {
      method: 'POST',
    });
  },

  deleteDocument: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/api/v1/documents/${id}`, {
      method: 'DELETE',
    });
  },

  // Question Bank endpoints
  getQuestions: async (params?: {
    subject?: string;
    grade?: number;
    difficulty?: string;
    status?: string;
    source?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<QuestionListResponse> => {
    const query = new URLSearchParams();
    if (params?.subject) query.append('subject', params.subject);
    if (params?.grade) query.append('grade', params.grade.toString());
    if (params?.difficulty) query.append('difficulty', params.difficulty);
    if (params?.status) query.append('status', params.status);
    if (params?.source) query.append('source', params.source);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<QuestionListResponse>(`/api/v1/questions/${queryString}`, {
      method: 'GET',
    });
  },

  getQuestionStats: async (): Promise<QuestionStats> => {
    return request<QuestionStats>('/api/v1/questions/stats', {
      method: 'GET',
    });
  },

  getQuestionById: async (id: number): Promise<Question> => {
    return request<Question>(`/api/v1/questions/${id}`, {
      method: 'GET',
    });
  },

  createQuestion: async (data: QuestionCreateInput): Promise<Question> => {
    return request<Question>('/api/v1/questions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateQuestion: async (id: number, data: Partial<QuestionCreateInput>): Promise<Question> => {
    return request<Question>(`/api/v1/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteQuestion: async (id: number): Promise<void> => {
    return request<void>(`/api/v1/questions/${id}`, {
      method: 'DELETE',
    });
  },

  updateQuestionStatus: async (id: number, status: string): Promise<Question> => {
    return request<Question>(`/api/v1/questions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  batchUpdateQuestionStatus: async (
    question_ids: number[],
    status: string
  ): Promise<{ message: string; updated_count: number }> => {
    return request<{ message: string; updated_count: number }>('/api/v1/questions/batch-status', {
      method: 'POST',
      body: JSON.stringify({ question_ids, status }),
    });
  },

  importWordQuestions: async (formData: FormData): Promise<WordImportResult> => {
    return request<WordImportResult>('/api/v1/questions/import-word', {
      method: 'POST',
      body: formData,
    });
  },

  // Gemini AI Question Generation
  generateAiQuestions: async (data: AiQuestionGenerateRequest): Promise<AiQuestionGenerateResponse> => {
    return request<AiQuestionGenerateResponse>('/api/v1/ai/questions/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Exam Engine Endpoints
  getExams: async (params?: {
    subject?: string;
    grade?: number;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<ExamListResponse> => {
    const query = new URLSearchParams();
    if (params?.subject) query.append('subject', params.subject);
    if (params?.grade) query.append('grade', params.grade.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<ExamListResponse>(`/api/v1/exams/${queryString}`, {
      method: 'GET',
    });
  },

  getExamById: async (id: number): Promise<Exam> => {
    return request<Exam>(`/api/v1/exams/${id}`, {
      method: 'GET',
    });
  },

  createExam: async (data: ExamCreateInput): Promise<Exam> => {
    return request<Exam>('/api/v1/exams/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  publishExam: async (id: number): Promise<Exam> => {
    return request<Exam>(`/api/v1/exams/${id}/publish`, {
      method: 'POST',
    });
  },

  startExamAttempt: async (examId: number): Promise<StudentExamTakeResponse> => {
    return request<StudentExamTakeResponse>(`/api/v1/exams/${examId}/start`, {
      method: 'POST',
    });
  },

  getAttemptRoom: async (attemptId: number): Promise<StudentExamTakeResponse> => {
    return request<StudentExamTakeResponse>(`/api/v1/exams/attempts/${attemptId}`, {
      method: 'GET',
    });
  },

  autosaveAnswer: async (attemptId: number, questionId: number, selectedOptionKey: string | null): Promise<AttemptAnswerResponse> => {
    return request<AttemptAnswerResponse>(`/api/v1/exams/attempts/${attemptId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, selected_option_key: selectedOptionKey }),
    });
  },

  submitExamAttempt: async (attemptId: number): Promise<ExamAttemptResultResponse> => {
    return request<ExamAttemptResultResponse>(`/api/v1/exams/attempts/${attemptId}/submit`, {
      method: 'POST',
    });
  },

  getAttemptResult: async (attemptId: number): Promise<ExamAttemptResultResponse> => {
    return request<ExamAttemptResultResponse>(`/api/v1/exams/attempts/${attemptId}/result`, {
      method: 'GET',
    });
  },

  getMyAttempts: async (): Promise<ExamAttemptResultResponse[]> => {
    return request<ExamAttemptResultResponse[]>('/api/v1/exams/my-attempts', {
      method: 'GET',
    });
  },

  getExamReport: async (examId: number): Promise<ExamReportResponse> => {
    return request<ExamReportResponse>(`/api/v1/exams/${examId}/report`, {
      method: 'GET',
    });
  },

  getTeacherExamsSummary: async (): Promise<TeacherExamsSummaryItem[]> => {
    return request<TeacherExamsSummaryItem[]>('/api/v1/exams/reports/summary', {
      method: 'GET',
    });
  },

  getAiTutorFeedback: async (attemptId: number): Promise<AiTutorResponse> => {
    return request<AiTutorResponse>(`/api/v1/exams/attempts/${attemptId}/ai-tutor`, {
      method: 'POST',
    });
  },

  createAdaptivePractice: async (data: AdaptivePracticeRequest): Promise<AdaptivePracticeResponse> => {
    return request<AdaptivePracticeResponse>('/api/v1/ai/adaptive-practice', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  chatWithAiCompanion: async (data: ChatMessageInput): Promise<ChatMessageResponse> => {
    return request<ChatMessageResponse>('/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getLearningRoadmap: async (subject?: string): Promise<LearningRoadmapResponse> => {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return request<LearningRoadmapResponse>(`/api/v1/ai/roadmap${query}`, {
      method: 'GET',
    });
  },

  changePassword: async (old_password: string, new_password: string): Promise<{ message: string }> => {
    return request<{ message: string }>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password, new_password }),
    });
  },

  updateStudentGrade: async (grade: number): Promise<User> => {
    return request<User>('/api/v1/auth/me/grade', {
      method: 'PUT',
      body: JSON.stringify({ grade }),
    });
  },

  // Teacher Intelligence & Student Assessment Endpoints
  getTeacherClassAnalytics: async (subject?: string, grade?: number): Promise<TeacherClassOverviewResponse> => {
    const query = new URLSearchParams();
    if (subject) query.append('subject', subject);
    if (grade) query.append('grade', grade.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';

    return request<TeacherClassOverviewResponse>(`/api/v1/ai/teacher/class-analytics${queryString}`, {
      method: 'GET',
    });
  },

  getStudentAiEvaluation: async (studentId: number): Promise<StudentAiEvaluationResponse> => {
    return request<StudentAiEvaluationResponse>(`/api/v1/ai/teacher/student-evaluation/${studentId}`, {
      method: 'GET',
    });
  },

  assignRemedialPractice: async (data: AssignRemedialRequest): Promise<AssignRemedialResponse> => {
    return request<AssignRemedialResponse>('/api/v1/ai/teacher/assign-remedial', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // English AI Multimodal Endpoints
  getEnglishAiRoadmap: async (subject?: string): Promise<EnglishAiRoadmapResponse> => {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return request<EnglishAiRoadmapResponse>(`/api/v1/english/roadmap${query}`, {
      method: 'GET',
    });
  },

  getEnglishUnitDetail: async (unitId: number): Promise<EnglishUnitDetailResponse> => {
    return request<EnglishUnitDetailResponse>(`/api/v1/english/units/${unitId}`, {
      method: 'GET',
    });
  },

  evaluatePronunciation: async (targetText: string, spokenText: string, unitId?: number): Promise<PronunciationEvalResponse> => {
    return request<PronunciationEvalResponse>('/api/v1/english/evaluate-pronunciation', {
      method: 'POST',
      body: JSON.stringify({ target_text: targetText, spoken_text: spokenText, unit_id: unitId }),
    });
  },

  generateCustomEnglishUnit: async (topic: string, grade: number = 5): Promise<EnglishUnitDetailResponse> => {
    return request<EnglishUnitDetailResponse>('/api/v1/english/generate-custom-unit', {
      method: 'POST',
      body: JSON.stringify({ topic, grade }),
    });
  },

  completeEnglishUnit: async (unitId: number, score: number = 100.0): Promise<{ message: string; unit_id: number; status: string; score: number }> => {
    return request<{ message: string; unit_id: number; status: string; score: number }>(`/api/v1/english/units/${unitId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ score }),
    });
  },

  // Rewards & Gamification Endpoints
  getRewardBalance: async (): Promise<RewardBalance> => {
    return request<RewardBalance>('/api/v1/rewards/balance', { method: 'GET' });
  },

  getRewardItems: async (): Promise<RewardItem[]> => {
    return request<RewardItem[]>('/api/v1/rewards/items', { method: 'GET' });
  },

  redeemRewardItem: async (itemId: number, note?: string): Promise<GiftRedemption> => {
    return request<GiftRedemption>(`/api/v1/rewards/redeem/${itemId}`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  claimAiPracticeReward: async (unitId: string): Promise<{ awarded: number; new_balance: number }> => {
    return request<{ awarded: number; new_balance: number }>(`/api/v1/rewards/claim-ai-practice?unit_id=${encodeURIComponent(unitId)}`, {
      method: 'POST',
    });
  },

  getStudentRewardHistory: async (): Promise<{ transactions: DiamondTransaction[]; redemptions: GiftRedemption[] }> => {
    return request<{ transactions: DiamondTransaction[]; redemptions: GiftRedemption[] }>('/api/v1/rewards/my-history', { method: 'GET' });
  },

  adminGetRewardItems: async (): Promise<RewardItem[]> => {
    return request<RewardItem[]>('/api/v1/rewards/admin/items', { method: 'GET' });
  },

  adminCreateRewardItem: async (data: Partial<RewardItem>): Promise<RewardItem> => {
    return request<RewardItem>('/api/v1/rewards/admin/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adminUpdateRewardItem: async (itemId: number, data: Partial<RewardItem>): Promise<RewardItem> => {
    return request<RewardItem>(`/api/v1/rewards/admin/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  adminDeleteRewardItem: async (itemId: number): Promise<{ message: string; deleted: boolean; soft_deleted?: boolean }> => {
    return request<{ message: string; deleted: boolean; soft_deleted?: boolean }>(`/api/v1/rewards/admin/items/${itemId}`, {
      method: 'DELETE',
    });
  },


  adminGetRedemptions: async (): Promise<GiftRedemption[]> => {
    return request<GiftRedemption[]>('/api/v1/rewards/admin/redemptions', { method: 'GET' });
  },

  adminUpdateRedemptionStatus: async (redemptionId: number, status: string, note?: string): Promise<GiftRedemption> => {
    return request<GiftRedemption>(`/api/v1/rewards/admin/redemptions/${redemptionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, note }),
    });
  },

  // System endpoints

  getHealth: async (): Promise<SystemHealth> => {
    return request<SystemHealth>('/api/health', {
      method: 'GET',
    });
  },

  getTrialLimit: async (): Promise<{ trial_max_uses: number }> => {
    return request<{ trial_max_uses: number }>('/api/v1/system-settings/trial-limit', {
      method: 'GET',
    });
  },

  updateTrialLimit: async (max_uses: number): Promise<{ trial_max_uses: number }> => {
    return request<{ trial_max_uses: number }>('/api/v1/system-settings/trial-limit', {
      method: 'PUT',
      body: JSON.stringify({ max_uses }),
    });
  },

  // Word Scramble Game Endpoints
  getWordScrambleQuestion: async (subject?: string, grade?: number, stage?: number, questionIndex?: number): Promise<WordScrambleQuestion> => {
    const query = new URLSearchParams();
    if (subject) query.append('subject', subject);
    if (grade) query.append('grade', grade.toString());
    if (stage) query.append('stage', stage.toString());
    if (questionIndex) query.append('question_index', questionIndex.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<WordScrambleQuestion>(`/api/v1/games/word-scramble/next${queryString}`, {
      method: 'GET',
    });
  },

  verifyWordScrambleAnswer: async (gameId: string, userAnswer: string, streakCount: number = 0): Promise<WordScrambleVerifyResponse> => {
    return request<WordScrambleVerifyResponse>('/api/v1/games/word-scramble/verify', {
      method: 'POST',
      body: JSON.stringify({ game_id: gameId, user_answer: userAnswer, streak_count: streakCount }),
    });
  },

  getWordScrambleProgress: async (subject?: string, grade?: number): Promise<WordScrambleProgressResponse> => {
    const query = new URLSearchParams();
    if (subject) query.append('subject', subject);
    if (grade) query.append('grade', grade.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<WordScrambleProgressResponse>(`/api/v1/games/word-scramble/progress${queryString}`, {
      method: 'GET',
    });
  },

  saveWordScrambleProgress: async (data: WordScrambleProgressSaveRequest): Promise<WordScrambleProgressResponse> => {
    return request<WordScrambleProgressResponse>('/api/v1/games/word-scramble/progress', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};




