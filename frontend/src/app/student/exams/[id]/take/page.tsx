'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMathText } from '@/lib/formatMath';
import { StudentExamTakeResponse, StudentQuestionTakeResponse } from '@/types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  HelpCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

export default function ExamTakePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const examId = Number(params?.id);
  const attemptIdParam = searchParams.get('attemptId');

  const [takeData, setTakeData] = useState<StudentExamTakeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exam state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [savingStatus, setSavingStatus] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});

  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const isAutoSubmitting = useRef(false);

  // Submit modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Exam Attempt Data
  useEffect(() => {
    async function initTakeRoom() {
      setLoading(true);
      setError(null);
      try {
        let res: StudentExamTakeResponse;
        if (attemptIdParam) {
          res = await api.getAttemptRoom(Number(attemptIdParam));
        } else {
          res = await api.startExamAttempt(examId);
        }

        setTakeData(res);
        setUserAnswers(res.saved_answers || {});
        setRemainingSeconds(res.remaining_seconds);
      } catch (err: any) {
        console.error('Lỗi khi mở phòng thi:', err);
        setError(err.message || 'Không thể tải phòng thi');
      } finally {
        setLoading(false);
      }
    }

    if (examId) {
      initTakeRoom();
    }
  }, [examId, attemptIdParam]);

  // Submit handler
  const handleFinalSubmit = useCallback(async () => {
    if (!takeData || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await api.submitExamAttempt(takeData.attempt_id);
      router.push(`/student/exams/${examId}/result?attemptId=${result.attempt_id}`);
    } catch (err: any) {
      alert(`Lỗi khi nộp bài: ${err.message}`);
      setIsSubmitting(false);
    }
  }, [takeData, isSubmitting, examId, router]);

  // Server-Authoritative Countdown Timer
  useEffect(() => {
    if (remainingSeconds <= 0 || !takeData) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!isAutoSubmitting.current) {
            isAutoSubmitting.current = true;
            alert('Đã hết thời gian làm bài! Hệ thống đang tự động nộp bài thi của bạn.');
            handleFinalSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, takeData, handleFinalSubmit]);

  // Handle Option Select (Autosave)
  const handleSelectOption = async (questionId: number, optionKey: string) => {
    if (!takeData) return;

    // Update local state immediately
    const updatedAnswers = { ...userAnswers, [questionId]: optionKey };
    setUserAnswers(updatedAnswers);

    // Set saving indicator
    setSavingStatus((prev) => ({ ...prev, [questionId]: 'saving' }));

    try {
      await api.autosaveAnswer(takeData.attempt_id, questionId, optionKey);
      setSavingStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
    } catch (err) {
      console.error(`Autosave failed for question ${questionId}:`, err);
      setSavingStatus((prev) => ({ ...prev, [questionId]: 'error' }));
    }
  };

  // Toggle Flag question
  const toggleFlagQuestion = (questionId: number) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Format Timer Format (HH:MM:SS)
  const formatTimer = (totalSecs: number) => {
    if (totalSecs <= 0) return '00:00';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${remainingMins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-base font-semibold">Đang chuẩn bị đề thi & đồng bộ thời gian máy chủ...</p>
      </div>
    );
  }

  if (error || !takeData) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6">
        <div className="rounded-3xl bg-white p-8 max-w-md text-center border border-slate-200 shadow-xl">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-slate-900">Không thể truy cập đề thi</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'Có lỗi xảy ra khi bắt đầu lượt thi.'}</p>
          <button
            onClick={() => router.push('/student/exams')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 font-semibold rounded-xl text-sm text-white transition shadow-sm"
          >
            Quay lại danh sách đề thi
          </button>
        </div>
      </div>
    );
  }

  const questions = takeData.questions || [];
  const currentQuestion: StudentQuestionTakeResponse | undefined = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const flaggedCount = flaggedQuestions.size;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  const isLowTime = remainingSeconds < 300; // < 5 minutes warning

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Exam Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
              {takeData.subject}
            </span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              Lớp {takeData.grade}
            </span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
            {takeData.title}
          </h1>
        </div>

        {/* Server Authoritative Timer Badge */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold tracking-wider transition ${
              isLowTime
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse shadow-sm'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <Clock className={`w-4 h-4 ${isLowTime ? 'text-rose-600' : 'text-amber-600'}`} />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-white rounded-xl text-sm transition shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Nộp Bài Thi</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 container mx-auto max-w-7xl p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Question & Options (3 cols) */}
        <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
          {currentQuestion ? (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
              {/* Question Header Info */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm">
                    {currentIndex + 1}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Câu {currentIndex + 1} / {totalQuestions} ({currentQuestion.points} điểm)
                  </span>
                  {savingStatus[currentQuestion.id] === 'saving' && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 font-semibold">
                      <Save className="w-3 h-3 animate-spin text-amber-600" /> Đang lưu...
                    </span>
                  )}
                  {savingStatus[currentQuestion.id] === 'saved' && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tự động lưu
                    </span>
                  )}
                </div>

                <button
                  onClick={() => toggleFlagQuestion(currentQuestion.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    flaggedQuestions.has(currentQuestion.id)
                      ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5 text-amber-600" />
                  {flaggedQuestions.has(currentQuestion.id) ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}
                </button>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed mb-8">
                {formatMathText(currentQuestion.content)}
              </div>

              {/* Options List */}
              <div className="space-y-3.5">
                {currentQuestion.options.map((opt) => {
                  const isSelected = userAnswers[currentQuestion.id] === opt.option_key;
                  return (
                    <button
                      key={opt.option_key}
                      onClick={() => handleSelectOption(currentQuestion.id, opt.option_key)}
                      className={`w-full text-left p-4 rounded-2xl border transition flex items-center gap-4 ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-semibold shadow-sm ring-1 ring-blue-500/20'
                          : 'bg-white border-slate-200/90 text-slate-800 hover:border-blue-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-xl font-bold text-sm transition ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}
                      >
                        {opt.option_key}
                      </div>
                      <span className="text-sm sm:text-base font-normal flex-1 text-slate-900">
                        {formatMathText(opt.content)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">Không tìm thấy câu hỏi</div>
          )}

          {/* Bottom Navigation Buttons */}
          <div className="flex items-center justify-between bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-semibold text-sm disabled:opacity-40 hover:bg-slate-200 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Câu trước
            </button>

            <span className="text-xs text-slate-500 font-semibold">
              Câu {currentIndex + 1} trên {totalQuestions}
            </span>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              disabled={currentIndex === totalQuestions - 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-blue-600 bg-blue-600 text-white font-semibold text-sm disabled:opacity-40 hover:bg-blue-700 transition shadow-sm"
            >
              Câu tiếp <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Question Status Grid Palette (1 col) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <span>Danh Sách Câu Hỏi</span>
              <span className="text-xs font-bold text-emerald-600">
                {answeredCount}/{totalQuestions} đã làm
              </span>
            </h3>

            {/* Question Numbers Grid */}
            <div className="grid grid-cols-5 gap-2.5 mb-6">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = !!userAnswers[q.id];
                const isFlagged = flaggedQuestions.has(q.id);

                let btnClass = 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300';
                if (isCurrent) {
                  btnClass = 'bg-blue-600 border-blue-600 text-white font-bold ring-2 ring-blue-500/30 shadow-sm';
                } else if (isFlagged) {
                  btnClass = 'bg-amber-100 border-amber-400 text-amber-900 font-bold';
                } else if (isAnswered) {
                  btnClass = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-semibold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative flex items-center justify-center h-10 rounded-xl border text-xs transition ${btnClass}`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status Legend */}
            <div className="space-y-2 border-t border-slate-100 pt-4 text-xs font-medium">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-400" />
                <span>Đã làm ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-400" />
                <span>Đã đánh dấu ({flaggedCount})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-50 border border-slate-200" />
                <span>Chưa làm ({unansweredCount})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto mb-3 shadow-sm">
                <Send className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Xác Nhận Nộp Bài Thi</h3>
              <p className="text-xs text-slate-500 mt-1">
                Vui lòng kiểm tra lại trước khi hoàn thành lượt làm bài thi.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 text-sm font-medium">
              <div className="flex items-center justify-between text-slate-700">
                <span>Tổng số câu hỏi:</span>
                <span className="font-bold text-slate-900">{totalQuestions} câu</span>
              </div>
              <div className="flex items-center justify-between text-emerald-700">
                <span>Số câu đã trả lời:</span>
                <span className="font-bold">{answeredCount} câu</span>
              </div>
              <div className="flex items-center justify-between text-rose-600">
                <span>Số câu chưa làm:</span>
                <span className="font-bold">{unansweredCount} câu</span>
              </div>
              {flaggedCount > 0 && (
                <div className="flex items-center justify-between text-amber-700">
                  <span>Số câu đánh dấu xem lại:</span>
                  <span className="font-bold">{flaggedCount} câu</span>
                </div>
              )}
              <div className="flex items-center justify-between text-amber-800 border-t border-slate-200 pt-2">
                <span>Thời gian còn lại:</span>
                <span className="font-bold">{formatTimer(remainingSeconds)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition"
              >
                Tiếp Tục Làm Bài
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-600/20"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang nộp...
                  </>
                ) : (
                  'Nộp Bài Thi Ngay'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
