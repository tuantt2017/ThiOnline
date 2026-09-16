'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { User, SystemHealth } from '@/types';
import {
  Shield,
  Users,
  Database,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Server,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadData = async () => {
    setIsFetching(true);
    setError(null);
    try {
      const [userList, healthRes] = await Promise.all([
        api.getUsers(),
        api.getHealth(),
      ]);
      setUsers(userList);
      setHealth(healthRes);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách dữ liệu.');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadData();
    }
  }, [user]);

  const handleSeedData = async () => {
    try {
      const res = await api.seedUsers();
      setSeedNotice(`Đã tạo/kiểm tra dữ liệu mẫu: ${res.created_users.length} tài khoản mới.`);
      await loadData();
      setTimeout(() => setSeedNotice(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi khởi tạo dữ liệu mẫu.');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Đang tải thông tin quản trị...</span>
        </div>
      </div>
    );
  }

  if (user.role !== 'ADMIN') {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="max-w-md text-center p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-rose-200 dark:border-rose-900 shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Không có quyền truy cập</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Trang này chỉ dành cho người dùng có vai trò <strong>ADMIN</strong>. Tài khoản hiện tại của bạn là <strong>{user.role}</strong>.
          </p>
          <button
            onClick={() => router.push('/dashboard/student')}
            className="mt-6 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Chuyển đến Khu Vực Học Sinh
          </button>
        </div>
      </div>
    );
  }

  const studentCount = users.filter((u) => u.role === 'STUDENT').length;
  const teacherCount = users.filter((u) => u.role === 'TEACHER').length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
            <Shield className="w-3.5 h-3.5" /> Bảng Điều Khiển Quản Trị Hệ Thống
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
            Chào mừng, {user.full_name}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Quản lý tài khoản, kiểm soát trạng thái kết nối cơ sở dữ liệu và cấu hình Phase 1.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeedData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Khởi tạo Demo Data</span>
          </button>
          <button
            onClick={loadData}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {seedNotice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-900/50 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{seedNotice}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 dark:bg-rose-950/50 dark:border-rose-900/50 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800/80 dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tổng người dùng</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-zinc-900 dark:text-white">{users.length}</div>
          <div className="mt-1 text-xs text-zinc-500 font-medium">Đã đăng ký trong hệ thống</div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800/80 dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Học sinh</span>
            <GraduationCap className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{studentCount}</div>
          <div className="mt-1 text-xs text-zinc-500 font-medium">Vai trò STUDENT</div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800/80 dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Giáo viên & Admin</span>
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-purple-600 dark:text-purple-400">{teacherCount + adminCount}</div>
          <div className="mt-1 text-xs text-zinc-500 font-medium">{adminCount} Admin • {teacherCount} Giáo viên</div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800/80 dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Trạng thái CSDL</span>
            <Database className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            {health?.database === 'connected' ? 'Connected' : 'Active'}
          </div>
          <div className="mt-1 text-xs text-zinc-500 font-medium">Môi trường: {health?.environment || 'dev'}</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Danh Sách Tài Khoản Người Dùng</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Dữ liệu lấy từ API có xác thực Bearer Token (RBAC Admin-only)</p>
          </div>
          <span className="text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
            {users.length} tài khoản
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 text-xs uppercase font-semibold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5">ID</th>
                <th className="px-6 py-3.5">Họ và Tên</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Vai trò (Role)</th>
                <th className="px-6 py-3.5">Trạng thái</th>
                <th className="px-6 py-3.5">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition">
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">#{u.id}</td>
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">{u.full_name}</td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">
                    {u.role === 'ADMIN' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <Shield className="w-3 h-3" /> ADMIN
                      </span>
                    )}
                    {u.role === 'TEACHER' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <BookOpen className="w-3 h-3" /> TEACHER
                      </span>
                    )}
                    {u.role === 'STUDENT' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <GraduationCap className="w-3 h-3" /> STUDENT
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Hoạt động
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-400">
                    {new Date(u.created_at).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
