'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Question,
  QuestionDifficulty,
  QuestionStatus,
  QuestionSource,
  QuestionStats,
  QuestionCreateInput,
  WordImportResult,
} from '@/types';
import AiQuestionModal from '@/components/AiQuestionModal';
import {
  FileQuestion,
  Plus,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Clock,
  FileEdit,
  Trash2,
  Filter,
  Search,
  BookOpen,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  FileText,
  RefreshCw,
  Lightbulb,
  CheckSquare,
  Square,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const SUBJECTS = [
  'Toán',
  'Tiếng Việt',
  'Tiếng Anh',
  'Khoa học',
  'Lịch sử & Địa lí',
  'Tin học',
];

const GRADES = [4, 5, 6, 7, 8, 9];

export default function QuestionsPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuestionStats | null>(null);

  if (user?.role === 'STUDENT') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-lg">
          <div className="w-14 h-14 bg-rose-100 border border-rose-200 rounded-2xl flex items-center justify-center text-rose-600 mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Quyền truy cập bị giới hạn
          </h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Tài khoản học sinh không được phép xem Ngân hàng câu hỏi. Vui lòng chuyển đến mục <strong>Đề thi của tôi</strong> để tham gia các kỳ thi trực tuyến.
          </p>
          <Link
            href="/student/exams"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-500/20"
          >
            <GraduationCap className="w-4 h-4" /> Đến Đề Thi Của Tôi
          </Link>
        </div>
      </div>
    );
  }

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Form State
  const [formContent, setFormContent] = useState('');
  const [formSubject, setFormSubject] = useState('Toán');
  const [formGrade, setFormGrade] = useState(4);
  const [formDifficulty, setFormDifficulty] = useState<QuestionDifficulty>(QuestionDifficulty.MEDIUM);
  const [formStatus, setFormStatus] = useState<QuestionStatus>(QuestionStatus.REVIEW);
  const [formChapter, setFormChapter] = useState('');
  const [formLesson, setFormLesson] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formOptions, setFormOptions] = useState([
    { option_key: 'A', content: '', is_correct: true, explanation: '', order_index: 0 },
    { option_key: 'B', content: '', is_correct: false, explanation: '', order_index: 1 },
    { option_key: 'C', content: '', is_correct: false, explanation: '', order_index: 2 },
    { option_key: 'D', content: '', is_correct: false, explanation: '', order_index: 3 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Import Word State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSubject, setImportSubject] = useState('Toán');
  const [importGrade, setImportGrade] = useState(4);
  const [importPreview, setImportPreview] = useState<WordImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showPreviewList, setShowPreviewList] = useState(false);

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resQuestions, resStats] = await Promise.all([
        api.getQuestions({
          subject: selectedSubject || undefined,
          grade: selectedGrade ? parseInt(selectedGrade) : undefined,
          difficulty: selectedDifficulty || undefined,
          status: selectedStatus || undefined,
          search: searchQuery || undefined,
          page,
          page_size: pageSize,
        }),
        isTeacherOrAdmin ? api.getQuestionStats().catch(() => null) : Promise.resolve(null),
      ]);
      setQuestions(resQuestions.items || []);
      setTotal(resQuestions.total || 0);
      if (resStats) setStats(resStats);
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách câu hỏi:', err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedSubject,
    selectedGrade,
    selectedDifficulty,
    selectedStatus,
    searchQuery,
    page,
    isTeacherOrAdmin,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle single status change
  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.updateQuestionStatus(id, newStatus);
      loadData();
    } catch (err: any) {
      alert(`Lỗi khi cập nhật trạng thái: ${err.message}`);
    }
  };

  // Handle batch status change
  const handleBatchStatus = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    try {
      await api.batchUpdateQuestionStatus(selectedIds, newStatus);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      alert(`Lỗi khi cập nhật hàng loạt: ${err.message}`);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    try {
      await api.deleteQuestion(id);
      loadData();
    } catch (err: any) {
      alert(`Lỗi khi xóa câu hỏi: ${err.message}`);
    }
  };

  // Open Create/Edit modal
  const openCreateModal = (q?: Question) => {
    if (q) {
      setEditingQuestion(q);
      setFormContent(q.content);
      setFormSubject(q.subject);
      setFormGrade(q.grade);
      setFormDifficulty(q.difficulty);
      setFormStatus(q.status);
      setFormChapter(q.chapter || '');
      setFormLesson(q.lesson || '');
      setFormExplanation(q.explanation || '');
      setFormOptions(
        q.options.map((opt, i) => ({
          option_key: opt.option_key,
          content: opt.content,
          is_correct: opt.is_correct,
          explanation: opt.explanation || '',
          order_index: i,
        }))
      );
    } else {
      setEditingQuestion(null);
      setFormContent('');
      setFormSubject('Toán');
      setFormGrade(4);
      setFormDifficulty(QuestionDifficulty.MEDIUM);
      setFormStatus(QuestionStatus.REVIEW);
      setFormChapter('');
      setFormLesson('');
      setFormExplanation('');
      setFormOptions([
        { option_key: 'A', content: '', is_correct: true, explanation: '', order_index: 0 },
        { option_key: 'B', content: '', is_correct: false, explanation: '', order_index: 1 },
        { option_key: 'C', content: '', is_correct: false, explanation: '', order_index: 2 },
        { option_key: 'D', content: '', is_correct: false, explanation: '', order_index: 3 },
      ]);
    }
    setFormError(null);
    setShowCreateModal(true);
  };

  // Submit Create / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formContent.trim()) {
      setFormError('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    const emptyOptions = formOptions.some((opt) => !opt.content.trim());
    if (emptyOptions) {
      setFormError('Vui lòng nhập đầy đủ nội dung cho cả 4 phương án A, B, C, D.');
      return;
    }

    const correctCount = formOptions.filter((opt) => opt.is_correct).length;
    if (correctCount !== 1) {
      setFormError('Vui lòng chọn chính xác 1 phương án đúng.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: QuestionCreateInput = {
        content: formContent.trim(),
        subject: formSubject,
        grade: formGrade,
        difficulty: formDifficulty,
        status: formStatus,
        chapter: formChapter.trim() || undefined,
        lesson: formLesson.trim() || undefined,
        explanation: formExplanation.trim() || undefined,
        options: formOptions.map((opt, i) => ({
          option_key: opt.option_key,
          content: opt.content.trim(),
          is_correct: opt.is_correct,
          explanation: opt.explanation?.trim() || undefined,
          order_index: i,
        })),
      };

      if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, payload);
      } else {
        await api.createQuestion(payload);
      }

      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu câu hỏi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Word Import Handler
  const handleWordImport = async (commit: boolean) => {
    if (!importFile) {
      setImportError('Vui lòng chọn tệp Word (.docx).');
      return;
    }
    setImportLoading(true);
    setImportError(null);

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('subject', importSubject);
    formData.append('grade', importGrade.toString());
    formData.append('commit', commit.toString());

    try {
      const res = await api.importWordQuestions(formData);
      setImportPreview(res);
      if (commit && res.imported_count > 0) {
        alert(`Đã nhập thành công ${res.imported_count} câu hỏi vào ngân hàng!`);
        setShowImportModal(false);
        setImportFile(null);
        setImportPreview(null);
        loadData();
      }
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi đọc file Word.');
    } finally {
      setImportLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === questions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions.map((q) => q.id));
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getDifficultyBadge = (diff: QuestionDifficulty) => {
    switch (diff) {
      case QuestionDifficulty.EASY:
        return (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 border border-emerald-500/20">
            Dễ
          </span>
        );
      case QuestionDifficulty.HARD:
        return (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 border border-rose-500/20">
            Khó
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 border border-amber-500/20">
            Trung bình
          </span>
        );
    }
  };

  const getStatusBadge = (st: QuestionStatus) => {
    switch (st) {
      case QuestionStatus.APPROVED:
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã duyệt
          </span>
        );
      case QuestionStatus.REVIEW:
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Chờ duyệt
          </span>
        );
      case QuestionStatus.REJECTED:
        return (
          <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Từ chối
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 border border-zinc-500/20">
            Bản nháp
          </span>
        );
    }
  };

  const getSourceBadge = (src: QuestionSource) => {
    if (src === QuestionSource.WORD_IMPORT) {
      return (
        <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          Word
        </span>
      );
    }
    if (src === QuestionSource.AI_GENERATED) {
      return (
        <span className="text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> AI
        </span>
      );
    }
    return (
      <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
        Thủ công
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              <GraduationCap className="w-4 h-4" /> Khối Lớp 4 – 9 (Tiểu học & THCS)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
              Ngân Hàng Câu Hỏi
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý, phân loại theo SGK và phê duyệt câu hỏi trắc nghiệm chuẩn hóa.
            </p>
          </div>

          {isTeacherOrAdmin && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAiModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                Tạo bằng AI (Gemini)
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition"
              >
                <UploadCloud className="w-4 h-4 text-blue-600" />
                Nhập từ Word (.docx)
              </button>
              <button
                onClick={() => openCreateModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
                Tạo thủ công
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards (Teacher / Admin) */}
        {isTeacherOrAdmin && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">Tổng câu hỏi</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {stats.total}
              </div>
              <div className="text-xs text-slate-400 mt-1">Toàn bộ ngân hàng</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/30 p-4 shadow-sm">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="text-xs font-medium uppercase tracking-wider">Đã duyệt</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2">
                {stats.by_status['APPROVED'] || 0}
              </div>
              <div className="text-xs text-emerald-600/70 mt-1">Đủ điều kiện đưa vào đề thi</div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-50/30 p-4 shadow-sm">
              <div className="flex items-center justify-between text-amber-600">
                <span className="text-xs font-medium uppercase tracking-wider">Chờ xét duyệt</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-2">
                {stats.by_status['REVIEW'] || 0}
              </div>
              <div className="text-xs text-amber-600/70 mt-1">Cần giáo viên kiểm tra</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">Bản nháp / Khác</span>
                <FileEdit className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {(stats.by_status['DRAFT'] || 0) + (stats.by_status['REJECTED'] || 0)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {stats.by_status['DRAFT'] || 0} nháp, {stats.by_status['REJECTED'] || 0} từ chối
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm my-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nội dung..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subject */}
            <div>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả môn học</option>
                {SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade */}
            <div>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả khối lớp (4-9)</option>
                {GRADES.map((g) => (
                  <option key={g} value={g.toString()}>
                    Lớp {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả độ khó</option>
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HARD">Khó</option>
              </select>
            </div>

            {/* Status (Teacher/Admin only) */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={!isTeacherOrAdmin}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isTeacherOrAdmin ? (
                  <>
                    <option value="">Tất cả trạng thái</option>
                    <option value="REVIEW">Chờ duyệt (Review)</option>
                    <option value="APPROVED">Đã duyệt (Approved)</option>
                    <option value="DRAFT">Bản nháp (Draft)</option>
                    <option value="REJECTED">Từ chối (Rejected)</option>
                  </>
                ) : (
                  <option value="APPROVED">Đã duyệt (Chính thức)</option>
                )}
              </select>
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {isTeacherOrAdmin && questions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 font-medium hover:text-slate-900"
                >
                  {selectedIds.length === questions.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  Chọn tất cả trang này ({selectedIds.length}/{questions.length})
                </button>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">
                    Đã chọn {selectedIds.length} câu:
                  </span>
                  <button
                    onClick={() => handleBatchStatus('APPROVED')}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
                  >
                    Duyệt tất cả
                  </button>
                  <button
                    onClick={() => handleBatchStatus('REJECTED')}
                    className="px-3 py-1 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition"
                  >
                    Từ chối tất cả
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Questions Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-slate-500">Đang tải ngân hàng câu hỏi...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white/50">
            <FileQuestion className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">
              Không tìm thấy câu hỏi nào
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Chưa có câu hỏi phù hợp với bộ lọc hiện tại. Thử thay đổi điều kiện lọc hoặc nhập thêm câu hỏi từ file Word.
            </p>
            {isTeacherOrAdmin && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                >
                  Nhập từ Word (.docx)
                </button>
                <button
                  onClick={() => openCreateModal()}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Tạo câu hỏi thủ công
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {questions.map((q, qIndex) => {
              const isSelected = selectedIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border transition-all duration-200 p-5 bg-white shadow-sm flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Card Top Meta */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isTeacherOrAdmin && (
                          <button
                            onClick={() => toggleSelectId(q.id)}
                            className="text-slate-400 hover:text-blue-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <span className="font-bold text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          #{(page - 1) * pageSize + qIndex + 1}
                        </span>
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {q.subject}
                        </span>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Lớp {q.grade}
                        </span>
                        {getDifficultyBadge(q.difficulty)}
                        {getSourceBadge(q.source)}
                      </div>

                      <div>{getStatusBadge(q.status)}</div>
                    </div>

                    {/* Chapter / Lesson if present */}
                    {(q.chapter || q.lesson) && (
                      <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1 font-medium">
                        <BookOpen className="w-3 h-3" />
                        {[q.chapter, q.lesson].filter(Boolean).join(' • ')}
                      </div>
                    )}

                    {/* Question Content */}
                    <div className="text-sm font-medium text-slate-900 leading-relaxed mb-4 whitespace-pre-wrap">
                      {q.content}
                    </div>

                    {/* 4 Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                      {q.options.map((opt) => (
                        <div
                          key={opt.option_key}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs leading-snug transition-colors ${
                            opt.is_correct
                              ? 'border-emerald-500/50 bg-emerald-50/50 text-emerald-950 font-medium ring-1 ring-emerald-500/20'
                              : 'border-slate-200 bg-slate-50/50 text-slate-700'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                              opt.is_correct
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {opt.option_key}
                          </span>
                          <span className="flex-1 mt-0.5">{opt.content}</span>
                          {opt.is_correct && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-200/50 p-3 mb-4 text-xs text-amber-900">
                        <div className="flex items-center gap-1 font-semibold text-amber-800 mb-1">
                          <Lightbulb className="w-3.5 h-3.5" /> Lời giải / Giải thích:
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions (Teacher / Admin) */}
                  {isTeacherOrAdmin && (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2 text-xs">
                      {/* Status quick buttons */}
                      <div className="flex items-center gap-1.5">
                        {q.status !== QuestionStatus.APPROVED && (
                          <button
                            onClick={() => handleStatusChange(q.id, 'APPROVED')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 font-semibold hover:bg-emerald-100 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt
                          </button>
                        )}
                        {q.status !== QuestionStatus.REJECTED && (
                          <button
                            onClick={() => handleStatusChange(q.id, 'REJECTED')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-semibold hover:bg-rose-100 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                          </button>
                        )}
                      </div>

                      {/* Edit / Delete */}
                      <div className="flex items-center gap-1 text-slate-400">
                        <button
                          onClick={() => openCreateModal(q)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition"
                          title="Chỉnh sửa câu hỏi"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-rose-600 transition"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-200 mt-8 pt-4">
            <span className="text-xs text-slate-500">
              Hiển thị {(page - 1) * pageSize + 1} -{' '}
              {Math.min(page * pageSize, total)} trong tổng số {total} câu hỏi
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                Trang trước
              </button>
              <span className="text-xs font-bold px-2">{page}</span>
              <button
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Tạo / Chỉnh sửa câu hỏi */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingQuestion ? 'Chỉnh Sửa Câu Hỏi' : 'Tạo Câu Hỏi Mới'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 mb-4 text-xs text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Meta row: Subject, Grade, Difficulty, Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Môn học
                  </label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Khối lớp
                  </label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(parseInt(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Lớp {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Độ khó
                  </label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as QuestionDifficulty)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                  >
                    <option value="EASY">Dễ</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HARD">Khó</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as QuestionStatus)}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                  >
                    <option value="REVIEW">Chờ duyệt</option>
                    <option value="APPROVED">Đã duyệt</option>
                    <option value="DRAFT">Bản nháp</option>
                  </select>
                </div>
              </div>

              {/* Question Content */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nội dung câu hỏi *
                </label>
                <textarea
                  rows={3}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Nhập nội dung câu hỏi..."
                  className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 4 Options */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  4 Phương án lựa chọn (chọn nút tròn để đánh dấu đáp án đúng) *
                </label>
                <div className="space-y-2">
                  {formOptions.map((opt, idx) => (
                    <div
                      key={opt.option_key}
                      className={`flex items-center gap-3 p-2 rounded-xl border transition-colors ${
                        opt.is_correct
                          ? 'border-emerald-500 bg-emerald-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="correct_option"
                        checked={opt.is_correct}
                        onChange={() => {
                          setFormOptions((prev) =>
                            prev.map((o, i) => ({
                              ...o,
                              is_correct: i === idx,
                            }))
                          );
                        }}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer ml-1"
                      />
                      <span className="font-bold text-xs text-slate-600 w-4">
                        {opt.option_key}.
                      </span>
                      <input
                        type="text"
                        value={opt.content}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormOptions((prev) =>
                            prev.map((o, i) => (i === idx ? { ...o, content: val } : o))
                          );
                        }}
                        placeholder={`Nội dung phương án ${opt.option_key}...`}
                        className="flex-1 text-xs rounded-lg border-0 bg-transparent focus:outline-none focus:ring-0 text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Lời giải / Giải thích chi tiết (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="Giải thích tại sao đáp án trên là đúng..."
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Chapter / Lesson */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Chương (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formChapter}
                    onChange={(e) => setFormChapter(e.target.value)}
                    placeholder="Ví dụ: Chương 1: Số tự nhiên"
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Bài học (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formLesson}
                    onChange={(e) => setFormLesson(e.target.value)}
                    placeholder="Ví dụ: Bài 4: Phép cộng và phép trừ"
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {submitting ? 'Đang lưu...' : editingQuestion ? 'Lưu cập nhật' : 'Tạo câu hỏi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nhập từ Word (.docx) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Nhập Ngân Hàng Câu Hỏi Từ Word (.docx)
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview(null);
                  setImportError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {importError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 mb-4 text-xs text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Target Subject & Grade */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Môn học đích *
                </label>
                <select
                  value={importSubject}
                  onChange={(e) => setImportSubject(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Khối lớp đích (4-9) *
                </label>
                <select
                  value={importGrade}
                  onChange={(e) => setImportGrade(parseInt(e.target.value))}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* File Drag / Drop */}
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center mb-4 bg-slate-50/50">
              <FileText className="w-10 h-10 text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium">
                {importFile ? importFile.name : 'Chọn tệp Word chứa đề thi hoặc kéo thả vào đây'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Hỗ trợ định dạng .docx chuẩn: Câu 1:, A., B., C., D., Đáp án: B, Lời giải:...
              </p>
              <label className="inline-block mt-3 px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition">
                Chọn tệp .docx
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                      setImportPreview(null);
                    }
                  }}
                />
              </label>
            </div>

            {/* Preview Results */}
            {importPreview && (
              <div className="rounded-xl border border-slate-200 p-4 mb-4 bg-slate-50 text-xs">
                <div className="flex items-center justify-between font-bold mb-2">
                  <span>Kết quả phân tích tệp:</span>
                  <span className="text-slate-500 font-normal">
                    Tổng số: {importPreview.total_detected} câu
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center mb-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">
                    ✓ {importPreview.valid_count} câu hợp lệ
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 text-rose-700 font-semibold">
                    ✕ {importPreview.invalid_count} câu lỗi định dạng
                  </div>
                </div>

                {importPreview.errors.length > 0 && (
                  <div className="rounded-lg bg-rose-50/80 p-2.5 mb-3 border border-rose-200 text-rose-800">
                    <div className="font-semibold mb-1">Chi tiết lỗi:</div>
                    <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                      {importPreview.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowPreviewList(!showPreviewList)}
                  className="text-blue-600 font-medium flex items-center gap-1 hover:underline"
                >
                  {showPreviewList ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> Ẩn danh sách câu hỏi xem trước
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> Xem trước chi tiết các câu đã nhận diện
                    </>
                  )}
                </button>

                {showPreviewList && (
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {importPreview.questions.map((q) => (
                      <div
                        key={q.question_index}
                        className={`p-2 rounded-lg border text-[11px] ${
                          q.is_valid
                            ? 'border-slate-200 bg-white'
                            : 'border-rose-300 bg-rose-50/50 text-rose-900'
                        }`}
                      >
                        <div className="font-bold">
                          Câu {q.question_index}: {q.content.slice(0, 60)}...
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Đáp án: <span className="font-bold text-emerald-600">{q.correct_option || 'Chưa có'}</span> ({q.options.length} phương án)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
              >
                Đóng
              </button>

              <button
                type="button"
                disabled={!importFile || importLoading}
                onClick={() => handleWordImport(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-50 transition"
              >
                {importLoading ? 'Đang đọc file...' : 'Kiểm tra & Xem trước'}
              </button>

              <button
                type="button"
                disabled={!importFile || importLoading || (importPreview !== null && importPreview.valid_count === 0)}
                onClick={() => handleWordImport(true)}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
              >
                {importLoading ? 'Đang xử lý...' : 'Xác nhận nhập vào Ngân hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Question Generation Modal */}
      <AiQuestionModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onQuestionsGenerated={loadData}
      />
    </div>
  );
}
