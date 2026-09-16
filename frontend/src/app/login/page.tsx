'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, ArrowRight, Shield, GraduationCap, BookOpen, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

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
      setIsSubmitting(false);
    }
  };

  const fillQuickCredentials = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Đăng nhập hệ thống
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Truy cập nền tảng khảo thí và gia sư trí tuệ nhân tạo
          </p>
        </div>

        {/* Quick Demo Accounts */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Tài khoản dùng thử (1-Click điền thông tin):
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillQuickCredentials('admin@example.com', 'Admin@123')}
              className="flex flex-col items-center justify-center rounded-lg border border-purple-200 bg-purple-50/50 p-2 text-center text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300 transition"
            >
              <Shield className="w-4 h-4 mb-1 text-purple-600" />
              <span>Admin</span>
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials('student@example.com', 'Student@123')}
              className="flex flex-col items-center justify-center rounded-lg border border-blue-200 bg-blue-50/50 p-2 text-center text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 transition"
            >
              <GraduationCap className="w-4 h-4 mb-1 text-blue-600" />
              <span>Học sinh</span>
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials('teacher@example.com', 'Teacher@123')}
              className="flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 text-center text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 transition"
            >
              <BookOpen className="w-4 h-4 mb-1 text-emerald-600" />
              <span>Giáo viên</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-700 dark:bg-rose-950/50 dark:border-rose-900/50 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <span className="inline-block animate-spin">⏳</span>
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-zinc-500">
          Chưa có tài khoản học sinh?{' '}
          <Link href="/register" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
