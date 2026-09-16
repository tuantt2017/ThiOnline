'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap,
  BookOpen,
  Timer,
  Bot,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
} from 'lucide-react';

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
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-zinc-500 text-sm">Đang tải thông tin học sinh...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
            <GraduationCap className="w-3.5 h-3.5" /> Không Gian Khảo Thí & Học Tập Học Sinh
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
            Xin chào, {user.full_name}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Email: <span className="font-mono text-zinc-700 dark:text-zinc-300">{user.email}</span> • Vai trò: <span className="font-semibold text-blue-600">{user.role}</span>
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800/80 dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 mb-4">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Kỳ Thi Trực Tuyến</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Được phân phối tại Phase 5 (Exam Engine): Server-authoritative timer, autosave từng câu trả lời.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>Trạng thái: Đang phát triển</span>
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800/80 dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 mb-4">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Gia Sư AI Tutor</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Được phân phối tại Phase 6: Hướng dẫn sửa bài sai dựa trên kiến thức gốc từ SGK.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>Trạng thái: Đang phát triển</span>
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-200">Xác Thực Phase 1</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              Hệ thống Authentication, Database & Role-Based Access Control đang hoạt động chuẩn xác 100%.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span>Sẵn sàng cho Phase 2</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
