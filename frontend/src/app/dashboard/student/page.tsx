'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap,
  BookOpen,
  Timer,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';

import AiAdaptivePracticeCard from '@/components/AiAdaptivePracticeCard';

export default function StudentDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-slate-50">
        <div className="text-slate-600 text-sm font-semibold">Đang tải thông tin học sinh...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 mb-2">
              <GraduationCap className="w-3.5 h-3.5" /> Không Gian Khảo Thí & Học Tập Học Sinh
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Xin chào, {user.full_name}
            </h1>
            <p className="text-sm font-medium text-slate-600 mt-1">
              Email: <span className="font-mono text-slate-800 font-semibold">{user.email}</span> • Vai trò: <span className="font-bold text-blue-600">{user.role}</span>
            </p>
          </div>

          {user.role === 'ADMIN' && (
            <button
              onClick={() => router.push('/dashboard/admin')}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition"
            >
              <Shield className="w-4 h-4" /> Bảng Quản Trị Admin
            </button>
          )}
        </div>

        {/* AI Adaptive Practice Generator Component */}
        <AiAdaptivePracticeCard />

        {/* Word Scramble Game Banner Card */}
        <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-slate-950 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative overflow-hidden">
          <div className="space-y-1.5 z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 text-amber-400 font-extrabold text-xs shadow-sm uppercase tracking-wider">
              <span>👑</span> Game Show Trí Tuệ Học Đường
            </div>
            <h2 className="text-2xl font-black text-slate-950 tracking-tight">
              Đấu Trường "Vua Từ Vựng SGK"
            </h2>
            <p className="text-xs font-semibold text-slate-900 leading-relaxed">
              Giải trí cực vui cùng trò chơi xếp từ đảo lộn môn <strong>Tiếng Việt</strong> (từ ghép, thành ngữ) & <strong>Tiếng Anh</strong> (vựng SGK Lớp 4–9). Nhận ngay <strong>1 💎 Kim Cương</strong> khi đạt chuỗi <strong>7 câu đúng liên tiếp</strong> (tối đa 2 💎/ngày)!
            </p>

          </div>

          <button
            type="button"
            onClick={() => router.push('/student/games/word-scramble')}
            className="z-10 shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 hover:bg-slate-900 text-amber-400 font-black px-6 py-3.5 text-xs shadow-xl active:scale-95 transition"
          >
            <span>Vào Chơi Vua Từ Vựng</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1: Kỳ thi trực tuyến */}
          <div className="rounded-3xl border border-blue-200/90 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-blue-400 transition">
            <div>
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-4 shadow-md shadow-blue-500/20">
                <Timer className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Kỳ Thi Trực Tuyến</h3>
              <p className="text-xs font-normal text-slate-600 mt-1 leading-relaxed">
                Lựa chọn bài thi theo khối lớp 4 – 9, làm bài thi với bộ đếm giờ tự động và nhận kết quả chi tiết ngay lập tức.
              </p>
            </div>
            <button
              onClick={() => router.push('/student/exams')}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 text-xs transition shadow-sm"
            >
              Vào Làm Bài Thi <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Bản đồ tri thức */}
          <div className="rounded-3xl border border-purple-200/90 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-purple-400 transition">
            <div>
              <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center text-white mb-4 shadow-md shadow-purple-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Bản Đồ Tri Thức SGK</h3>
              <p className="text-xs font-normal text-slate-600 mt-1 leading-relaxed">
                Khám phá cấu trúc chương bài học Sách giáo khoa, xem cây kiến thức trọng tâm và định hướng nội dung ôn tập.
              </p>
            </div>
            <button
              onClick={() => router.push('/knowledge-map')}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 text-xs transition shadow-sm"
            >
              Xem Bản Đồ Tri Thức <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Ngân hàng câu hỏi */}
          <div className="rounded-3xl border border-emerald-200/90 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-emerald-400 transition">
            <div>
              <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white mb-4 shadow-md shadow-emerald-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Ngân Hàng Câu Hỏi</h3>
              <p className="text-xs font-normal text-slate-600 mt-1 leading-relaxed">
                Tra cứu bộ câu hỏi trắc nghiệm theo từng môn học, mức độ khó và xem gợi ý giải thích bài tập.
              </p>
            </div>
            <button
              onClick={() => router.push('/questions')}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 text-xs transition shadow-sm"
            >
              Xem Ngân Hàng Câu Hỏi <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
