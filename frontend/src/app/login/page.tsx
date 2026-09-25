'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Lock,
  Mail,
  ArrowRight,
  Shield,
  GraduationCap,
  BookOpen,
  AlertCircle,
  Zap,
  X,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);

  const [isSlowConnecting, setIsSlowConnecting] = useState(false);
  const [isServerReady, setIsServerReady] = useState(false);

  const { login, demoLogin } = useAuth();
  const router = useRouter();

  // Active Pre-warm backend on login page mount (polls until online)
  React.useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const checkServer = async () => {
      try {
        const { api } = await import('@/lib/api');
        await api.getHealth();
        if (isMounted) {
          setIsServerReady(true);
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch {
        // Keep polling until server wakes up
      }
    };

    checkServer();
    pollInterval = setInterval(checkServer, 3500);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    setIsSlowConnecting(false);

    const slowTimer = setTimeout(() => {
      setIsSlowConnecting(true);
    }, 2500);

    try {
      const user = await login(email, password);
      if (user.role === 'ADMIN') {
        router.push('/dashboard/admin');
      } else {
        router.push('/dashboard/student');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      clearTimeout(slowTimer);
      setIsSubmitting(false);
      setIsSlowConnecting(false);
    }
  };

  const handleDemoSelect = async (role: string) => {
    if (isDemoSubmitting) return;
    setError(null);
    setIsDemoSubmitting(true);
    setIsSlowConnecting(false);

    const slowTimer = setTimeout(() => {
      setIsSlowConnecting(true);
    }, 2500);

    try {
      const user = await demoLogin(role);
      setShowDemoModal(false);
      if (user.role === 'ADMIN') {
        router.push('/dashboard/admin');
      } else {
        router.push('/dashboard/student');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tạo phiên dùng thử demo.');
    } finally {
      clearTimeout(slowTimer);
      setIsDemoSubmitting(false);
      setIsSlowConnecting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50 relative">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Đăng nhập hệ thống
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Truy cập nền tảng khảo thí và gia sư trí tuệ nhân tạo
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-800 font-semibold shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {isSlowConnecting && (
            <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-300 p-3.5 text-xs text-amber-900 font-extrabold shadow-xs animate-pulse">
              <Sparkles className="w-4.5 h-4.5 text-amber-600 animate-spin shrink-0" />
              <div>
                <span className="block font-black text-amber-950">⚡ Máy chủ AI đang khởi động (Cold Start)...</span>
                <span className="text-[11px] font-semibold text-amber-800 leading-tight block mt-0.5">
                  Vui lòng giữ nguyên màn hình, đăng nhập sẽ tự động hoàn tất trong vài giây!
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isDemoSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block animate-spin">⏳</span>
                <span>Đang xử lý đăng nhập...</span>
              </span>
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
          <div>
            Chưa có tài khoản?{' '}
            <Link href="/register" className="font-bold text-blue-600 hover:underline">
              Đăng ký ngay
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setShowDemoModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-bold border border-amber-200 hover:bg-amber-100 transition shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
            <span>⚡ Dùng thử nhanh</span>
          </button>
        </div>
      </div>

      {/* Demo Role Selector Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-6 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-2xl text-amber-700">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">⚡ Chọn Vai Trò Dùng Thử</h3>
                  <p className="text-xs text-slate-500 font-medium">Trải nghiệm tức thì không cần đăng ký</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning / Sandbox Info Alert */}
            <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-900 font-medium leading-relaxed">
              <strong>🔒 Phân vùng Demo Sandbox:</strong> Tài khoản trải nghiệm được cấp giới hạn lượt sử dụng các tính năng cao cấp (AI, Khảo thí, Quà tặng). Toàn bộ dữ liệu trải nghiệm được bảo mật riêng biệt.
            </div>

            {/* Role Options */}
            <div className="space-y-3">
              <button
                type="button"
                disabled={isDemoSubmitting}
                onClick={() => handleDemoSelect('STUDENT')}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 hover:border-blue-300 text-left transition shadow-sm group"
              >
                <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md group-hover:scale-105 transition">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-blue-950">Học Sinh (Demo Sandbox)</div>
                  <div className="text-xs text-blue-700">Thử nghiệm làm bài thi AI, Gia sư AI, Đổi quà</div>
                </div>
              </button>

              <button
                type="button"
                disabled={isDemoSubmitting}
                onClick={() => handleDemoSelect('TEACHER')}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-300 text-left transition shadow-sm group"
              >
                <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md group-hover:scale-105 transition">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-emerald-950">Giáo Viên (Demo Sandbox)</div>
                  <div className="text-xs text-emerald-700">Thử nghiệm sinh câu hỏi AI, Giám sát lớp học</div>
                </div>
              </button>

              <button
                type="button"
                disabled={isDemoSubmitting}
                onClick={() => handleDemoSelect('ADMIN')}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 hover:border-purple-300 text-left transition shadow-sm group"
              >
                <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md group-hover:scale-105 transition">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-purple-950">Quản Trị Viên (Demo Sandbox)</div>
                  <div className="text-xs text-purple-700">Khám phá giao diện Admin & Ngân hàng đề</div>
                </div>
              </button>
            </div>

            {isDemoSubmitting && (
              <div className="text-center text-xs font-bold text-amber-700 animate-pulse">
                ⏳ Đang khởi tạo môi trường Demo Sandbox...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
