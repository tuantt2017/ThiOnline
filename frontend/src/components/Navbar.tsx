'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  GraduationCap,
  LogOut,
  User as UserIcon,
  Shield,
  BookOpen,
  Activity,
} from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api.getHealth()
      .then((res) => setIsBackendHealthy(res.status === 'healthy'))
      .catch(() => setIsBackendHealthy(false));
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'TEACHER':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <BookOpen className="w-3 h-3" /> Giáo viên
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <GraduationCap className="w-3 h-3" /> Học sinh
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 transition-all">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Online Exam <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI</span>
            </span>
            <span className="text-[10px] font-medium text-zinc-500 tracking-wider uppercase">
              Hệ Thống Thi & Khảo Thí AI
            </span>
          </div>
        </Link>

        {/* System Health indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
          <span className="flex h-2 w-2 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isBackendHealthy === true
                  ? 'bg-emerald-400'
                  : isBackendHealthy === false
                  ? 'bg-rose-400'
                  : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isBackendHealthy === true
                  ? 'bg-emerald-500'
                  : isBackendHealthy === false
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
              }`}
            />
          </span>
          <span>
            {isBackendHealthy === true
              ? 'API & DB Sẵn sàng'
              : isBackendHealthy === false
              ? 'Mất kết nối Backend'
              : 'Đang kiểm tra API...'}
          </span>
        </div>

        {/* User Auth Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href={user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/student'}
                className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 transition"
              >
                <div className="hidden sm:flex flex-col items-end">
                  <span className="font-semibold">{user.full_name}</span>
                  {getRoleBadge(user.role)}
                </div>
              </Link>
              <button
                onClick={logout}
                title="Đăng xuất"
                className="flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
