'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Exam, ExamStatus, ExamAttemptResultResponse } from '@/types';
import {
  GraduationCap,
  Clock,
  BookOpen,
  Layers,
  FileCheck2,
  Play,
  CheckCircle2,
  RefreshCw,
  Award,
  RotateCcw,
  Eye,
  AlertCircle,
} from 'lucide-react';

import AiAdaptivePracticeCard from '@/components/AiAdaptivePracticeCard';

const SUBJECTS = [
  'Toán',
  'Tiếng Việt',
  'Tiếng Anh',
  'Khoa học',
  'Lịch sử & Địa lí',
  'Tin học',
];

const GRADES = [4, 5, 6, 7, 8, 9];

export default function StudentExamsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [myAttempts, setMyAttempts] = useState<ExamAttemptResultResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingExamId, setStartingExamId] = useState<number | null>(null);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'UNCOMPLETED' | 'COMPLETED'>('UNCOMPLETED');

  useEffect(() => {
    if (user?.grade && !selectedGrade) {
      setSelectedGrade(user.grade.toString());
    }
  }, [user]);


  const loadExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const examsRes = await api.getExams({
        subject: selectedSubject || undefined,
        grade: selectedGrade ? parseInt(selectedGrade) : undefined,
        status: ExamStatus.PUBLISHED,
        page: 1,
        page_size: 50,
      });
      setExams(examsRes?.items || []);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        try {
          const attemptsRes = await api.getMyAttempts();
          setMyAttempts(Array.isArray(attemptsRes) ? attemptsRes : []);
        } catch {
          setMyAttempts([]);
        }
      } else {
        setMyAttempts([]);
      }
    } catch (err: any) {
      setExams([]);
      setError(err?.message || 'Không thể kết nối đến máy chủ Backend.');
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, selectedGrade]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const handleStartExam = async (examId: number) => {
    setStartingExamId(examId);
    try {
      const takeRes = await api.startExamAttempt(examId);
      // Navigate to Take page
      router.push(`/student/exams/${examId}/take?attemptId=${takeRes.attempt_id}`);
    } catch (err: any) {
      alert(`Lỗi khi bắt đầu làm bài thi: ${err.message}`);
      setStartingExamId(null);
    }
  };

  // Filter logic for student tabs
  const completedExamIds = new Set(
    myAttempts
      .filter((att) => att.status === 'SUBMITTED' || att.status === 'TIMED_OUT')
      .map((att) => Number(att.exam_id))
  );

  const uncompletedExams = exams.filter((exam) => !completedExamIds.has(Number(exam.id)));
  const completedExams = exams.filter((exam) => completedExamIds.has(Number(exam.id)));
  const displayedExams = activeTab === 'UNCOMPLETED' ? uncompletedExams : completedExams;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Banner / Header */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10 mb-8 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <GraduationCap className="w-80 h-80 text-white" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1 text-xs font-semibold text-blue-100 mb-3 border border-white/20">
              <Award className="w-3.5 h-3.5" /> Khảo Thí Trực Tuyến GDPT Lớp 4 – 9
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Đề Thi Của Tôi
            </h1>
            <p className="text-sm sm:text-base text-blue-100 mt-2 font-normal leading-relaxed">
              Lựa chọn bài thi theo môn học và khối lớp để bắt đầu làm bài. Đề thi đã thi được tách riêng sang mục làm bài & xem lại kết quả.
            </p>
          </div>
        </div>

        {/* AI Adaptive Practice Generator Card */}
        <AiAdaptivePracticeCard className="mb-8" />

        {/* Filter Bar */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Lọc theo Môn học
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả môn học</option>
                {SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Lọc theo Khối lớp
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả khối lớp (4-9)</option>
                {GRADES.map((g) => (
                  <option key={g} value={g.toString()}>
                    Lớp {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center mb-6 shadow-sm">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-rose-900">
              Không thể tải dữ liệu bài thi
            </h3>
            <p className="text-xs font-medium text-rose-700 mt-1 max-w-lg mx-auto">
              {error}
            </p>
            <button
              onClick={loadExams}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử kết nối lại
            </button>
          </div>
        )}

        {/* Student Section Tabs */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('UNCOMPLETED')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'UNCOMPLETED'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>📝 Bài Thi Chưa Làm</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${activeTab === 'UNCOMPLETED' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {uncompletedExams.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>✅ Bài Thi Đã Làm & Kết Quả</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${activeTab === 'COMPLETED' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {completedExams.length}
            </span>
          </button>
        </div>

        {/* Exam Cards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium text-slate-500">Đang tải danh sách bài thi và lịch sử làm bài...</p>
          </div>
        ) : displayedExams.length === 0 ? (
          activeTab === 'UNCOMPLETED' ? (
            <div className="rounded-2xl border border-emerald-200 p-8 text-center bg-emerald-50/50">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-extrabold text-emerald-950">
                🎉 Tuyệt vời! Bạn đã hoàn thành tất cả bài thi!
              </h3>
              <p className="text-sm text-emerald-800 mt-1 max-w-md mx-auto">
                Hiện tại không còn bài thi nào chưa làm. Bạn có thể tự tạo đề mới bằng AI ở mục trên hoặc xem lại bài đã thi trong tab "Bài Thi Đã Làm".
              </p>
              {completedExams.length > 0 && (
                <button
                  onClick={() => setActiveTab('COMPLETED')}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition"
                >
                  Xem Lại Bài Thi Đã Làm ({completedExams.length})
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">
                Chưa có lịch sử làm bài nào
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Sau khi bạn hoàn thành các bài thi, kết quả và nút làm lại bài sẽ xuất hiện tại đây.
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedExams.map((exam) => {

              const examAttempts = myAttempts.filter((att) => Number(att.exam_id) === Number(exam.id));
              const completedAttempt = examAttempts.find(
                (att) => att.status === 'SUBMITTED' || att.status === 'TIMED_OUT'
              );
              const inProgressAttempt = examAttempts.find((att) => att.status === 'IN_PROGRESS');

              const latestAttempt = completedAttempt || inProgressAttempt || examAttempts[0];

              const isCompleted =
                latestAttempt &&
                (latestAttempt.status === 'SUBMITTED' || latestAttempt.status === 'TIMED_OUT');
              const isInProgress = !isCompleted && latestAttempt && latestAttempt.status === 'IN_PROGRESS';

              return (
                <div
                  key={exam.id}
                  className={`rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                    isCompleted
                      ? 'border-emerald-300 ring-1 ring-emerald-500/20'
                      : isInProgress
                      ? 'border-amber-300 ring-1 ring-amber-500/20'
                      : 'border-slate-200 hover:border-blue-400'
                  }`}
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                          {exam.subject}
                        </span>
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                          Lớp {exam.grade}
                        </span>
                      </div>

                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Đã thi ({Number(latestAttempt.score).toFixed(1)}/10)
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          Đang làm dở
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2">
                      {exam.title}
                    </h3>
                    {exam.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed font-normal">
                        {exam.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl mb-5 font-semibold border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Thời gian: {exam.duration_minutes} phút
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-purple-600" />
                        {exam.total_questions} câu hỏi
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-emerald-600" />
                        Thang điểm {exam.total_points}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                        Đạt: {exam.passing_score} điểm
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-3 border-t border-slate-100">
                    {isCompleted ? (
                      <div className="flex items-center gap-2">
                        {/* Xem kết quả */}
                        <Link
                          href={`/student/exams/${exam.id}/result?attemptId=${latestAttempt.attempt_id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-800 border border-slate-200 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          Xem Kết Quả
                        </Link>

                        {/* Làm lại bài thi */}
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          disabled={startingExamId === exam.id}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] transition disabled:opacity-50"
                        >
                          {startingExamId === exam.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Làm Lại Bài
                        </button>
                      </div>
                    ) : isInProgress ? (
                      <button
                        onClick={() => router.push(`/student/exams/${exam.id}/take?attemptId=${latestAttempt.attempt_id}`)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 active:scale-[0.98] transition"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Tiếp Tục Làm Bài
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartExam(exam.id)}
                        disabled={startingExamId === exam.id}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition disabled:opacity-50"
                      >
                        {startingExamId === exam.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Đang chuẩn bị đề thi...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-white" />
                            Vào Làm Bài Thi
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
