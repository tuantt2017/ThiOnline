'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { LearningRoadmapResponse, TopicMasteryItem } from '@/types';
import {
  Compass,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Award,
  Layers,
  BarChart3,
  Target,
  Zap,
} from 'lucide-react';

const SUBJECTS = [
  'Toán',
  'Tiếng Việt',
  'Tiếng Anh',
  'Khoa học',
  'Lịch sử & Địa lí',
  'Tin học',
];

export default function LearningRoadmapPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [selectedSubject, setSelectedSubject] = useState<string>('Toán');
  const [roadmap, setRoadmap] = useState<LearningRoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingPractice, setCreatingPractice] = useState(false);

  const loadRoadmap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getLearningRoadmap(selectedSubject);
      setRoadmap(data);
    } catch (err: any) {
      console.error('Lỗi khi tải Lộ trình học tập:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject]);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  const handleCreateAdaptivePractice = async () => {
    setCreatingPractice(true);
    try {
      const res = await api.createAdaptivePractice({
        subject: selectedSubject,
        count: 5,
      });
      router.push(`/student/exams/${res.exam_id}/take?attemptId=${res.attempt_id}`);
    } catch (err: any) {
      alert(`Lỗi khi tạo đề tự luyện AI: ${err.message}`);
    } finally {
      setCreatingPractice(false);
    }
  };

  const getStatusBadge = (level: string) => {
    switch (level) {
      case 'MASTERED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 🟢 Đã vững
          </span>
        );
      case 'PRACTICE_NEEDED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> 🟡 Cần rèn luyện
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-extrabold text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> 🔴 Điểm yếu
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-10 -translate-y-6">
            <Compass className="w-80 h-80 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100 border border-white/20 mb-3">
                <Compass className="w-3.5 h-3.5 text-amber-300" /> Phân Tích Cá Nhân Hóa AI (GDPT 2018)
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Lộ Trình Ôn Tập & Bản Đồ Điểm Yếu
              </h1>
              <p className="text-sm font-medium text-blue-100 mt-1 max-w-2xl">
                AI tự động phân tích lịch sử làm bài thi của học sinh <strong>{user?.full_name}</strong> để đo lường Mức độ thành thạo (0% - 100%) từng bài học SGK và hướng dẫn hành động ôn tập mỗi ngày.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateAdaptivePractice}
                disabled={creatingPractice}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 shrink-0"
              >
                <Zap className="w-4 h-4 text-slate-950 fill-current" />
                <span>{creatingPractice ? 'Đang tạo...' : 'Tạo Đề Tự Luyện AI'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Subject Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SUBJECTS.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition shadow-2xs ${
                selectedSubject === sub
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-500">AI đang phân tích kết quả và lập bản đồ điểm yếu...</p>
          </div>
        ) : !roadmap ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
            <p className="text-sm text-slate-500">Không có dữ liệu lộ trình học tập.</p>
          </div>
        ) : (
          <>
            {/* AI Daily Action Box */}
            <div className="rounded-3xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 p-6 shadow-md relative">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full border border-amber-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700 fill-amber-500" /> Hành Động Ôn Tập Hôm Nay (AI Recommended)
                  </div>
                  <div className="text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {roadmap.ai_daily_action}
                  </div>
                </div>

                <button
                  onClick={handleCreateAdaptivePractice}
                  disabled={creatingPractice}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-md active:scale-95 transition disabled:opacity-50 shrink-0"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>{creatingPractice ? 'Đang tạo đề...' : 'Luyện Tập Ngay'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Overview Mastery Score Card */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span>Mức Độ Thành Thạo Tổng Quan</span>
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                  </div>

                  <div className="mt-4 flex items-baseline gap-3">
                    <span className="text-5xl font-black text-slate-900">{roadmap.overall_mastery_percentage}%</span>
                    <span className="text-xs font-bold text-slate-500">Môn {roadmap.subject} Lớp {roadmap.grade}</span>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-3.5 mt-4 overflow-hidden border border-slate-200 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        roadmap.overall_mastery_percentage >= 80
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : roadmap.overall_mastery_percentage >= 50
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                          : 'bg-gradient-to-r from-rose-500 to-orange-500'
                      }`}
                      style={{ width: `${Math.max(5, roadmap.overall_mastery_percentage)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>Dựa trên {roadmap.total_attempts} bài thi đã hoàn thành</span>
                  <span className="text-blue-600 font-bold">GDPT 2018 Standard</span>
                </div>
              </div>

              {/* Status Breakdown Metrics */}
              <div className="lg:col-span-2 grid grid-cols-3 gap-3">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm flex flex-col justify-between text-center">
                  <div className="text-xs font-bold text-emerald-800 uppercase">🟢 Đã Vững</div>
                  <div className="text-3xl font-black text-emerald-700 my-2">{roadmap.mastered_count}</div>
                  <div className="text-[11px] font-semibold text-emerald-800">Chương / Bài</div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm flex flex-col justify-between text-center">
                  <div className="text-xs font-bold text-amber-800 uppercase">🟡 Cần Rèn Luyện</div>
                  <div className="text-3xl font-black text-amber-700 my-2">{roadmap.practice_needed_count}</div>
                  <div className="text-[11px] font-semibold text-amber-800">Chương / Bài</div>
                </div>

                <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm flex flex-col justify-between text-center">
                  <div className="text-xs font-bold text-rose-800 uppercase">🔴 Điểm Yếu</div>
                  <div className="text-3xl font-black text-rose-700 my-2">{roadmap.weak_count}</div>
                  <div className="text-[11px] font-semibold text-rose-800">Chương / Bài</div>
                </div>
              </div>
            </div>

            {/* Detailed Chapter/Lesson Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" /> Bản Đồ Mức Độ Thành Thạo Theo Bài Học SGK
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    Sắp xếp theo thứ tự ưu tiên: 🔴 Điểm yếu cần ôn trước ➔ 🟡 Cần rèn luyện ➔ 🟢 Đã vững
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roadmap.chapter_breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm hover:border-blue-400 transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block">
                          {item.chapter} {item.page_reference ? `• Trang ${item.page_reference}` : ''}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5">
                          {item.lesson}
                        </h3>
                      </div>
                      {getStatusBadge(item.status_level)}
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600">Thành thạo: {item.mastery_percentage}%</span>
                        <span className="text-slate-500 font-semibold">
                          {item.total_questions > 0
                            ? `Đúng ${item.correct_count}/${item.total_questions} câu`
                            : 'Chưa làm câu hỏi nào'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.status_level === 'MASTERED'
                              ? 'bg-emerald-500'
                              : item.status_level === 'PRACTICE_NEEDED'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.max(4, item.mastery_percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
