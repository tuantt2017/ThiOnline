'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  User as UserIcon,
  KeyRound,
  GraduationCap,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Shield,
  BookOpen,
} from 'lucide-react';

const GRADES = [4, 5, 6, 7, 8, 9];

export default function AccountSettingsPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  // Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Grade Form State
  const [selectedGrade, setSelectedGrade] = useState<number>(user?.grade || 5);
  const [gradeSubmitting, setGradeSubmitting] = useState(false);
  const [gradeSuccess, setGradeSuccess] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const currentMonth = new Date().getMonth() + 1; // 1 to 12
  const isSchoolYearAllowed = currentMonth >= 8 || user?.role === 'ADMIN';

  useEffect(() => {
    if (user?.grade) {
      setSelectedGrade(user.grade);
    }
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!oldPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không trùng khớp với mật khẩu mới.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      const res = await api.changePassword(oldPassword, newPassword);
      setPasswordSuccess(res.message || 'Đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleUpdateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setGradeSuccess(null);
    setGradeError(null);

    if (!isSchoolYearAllowed) {
      setGradeError(`Chức năng cập nhật khối lớp cho năm học mới chỉ cho phép từ Tháng 8 trở đi. (Hiện tại là Tháng ${currentMonth}).`);
      return;
    }

    setGradeSubmitting(true);
    try {
      const updatedUser = await api.updateStudentGrade(selectedGrade);
      if (refreshUser) {
        await refreshUser();
      }
      setGradeSuccess(`Cập nhật thành công! Khối lớp của bạn đã được chuyển sang Lớp ${updatedUser.grade}.`);
    } catch (err: any) {
      setGradeError(err.message || 'Lỗi khi cập nhật khối lớp.');
    } finally {
      setGradeSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center text-slate-600 text-sm font-semibold">
          Vui lòng đăng nhập để xem thông tin tài khoản.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Back navigation */}
        <Link
          href={user.role === 'STUDENT' ? '/dashboard/student' : user.role === 'TEACHER' ? '/exams' : '/dashboard/admin'}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Bảng điều khiển
        </Link>

        {/* Profile Card Header */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-indigo-500/30">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    {user.full_name}
                  </h1>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-200 border border-white/20">
                    {user.role}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-300 mt-1">
                  Email: <span className="font-mono text-indigo-200">{user.email}</span>
                  {user.grade && <span> • Khối: <strong className="text-amber-400">Lớp {user.grade}</strong></span>}
                </p>
              </div>
            </div>

            <div className="text-xs font-semibold text-indigo-200 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
              Cài Đặt & Bảo Mật Tài Khoản
            </div>
          </div>
        </div>

        {/* Password Change Section */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" /> Đổi Mật Khẩu Tài Khoản
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Cập nhật mật khẩu thường xuyên để bảo vệ an toàn cho tài khoản cá nhân.
            </p>
          </div>

          {passwordSuccess && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật Khẩu Hiện Tại *
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại..."
                className="w-full px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật Khẩu Mới (Tối thiểu 6 ký tự) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                className="w-full px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Xác Nhận Mật Khẩu Mới *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={passwordSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md disabled:opacity-50 transition"
            >
              {passwordSubmitting ? 'Đang cập nhật...' : 'Xác Nhận Đổi Mật Khẩu'}
            </button>
          </form>
        </div>

        {/* Student Grade Update Section */}
        {(user.role === 'STUDENT' || user.role === 'ADMIN') && (
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" /> Cập Nhật Khối Lớp Học Sinh (Năm Học Mới)
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Quy định hệ thống: Học sinh chỉ được tự cập nhật nâng lớp cho năm học mới từ <strong>Tháng 8 hàng năm</strong>.
              </p>
            </div>

            {/* Academic Year Info Banner */}
            <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-3 ${
              isSchoolYearAllowed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <Calendar className={`w-5 h-5 shrink-0 ${isSchoolYearAllowed ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                <div className="font-bold">
                  {isSchoolYearAllowed
                    ? `Hiện tại là Tháng ${currentMonth} — Mở cổng cập nhật khối lớp cho năm học mới!`
                    : `Hiện tại là Tháng ${currentMonth} — Chưa đến thời gian mở năm học mới (Tháng 8 hàng năm).`}
                </div>
                <div className="font-normal text-[11px] mt-0.5">
                  {isSchoolYearAllowed
                    ? 'Bạn có thể lựa chọn khối lớp mới bên dưới để cập nhật danh sách đề thi phù hợp.'
                    : 'Chức năng tự thay đổi khối lớp của học sinh bị tạm khóa đến Tháng 8 để bảo đảm chính xác năm học.'}
                </div>
              </div>
            </div>

            {gradeSuccess && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{gradeSuccess}</span>
              </div>
            )}

            {gradeError && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{gradeError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateGrade} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chọn Khối Lớp Mới (Lớp 4 – 9)
                </label>
                <select
                  value={selectedGrade}
                  disabled={!isSchoolYearAllowed}
                  onChange={(e) => setSelectedGrade(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!isSchoolYearAllowed || gradeSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md disabled:opacity-50 transition"
              >
                {!isSchoolYearAllowed ? (
                  <>
                    <Lock className="w-4 h-4" /> Khóa (Mở Từ Tháng 8)
                  </>
                ) : gradeSubmitting ? (
                  'Đang cập nhật...'
                ) : (
                  'Cập Nhật Khối Lớp'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
