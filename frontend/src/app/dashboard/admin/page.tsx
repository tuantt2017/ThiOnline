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
  UserPlus,
  X,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'TEACHER' | 'STUDENT'>('TEACHER');
  const [newGrade, setNewGrade] = useState<number>(5);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newFullName.trim() || !newEmail.trim() || !newPassword) {
      setCreateError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    setCreatingUser(true);
    try {
      await api.createUser({
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        grade: newRole === 'STUDENT' ? newGrade : undefined,
      });

      setShowCreateModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('TEACHER');
      setSeedNotice(`Tạo tài khoản ${newRole} (${newEmail}) thành công!`);
      await loadData();
      setTimeout(() => setSeedNotice(null), 4000);
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi khi tạo tài khoản.');
    } finally {
      setCreatingUser(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-slate-50 text-slate-800">
        <div className="flex items-center gap-3 text-slate-600 text-sm font-semibold">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Đang tải thông tin quản trị...</span>
        </div>
      </div>
    );
  }

  if (user.role !== 'ADMIN') {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-slate-50">
        <div className="max-w-md text-center p-8 bg-white rounded-3xl border border-rose-200 shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Không có quyền truy cập</h2>
          <p className="mt-2 text-sm text-slate-600">
            Trang này chỉ dành cho người dùng có vai trò <strong>ADMIN</strong>. Tài khoản hiện tại của bạn là <strong>{user.role}</strong>.
          </p>
          <button
            onClick={() => router.push('/dashboard/student')}
            className="mt-6 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
          >
            Chuyển đến Khu Vực Học Sinh
          </button>
        </div>
      </div>
    );
  }

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await api.updateUserStatus(userId, !currentStatus);
      await loadData();
    } catch (err: any) {
      alert(`Lỗi khi cập nhật trạng thái người dùng: ${err.message}`);
    }
  };

  const studentCount = users.filter((u) => u.role === 'STUDENT').length;
  const teacherCount = users.filter((u) => u.role === 'TEACHER').length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200 mb-2">
              <Shield className="w-3.5 h-3.5" /> Bảng Điều Khiển Quản Trị Hệ Thống
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Chào mừng, {user.full_name}
            </h1>
            <p className="text-sm font-medium text-slate-600 mt-1">
              Quản lý tài khoản, duyệt học sinh đăng ký mới và kiểm soát hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-purple-500/20 active:scale-95 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tạo Tài Khoản Mới</span>
            </button>
            <button
              onClick={handleSeedData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Khởi tạo Demo Data</span>
            </button>
            <button
              onClick={loadData}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Modal Create User */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-600" /> Tạo Tài Khoản Mới
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Tạo trực tiếp tài khoản Admin, Giáo viên hoặc Học sinh mới.
                </p>
              </div>

              {createError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vai Trò Tài Khoản (Role) *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="TEACHER">Giáo viên (TEACHER)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                    <option value="STUDENT">Học sinh (STUDENT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và Tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Giáo Viên"
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Địa Chỉ Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="VD: me@example.com"
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật Khẩu *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)..."
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {newRole === 'STUDENT' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Khối Lớp Học Sinh
                    </label>
                    <select
                      value={newGrade}
                      onChange={(e) => setNewGrade(parseInt(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {[4, 5, 6, 7, 8, 9].map((g) => (
                        <option key={g} value={g}>
                          Lớp {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md disabled:opacity-50 transition"
                  >
                    {creatingUser ? 'Đang tạo...' : 'Xác Nhận Tạo Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {seedNotice && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-semibold text-emerald-800 flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{seedNotice}</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-semibold text-rose-800 flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng người dùng</span>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">{users.length}</div>
            <div className="mt-1 text-xs text-slate-500 font-medium">Đã đăng ký trong hệ thống</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Học sinh</span>
              <GraduationCap className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-indigo-600">{studentCount}</div>
            <div className="mt-1 text-xs text-slate-500 font-medium">Vai trò STUDENT</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giáo viên & Admin</span>
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-purple-600">{teacherCount + adminCount}</div>
            <div className="mt-1 text-xs text-slate-500 font-medium">{adminCount} Admin • {teacherCount} Giáo viên</div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái CSDL</span>
              <Database className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-3 text-xl font-bold text-emerald-600 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              {health?.database === 'connected' ? 'Connected' : 'Active'}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-medium">Môi trường: {health?.environment || 'dev'}</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Danh Sách Tài Khoản Người Dùng</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Duyệt kích hoạt học sinh mới đăng ký và quản lý quyền truy cập hệ thống</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {users.length} tài khoản
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">ID</th>
                  <th className="px-6 py-3.5">Họ và Tên</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Vai trò (Role)</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{u.id}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{u.full_name}</td>
                    <td className="px-6 py-4 font-medium text-slate-600">{u.email}</td>
                    <td className="px-6 py-4">
                      {u.role === 'ADMIN' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
                          <Shield className="w-3 h-3" /> ADMIN
                        </span>
                      )}
                      {u.role === 'TEACHER' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          <BookOpen className="w-3 h-3" /> TEACHER
                        </span>
                      )}
                      {u.role === 'STUDENT' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                          <GraduationCap className="w-3 h-3" /> STUDENT
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Đã kích hoạt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" /> Chờ Admin duyệt
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            u.is_active
                              ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                          }`}
                        >
                          {u.is_active ? 'Khóa tài khoản' : 'Phê duyệt Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
