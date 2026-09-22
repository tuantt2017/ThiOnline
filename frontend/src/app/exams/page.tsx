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
  Search,
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

  // Filters & View Mode
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [creatorCategory, setCreatorCategory] = useState<'ALL' | 'OFFICIAL' | 'STUDENT_AI'>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getExams({
        subject: selectedSubject || undefined,
        grade: selectedGrade ? parseInt(selectedGrade) : undefined,
        status: selectedStatus || undefined,
        page: 1,
        page_size: 100,
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
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã xuất bản
          </span>
        );
      case ExamStatus.CLOSED:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Đã đóng
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
            Bản nháp
          </span>
        );
    }
  };

  const getCreatorBadge = (role?: string | null, name?: string | null) => {
    if (role === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-800 border border-purple-200">
          <Shield className="w-3 h-3 text-purple-600" /> Admin: {name || 'Hệ thống'}
        </span>
      );
    }
    if (role === 'TEACHER') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 border border-emerald-200">
          <BookOpen className="w-3 h-3 text-emerald-600" /> GV: {name || 'Giáo viên'}
        </span>
      );
    }
    if (role === 'STUDENT') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800 border border-amber-200">
          <GraduationCap className="w-3 h-3 text-amber-600" /> Đề AI tự luyện: {name || 'Học sinh'}
        </span>
      );
    }
    return null;
  };

  // Filter exams by search term and creator category
  const officialCount = exams.filter(e => e.created_by_role !== 'STUDENT' && !e.title.includes('Đề Tự Luyện AI')).length;
  const studentAiCount = exams.filter(e => e.created_by_role === 'STUDENT' || e.title.includes('Đề Tự Luyện AI')).length;

  const filteredExams = exams.filter((exam) => {
    if (searchTerm.trim() && !exam.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (creatorCategory === 'OFFICIAL') {
      if (exam.created_by_role === 'STUDENT' || exam.title.includes('Đề Tự Luyện AI')) {
        return false;
      }
    } else if (creatorCategory === 'STUDENT_AI') {
      if (exam.created_by_role !== 'STUDENT' && !exam.title.includes('Đề Tự Luyện AI')) {
        return false;
      }
    }
    return true;
  });

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
              Danh Sách Quản Lý Đề Thi
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1">
              Phân loại đề thi chính thức của Admin/Giáo viên và đề tự luyện AI của Học sinh. Giao diện bảng thu gọn giúp quản lý hàng trăm bản ghi dễ dàng.
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

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Tổng số đề</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{exams.length}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span className="text-xs font-bold text-purple-600 uppercase">Đề chính thức (Admin/GV)</span>
            <div className="text-2xl font-black text-purple-700 mt-1">{officialCount}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span className="text-xs font-bold text-amber-600 uppercase">Đề AI tự luyện (Học sinh)</span>
            <div className="text-2xl font-black text-amber-700 mt-1">{studentAiCount}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span className="text-xs font-bold text-emerald-600 uppercase">Đã xuất bản</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{exams.filter(e => e.status === 'PUBLISHED').length}</div>
          </div>
        </div>

        {/* Category Tabs & View Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCreatorCategory('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                creatorCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Tất Cả Đề ({exams.length})
            </button>

            <button
              onClick={() => setCreatorCategory('OFFICIAL')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                creatorCategory === 'OFFICIAL'
                  ? 'bg-purple-600 text-white shadow shadow-purple-500/20'
                  : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              👑 Đề Chính Thức Admin & GV ({officialCount})
            </button>

            <button
              onClick={() => setCreatorCategory('STUDENT_AI')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                creatorCategory === 'STUDENT_AI'
                  ? 'bg-amber-600 text-white shadow shadow-amber-500/20'
                  : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              🚀 Đề AI Học Sinh Tự Luyện ({studentAiCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'TABLE' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              📊 Bảng Thu Gọn
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'GRID' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              🎴 Dạng Thẻ (Grid)
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Tìm theo tên đề thi..."
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="DRAFT">Bản nháp (Draft)</option>
                <option value="PUBLISHED">Đã xuất bản (Published)</option>
                <option value="CLOSED">Đã đóng (Closed)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Đang tải danh sách đề thi...</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white">
            <FileCheck2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">
              Không tìm thấy đề thi phù hợp
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Thử điều chỉnh bộ lọc môn học, khối lớp hoặc từ khóa tìm kiếm.
            </p>
          </div>
        ) : viewMode === 'TABLE' ? (
          /* COMPACT TABLE VIEW FOR ADMIN/TEACHER */
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-100/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Tên Đề Thi</th>
                    <th className="px-4 py-3">Môn Học</th>
                    <th className="px-4 py-3">Khối Lớp</th>
                    <th className="px-4 py-3">Nguồn Tạo</th>
                    <th className="px-4 py-3">Thời Gian</th>
                    <th className="px-4 py-3">Số Câu</th>
                    <th className="px-4 py-3">Trạng Thái</th>
                    {isTeacherOrAdmin && <th className="px-4 py-3 text-right">Thao Tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400 font-semibold">#{exam.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 max-w-xs truncate" title={exam.title}>
                        {exam.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {exam.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Lớp {exam.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getCreatorBadge(exam.created_by_role, exam.created_by_name)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">
                        {exam.duration_minutes} phút
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">
                        {exam.total_questions} câu
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(exam.status)}
                      </td>
                      {isTeacherOrAdmin && (
                        <td className="px-4 py-3 text-right space-x-2">
                          {exam.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePublish(exam.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm text-xs"
                            >
                              Xuất bản
                            </button>
                          )}
                          <Link
                            href={`/exams/${exam.id}/report`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded border border-blue-200 text-xs"
                          >
                            <Layers className="w-3 h-3 text-blue-600" /> Báo cáo
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredExams.map((exam) => (
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
