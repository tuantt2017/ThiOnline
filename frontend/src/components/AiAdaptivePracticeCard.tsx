'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Sparkles,
  Zap,
  RefreshCw,
  ArrowRight,
  Target,
  Brain,
  CheckCircle2,
} from 'lucide-react';

const SUBJECTS = [
  'Toán',
  'Tiếng Việt',
  'Tiếng Anh',
  'Khoa học',
  'Lịch sử & Địa lí',
  'Tin học',
];

interface Props {
  className?: string;
  defaultSubject?: string;
}

export default function AiAdaptivePracticeCard({ className = '', defaultSubject = 'Toán' }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState<string>(defaultSubject);
  const [count, setCount] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePractice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.createAdaptivePractice({
        subject,
        count,
      });

      // Automatically redirect straight into taking the exam
      router.push(`/student/exams/${res.exam_id}/take?attemptId=${res.attempt_id}`);
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo đề tự luyện AI.');
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-3xl border border-indigo-200/90 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden ${className}`}>
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Header Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-400/30 px-3.5 py-1 text-xs font-bold text-amber-300 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Tính Năng AI Đột Phá Cho Học Sinh
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-400 shrink-0" />
              Tạo Đề Tự Luyện AI Cá Nhân Hóa
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl font-normal leading-relaxed">
              AI phân tích tự động các câu bạn từng làm sai trong lịch sử để sinh bộ đề xoáy sâu đúng vào <strong>điểm yếu</strong>. Nếu bạn chưa thi bài nào, AI sẽ khởi tạo bộ đề tổng hợp chuẩn SGK để bạn luyện tập cấp tốc.
            </p>
          </div>
        </div>

        {/* Configuration Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* Select Subject */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 space-y-1">
            <label className="block text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
              1. Chọn Môn Học
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-950/80 border border-indigo-300/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {SUBJECTS.map((sub) => (
                <option key={sub} value={sub} className="bg-slate-900 text-white">
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Select Question Count */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 space-y-1">
            <label className="block text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
              2. Số Lượng Câu Hỏi
            </label>
            <div className="flex items-center gap-1.5 pt-0.5">
              {[3, 5, 10, 15].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={loading}
                  onClick={() => setCount(num)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition ${
                    count === num
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md font-extrabold'
                      : 'bg-slate-950/60 text-slate-200 border-white/10 hover:bg-white/20'
                  }`}
                >
                  {num} câu
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="sm:col-span-2 lg:col-span-1 flex items-end">
            <button
              type="button"
              onClick={handleCreatePractice}
              disabled={loading}
              className="w-full h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>AI Đang Phân Tích & Khởi Tạo Đề...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Tạo Đề Tự Luyện & Vào Làm Ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 p-3 text-xs font-semibold text-rose-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
