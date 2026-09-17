'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Document,
  QuestionDifficulty,
  AiQuestionGenerateResponse,
  AiGeneratedQuestionItem,
} from '@/types';
import {
  Sparkles,
  X,
  Bot,
  BookOpen,
  Globe,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
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

interface AiQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsGenerated: () => void;
}

export default function AiQuestionModal({
  isOpen,
  onClose,
  onQuestionsGenerated,
}: AiQuestionModalProps) {
  // Document list for selection
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  // Form State
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState(5);
  const [chapter, setChapter] = useState('');
  const [lesson, setLesson] = useState('');
  const [count, setCount] = useState(5);
  const [easyRatio, setEasyRatio] = useState(30);
  const [mediumRatio, setMediumRatio] = useState(50);
  const [hardRatio, setHardRatio] = useState(20);
  const [useWebContext, setUseWebContext] = useState(true);
  const [saveAsDraft, setSaveAsDraft] = useState(true);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiQuestionGenerateResponse | null>(null);
  const [approvedIds, setApprovedIds] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Load completed documents for grounding context
      api
        .getDocuments({ status: 'COMPLETED' })
        .then((docs) => setDocuments(docs || []))
        .catch(() => setDocuments([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setApprovedIds([]);

    try {
      const res = await api.generateAiQuestions({
        subject,
        grade,
        document_id: selectedDocId,
        chapter: chapter.trim() || undefined,
        lesson: lesson.trim() || undefined,
        count,
        difficulty_distribution: {
          easy: easyRatio,
          medium: mediumRatio,
          hard: hardRatio,
        },
        use_web_context: useWebContext,
        save_as_draft: saveAsDraft,
      });

      setResult(res);
      onQuestionsGenerated();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gọi AI sinh câu hỏi.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveItem = async (qItem: AiGeneratedQuestionItem) => {
    if (!qItem.created_question_id) return;
    try {
      await api.updateQuestionStatus(qItem.created_question_id, 'APPROVED');
      setApprovedIds((prev) => [...prev, qItem.created_question_id!]);
      onQuestionsGenerated();
    } catch (err: any) {
      alert(`Lỗi khi duyệt câu hỏi: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Gradient Banner */}
        <div className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/25">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">
                AI Question Generator (Gemini)
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Sinh Câu Hỏi Trắc Nghiệm Bằng AI
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-purple-100 mt-2 max-w-2xl leading-relaxed">
            Áp dụng **AI Grounding Rule**: Dùng SGK/Knowledge Map làm chuẩn kiến thức GDPT 2018, kết hợp Ngữ cảnh Thực tế (Web) làm câu hỏi sinh động.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!result ? (
            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Grounding Info Card */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-900 flex items-start gap-3">
                <Bot className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm text-indigo-950">
                    Quy tắc Grounding & Validation tự động:
                  </div>
                  <p>
                    • **SGK làm chuẩn**: Phạm vi kiến thức, độ khó và mục tiêu cần đạt tuân thủ SGK Lớp 4-9.
                  </p>
                  <p>
                    • **Backend Validation**: Tự động kiểm tra đúng 4 phương án (A, B, C, D), 1 đáp án đúng và lời giải chi tiết.
                  </p>
                </div>
              </div>

              {/* Subject & Grade Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Môn Học
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Khối Lớp (GDPT)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Lớp {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Số Lượng Câu Hỏi
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Document Selection (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-purple-600" /> Chọn Tài Liệu SGK Tham Chiếu (Tùy chọn)
                </label>
                <select
                  value={selectedDocId || ''}
                  onChange={(e) => setSelectedDocId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">-- Không đính kèm (Sinh theo chuẩn môn {subject} Lớp {grade}) --</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename || d.title} ({d.subject} Lớp {d.grade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter & Lesson inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Chương / Chủ đề (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    placeholder="VD: Chương 1: Số tự nhiên..."
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bài học (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={lesson}
                    onChange={(e) => setLesson(e.target.value)}
                    placeholder="VD: Bài 5: Tỉ số phần trăm..."
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Difficulty Ratio sliders */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-purple-600" /> Tỷ Lệ Phân Bổ Độ Khó
                  </span>
                  <span className="text-purple-600 font-mono">
                    Dễ {easyRatio}% | TB {mediumRatio}% | Khó {hardRatio}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-emerald-600 font-semibold mb-1">
                      Dễ: {easyRatio}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={easyRatio}
                      onChange={(e) => setEasyRatio(parseInt(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-amber-600 font-semibold mb-1">
                      Trung bình: {mediumRatio}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={mediumRatio}
                      onChange={(e) => setMediumRatio(parseInt(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-rose-600 font-semibold mb-1">
                      Khó: {hardRatio}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={hardRatio}
                      onChange={(e) => setHardRatio(parseInt(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWebContext}
                    onChange={(e) => setUseWebContext(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-500" /> Ngữ cảnh thực tế (Web Context)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Tự động đưa tình huống thực tế sinh động vào đề thi mà không làm vượt chương trình.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsDraft}
                    onChange={(e) => setSaveAsDraft(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900">
                      Tự động lưu vào Ngân Hàng Câu Hỏi (Trạng thái REVIEW)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Lưu bản nháp để Giáo viên duyệt trước khi sử dụng chính thức.
                    </p>
                  </div>
                </label>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md shadow-purple-500/20 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gemini AI đang làm việc...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Bắt Đầu Sinh Câu Hỏi AI
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Results & Review List */
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-purple-50 border border-purple-200/50 p-4 text-center">
                  <div className="text-xs text-purple-600 font-medium">Tổng đã sinh</div>
                  <div className="text-2xl font-bold text-purple-900 mt-1">
                    {result.total_generated}
                  </div>
                </div>
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200/50 p-4 text-center">
                  <div className="text-xs text-emerald-600 font-medium">Hợp lệ (Validated)</div>
                  <div className="text-2xl font-bold text-emerald-900 mt-1">
                    {result.valid_count}
                  </div>
                </div>
                <div className="rounded-2xl bg-blue-50 border border-blue-200/50 p-4 text-center">
                  <div className="text-xs text-blue-600 font-medium">Đã lưu Ngân hàng</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">
                    {result.saved_count}
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" /> Danh Sách Câu Hỏi Do AI Sinh Ra ({result.questions.length})
                </h3>

                {result.questions.map((q, idx) => {
                  const isApproved = q.created_question_id && approvedIds.includes(q.created_question_id);
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-3"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                            AI #{idx + 1}
                          </span>
                          <span className="font-semibold text-slate-600">
                            {q.difficulty === 'EASY' ? 'Dễ' : q.difficulty === 'HARD' ? 'Khó' : 'Trung bình'}
                          </span>
                          {q.context_source?.type === 'web' && (
                            <span className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <Globe className="w-3 h-3" /> Real-world Web Context
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> Backend Validated
                          </span>
                        </div>

                        {q.created_question_id && (
                          <div>
                            {isApproved ? (
                              <span className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-xs shadow-sm">
                                <Check className="w-3.5 h-3.5" /> Đã duyệt chính thức
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApproveItem(q)}
                                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 font-semibold text-xs hover:bg-emerald-100 transition border border-emerald-200"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt ngay câu hỏi này
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                        {q.question_text}
                      </div>

                      {/* 4 Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => (
                          <div
                            key={opt.key}
                            className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                              opt.is_correct
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            <span className="font-bold shrink-0">{opt.key}.</span>
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="text-xs bg-amber-50 border border-amber-200/50 p-3 rounded-xl text-amber-900">
                          <span className="font-bold">Lời giải: </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setResult(null)}
                  className="px-4 py-2 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition"
                >
                  Sinh tiếp câu hỏi khác
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md"
                >
                  Đóng & Quay lại Ngân Hàng Câu Hỏi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
