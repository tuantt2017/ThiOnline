'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ExamAttemptResultResponse, AiTutorResponse } from '@/types';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  RotateCcw,
  BookOpen,
  HelpCircle,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Sparkles,
  Lightbulb,
  GraduationCap,
  Bookmark,
} from 'lucide-react';

export default function ExamResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const examId = Number(params?.id);
  const attemptId = Number(searchParams.get('attemptId'));

  const [result, setResult] = useState<ExamAttemptResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Tutor states
  const [tutorData, setTutorData] = useState<AiTutorResponse | null>(null);
  const [isGeneratingTutor, setIsGeneratingTutor] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResult() {
      if (!attemptId) {
        setError('Không tìm thấy thông tin lượt làm bài thi.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await api.getAttemptResult(attemptId);
        setResult(res);
      } catch (err: any) {
        console.error('Lỗi khi tải kết quả thi:', err);
        setError(err.message || 'Không thể tải kết quả thi');
      } finally {
        setLoading(false);
      }
    }

    loadResult();
  }, [attemptId]);

  const handleFetchAiTutor = async () => {
    if (!attemptId) return;
    setIsGeneratingTutor(true);
    setTutorError(null);
    try {
      const tutorRes = await api.getAiTutorFeedback(attemptId);
      setTutorData(tutorRes);
    } catch (err: any) {
      console.error('Lỗi khi gọi Gia Sư AI Tutor:', err);
      setTutorError(err.message || 'Không thể kết nối đến Trợ lý Gia sư AI');
    } finally {
      setIsGeneratingTutor(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Đang chấm điểm & tổng hợp kết quả thi...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="rounded-3xl bg-white border border-slate-200 p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-slate-900">Lỗi tải kết quả</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'Không tìm thấy dữ liệu kết quả thi'}</p>
          <Link
            href="/student/exams"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại danh sách đề thi
          </Link>
        </div>
      </div>
    );
  }

  const scoreFormatted = Number(result.score).toFixed(1);
  const percentageFormatted = Number(result.percentage).toFixed(0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Actions */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/student/exams"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại danh sách đề thi
          </Link>
        </div>

        {/* Big Score Summary Banner */}
        <div
          className={`rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden ${
            result.is_passed
              ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 shadow-emerald-500/10'
              : 'bg-gradient-to-br from-rose-600 via-pink-600 to-amber-700 shadow-rose-500/10'
          }`}
        >
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <Award className="w-72 h-72 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1 text-xs font-semibold mb-3 border border-white/20">
                {result.is_passed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" /> KẾT QUẢ: ĐẠT
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-200" /> KẾT QUẢ: CHƯA ĐẠT
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {result.exam_title}
              </h1>

              <p className="text-xs sm:text-sm text-white/80 mt-1 font-medium">
                Điểm đạt yêu cầu: {result.passing_score} điểm | Trạng thái: {result.status}
              </p>
            </div>

            {/* Score Badge */}
            <div className="flex flex-col items-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 min-w-[200px]">
              <span className="text-xs uppercase tracking-wider font-semibold text-white/80">
                Điểm bài thi
              </span>
              <div className="text-5xl font-black my-1 tracking-tight">
                {scoreFormatted} <span className="text-xl font-medium text-white/70">/ 10.0</span>
              </div>
              <span className="text-xs font-semibold bg-white/20 px-2.5 py-0.5 rounded-full mt-1">
                Tỷ lệ: {percentageFormatted}%
              </span>
            </div>
          </div>
        </div>

        {/* Diamond Reward Celebration Banner */}
        {result.diamonds_awarded !== undefined && result.diamonds_awarded > 0 && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-cyan-500 p-0.5 shadow-lg animate-bounce-short">
            <div className="bg-slate-900/95 backdrop-blur-md rounded-[15px] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-3">
                <span className="text-3xl">💎</span>
                <div>
                  <h4 className="font-extrabold text-base bg-gradient-to-r from-amber-300 to-cyan-300 bg-clip-text text-transparent">
                    Chúc mừng! Bạn được cộng +{result.diamonds_awarded} 💎 Kim Cương!
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {result.score >= 9.0
                      ? 'Thành tích xuất sắc (≥9.0 điểm) nhận 2 Kim Cương!'
                      : 'Hoàn thành bài thi nhận 1 Kim Cương tích lũy đổi quà!'}
                  </p>
                </div>
              </div>

              <Link
                href="/student/rewards"
                className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wider hover:from-amber-300 hover:to-amber-400 transition-all shadow-md shadow-amber-500/20 whitespace-nowrap"
              >
                🎁 Đổi Quà Ngay &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm text-center">
            <span className="text-xs text-slate-500 font-semibold">Số câu đúng</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {result.correct_count} / {result.total_count}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm text-center">
            <span className="text-xs text-slate-500 font-semibold">Số câu sai / bỏ qua</span>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">
              {result.total_count - result.correct_count}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm text-center">
            <span className="text-xs text-slate-500 font-semibold">Tổng điểm đạt được</span>
            <div className="text-2xl font-extrabold text-blue-600 mt-1">
              {scoreFormatted} pt
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm text-center">
            <span className="text-xs text-slate-500 font-semibold">Yêu cầu đạt</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {result.passing_score} pt
            </div>
          </div>
        </div>

        {/* AI Tutor Section (Phase 6 Implementation) */}
        <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-6 sm:p-8 shadow-sm mb-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    Trợ Lý Gia Sư AI Gemini (AI Tutor)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-purple-700 bg-purple-100 border border-purple-200">
                    Phase 6 — Grounding SGK
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Phân tích nguyên nhân sai, hướng dẫn khái niệm cốt lõi SGK và chỉ dẫn phương pháp học lại.
                </p>
              </div>
            </div>

            {!tutorData && (
              <button
                onClick={handleFetchAiTutor}
                disabled={isGeneratingTutor}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
              >
                {isGeneratingTutor ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> AI đang phân tích bài thi...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" /> Nhận Phân Tích AI Tutor
                  </>
                )}
              </button>
            )}
          </div>

          {tutorError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 mb-4">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{tutorError}</span>
            </div>
          )}

          {tutorData && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Overall Summary Advice Banner */}
              <div className="p-5 rounded-2xl bg-white border border-indigo-200 shadow-sm flex items-start gap-3.5">
                <GraduationCap className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-indigo-950 mb-1">
                    Nhận xét & Lời khuyên tổng quan từ Gia sư AI:
                  </h4>
                  <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                    {tutorData.summary_advice}
                  </p>
                </div>
              </div>

              {/* Feedbacks list */}
              {tutorData.feedbacks.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Phân tích chi tiết từng câu trả lời chưa chính xác ({tutorData.feedbacks.length} câu)
                  </h3>

                  {tutorData.feedbacks.map((fb, fIdx) => (
                    <div
                      key={fb.question_id || fIdx}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-indigo-300 transition"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Câu sai #{fIdx + 1}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">
                          Lựa chọn: <span className="font-extrabold text-rose-600">[{fb.selected_option_key}]</span> → Đáp án chuẩn: <span className="font-extrabold text-emerald-600">[{fb.correct_option_key}]</span>
                        </span>
                      </div>

                      <p className="text-sm font-bold text-slate-900 mb-4 leading-relaxed">
                        {fb.question_text}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Why wrong */}
                        <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 text-rose-950 font-medium">
                          <div className="font-extrabold text-rose-800 mb-1 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Tại sao chưa đúng?
                          </div>
                          <p className="leading-relaxed text-slate-800">{fb.why_wrong}</p>
                        </div>

                        {/* Correct concept */}
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 font-medium">
                          <div className="font-extrabold text-emerald-800 mb-1 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Kiến thức chuẩn SGK:
                          </div>
                          <p className="leading-relaxed text-slate-800">{fb.correct_concept}</p>
                        </div>

                        {/* Study hint */}
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950 font-medium">
                          <div className="font-extrabold text-amber-800 mb-1 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600" /> Gợi ý phương pháp ôn tập:
                          </div>
                          <p className="leading-relaxed text-slate-800">{fb.study_hint}</p>
                        </div>

                        {/* Source reference */}
                        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-950 font-medium">
                          <div className="font-extrabold text-blue-800 mb-1 flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-blue-600" /> Nguồn SGK tham chiếu:
                          </div>
                          <p className="leading-relaxed text-slate-800">{fb.source_reference || 'Chương trình SGK GDPT'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detailed Answers Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Chi Tiết Đáp Án & Lời Giải Bài Thi
          </h2>

          <div className="space-y-5">
            {result.detailed_answers?.map((ans, idx) => {
              const isCorrect = ans.is_correct;

              return (
                <div
                  key={ans.question_id}
                  className={`rounded-2xl border p-6 bg-white shadow-sm transition ${
                    isCorrect
                      ? 'border-emerald-200'
                      : 'border-rose-200'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs text-white ${
                          isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        Câu {idx + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Đúng (+{ans.points_earned}đ)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-200">
                          <X className="w-3.5 h-3.5 text-rose-600" /> Sai (0.0đ)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="text-base font-bold text-slate-900 mb-5 leading-relaxed">
                    {ans.question_text}
                  </div>

                  {/* Options List with status */}
                  <div className="space-y-2.5 mb-5">
                    {ans.options?.map((opt) => {
                      const isOptionCorrect = opt.is_correct;
                      const isOptionUserSelected = ans.selected_option_key === opt.option_key;

                      let itemStyle = 'bg-slate-50 border-slate-200 text-slate-800';
                      let badge = null;

                      if (isOptionCorrect) {
                        itemStyle =
                          'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold';
                        badge = (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                            Đáp án đúng
                          </span>
                        );
                      } else if (isOptionUserSelected && !isOptionCorrect) {
                        itemStyle =
                          'bg-rose-50 border-rose-300 text-rose-950 font-bold';
                        badge = (
                          <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            Lựa chọn của bạn (Sai)
                          </span>
                        );
                      }

                      return (
                        <div
                          key={opt.option_key}
                          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between gap-3 ${itemStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-xs w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700">
                              {opt.option_key}
                            </span>
                            <span className="text-slate-900">{opt.content}</span>
                          </div>
                          {badge}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Box */}
                  {ans.explanation && (
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs sm:text-sm text-blue-950 font-medium">
                      <div className="font-bold text-blue-700 mb-1 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-blue-600" /> Lời giải chi tiết:
                      </div>
                      <p className="leading-relaxed text-slate-800">{ans.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
