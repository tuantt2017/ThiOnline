'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Exam, ExamStatus } from '@/types';
import {
  FileCheck2,
  Plus,
  Clock,
  BookOpen,
  GraduationCap,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';

const SUBJECTS = [
  'Toán',
  'Tiếng Việt',
  'Tiếng Anh',
  'Khoa học',
  'Lịch sử & Địa lí',
  'Tin học',
];

const GRADES = [4, 5, 6, 7, 8, 9];

export default function ExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getExams({
        subject: selectedSubject || undefined,
        grade: selectedGrade ? parseInt(selectedGrade) : undefined,
        status: selectedStatus || undefined,
        page: 1,
        page_size: 50,
      });
      setExams(res.items || []);
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách đề thi:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, selectedGrade, selectedStatus]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const handlePublish = async (id: number) => {
    try {
      await api.publishExam(id);
      loadExams();
    } catch (err: any) {
      alert(`Lỗi khi xuất bản đề thi: ${err.message}`);
    }
  };

  const getStatusBadge = (st: ExamStatus) => {
    switch (st) {
      case ExamStatus.PUBLISHED:
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã xuất bản
          </span>
        );
      case ExamStatus.CLOSED:
        return (
          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Đã đóng
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
            Bản nháp
          </span>
        );
    }
  };

  const getCreatorBadge = (role?: string | null, name?: string | null) => {
    if (role === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-800 border border-purple-200">
          <Shield className="w-3 h-3 text-purple-600" /> Tạo bởi Admin: {name || 'Hệ thống'}
        </span>
      );
    }
    if (role === 'TEACHER') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 border border-emerald-200">
          <BookOpen className="w-3 h-3 text-emerald-600" /> Tạo bởi GV: {name || 'Giáo viên'}
        </span>
      );
    }
    if (role === 'STUDENT') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800 border border-amber-200">
          <GraduationCap className="w-3 h-3 text-amber-600" /> Đề tự luyện AI: {name || 'Học sinh'}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
              <GraduationCap className="w-4 h-4" /> Quản Lý Kỳ Thi & Đề Thi GDPT (Lớp 4 – 9)
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
              Danh Sách Đề Thi
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1">
              Tạo đề thi chuẩn hóa, cấu hình thời gian Server-Authoritative, chọn câu hỏi và xuất bản.
            </p>
          </div>

          {isTeacherOrAdmin && (
            <div className="flex items-center gap-3">
              <Link
                href="/exams/create"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
                Tạo Đề Thi Mới
              </Link>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm my-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả môn học</option>
                {SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả khối lớp (4-9)</option>
                {GRADES.map((g) => (
                  <option key={g} value={g.toString()}>
                    Lớp {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="DRAFT">Bản nháp (Draft)</option>
                <option value="PUBLISHED">Đã xuất bản (Published)</option>
                <option value="CLOSED">Đã đóng (Closed)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Exams Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Đang tải danh sách đề thi...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white">
            <FileCheck2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">
              Chưa có đề thi nào
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Tạo đề thi mới để giao bài cho học sinh và bắt đầu kỳ thi trực tuyến.
            </p>
            {isTeacherOrAdmin && (
              <div className="mt-6">
                <Link
                  href="/exams/create"
                  className="px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
                >
                  Tạo Đề Thi Ngay
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:border-blue-400 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {exam.subject}
                      </span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Lớp {exam.grade}
                      </span>
                    </div>
                    {getStatusBadge(exam.status)}
                  </div>

                  {getCreatorBadge(exam.created_by_role, exam.created_by_name) && (
                    <div className="mb-2">
                      {getCreatorBadge(exam.created_by_role, exam.created_by_name)}
                    </div>
                  )}

                  <h3 className="text-base font-bold text-slate-900 leading-snug mb-2">
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 mb-4 font-normal">
                      {exam.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl mb-4 font-semibold border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {exam.duration_minutes} phút
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      {exam.total_questions} câu hỏi
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                      Thang điểm {exam.total_points}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                      Đạt: {exam.passing_score} điểm
                    </div>
                  </div>
                </div>

                {isTeacherOrAdmin && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2 text-xs flex-wrap gap-2">
                    {exam.status === 'DRAFT' ? (
                      <button
                        onClick={() => handlePublish(exam.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Xuất bản đề
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã xuất bản
                      </span>
                    )}

                    <Link
                      href={`/exams/${exam.id}/report`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-bold hover:bg-blue-100 border border-blue-200 transition"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" /> Báo cáo kết quả
                    </Link>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
