'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ExamReportResponse, StudentAttemptReport, AttemptStatus } from '@/types';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Users,
  FileCheck2,
  Award,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  X,
  BookOpen,
  GraduationCap,
  Sparkles,
  BarChart3,
} from 'lucide-react';

export default function ExamReportPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const examId = parseInt(resolvedParams.id);

  const { user } = useAuth();
  const router = useRouter();

  const [report, setReport] = useState<ExamReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');

  // Selected attempt detail modal
  const [selectedAttempt, setSelectedAttempt] = useState<StudentAttemptReport | null>(null);

  const loadReport = useCallback(async () => {
    if (!examId || isNaN(examId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExamReport(examId);
      setReport(res);
    } catch (err: any) {
      console.error('Lỗi khi tải báo cáo đề thi:', err);
      setError(err.message || 'Không thể lấy dữ liệu báo cáo đề thi');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    if (user && user.role !== 'TEACHER' && user.role !== 'ADMIN') {
      router.push('/student/exams');
      return;
    }
    loadReport();
  }, [user, loadReport, router]);

  // Filtered student attempts
  const filteredAttempts = (report?.student_attempts || []).filter((att) => {
    const matchesSearch =
      att.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      att.student_email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SUBMITTED' && att.status === AttemptStatus.SUBMITTED) ||
      (statusFilter === 'TIMED_OUT' && att.status === AttemptStatus.TIMED_OUT) ||
      (statusFilter === 'IN_PROGRESS' && att.status === AttemptStatus.IN_PROGRESS);

    const matchesResult =
      resultFilter === 'ALL' ||
      (resultFilter === 'PASSED' && att.is_passed) ||
      (resultFilter === 'FAILED' && !att.is_passed && att.status !== AttemptStatus.IN_PROGRESS);

    return matchesSearch && matchesStatus && matchesResult;
  });

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  if (loading && !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="text-slate-700 font-bold">Đang tải báo cáo tổng hợp kết quả học sinh...</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl border border-rose-200 shadow-sm text-center">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Không thể xem báo cáo</h2>
          <p className="text-slate-600 text-sm mb-6">{error || 'Không tìm thấy thông tin đề thi.'}</p>
          <Link
            href="/exams"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại danh sách đề thi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link
              href="/exams"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition mb-3"
            >
              <ArrowLeft className="w-4 h-4" /> Danh sách đề thi
            </Link>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-indigo-800 bg-indigo-100 border border-indigo-200">
                {report.subject}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-blue-800 bg-blue-100 border border-blue-200">
                Lớp {report.grade}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200">
                {report.duration_minutes} phút
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
                Đạt: {report.passing_score}/{report.total_points} điểm
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Báo cáo kết quả: {report.exam_title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadReport}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-100 transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Tải lại dữ liệu
            </button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng học sinh dự thi</span>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{report.total_attempts}</div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Lượt thi đã khởi tạo</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đã nộp bài / Tỉ lệ đạt</span>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <FileCheck2 className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{report.submitted_count}</span>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {report.pass_rate}% đạt
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {report.pass_count} học sinh đạt từ {report.passing_score}đ
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Điểm trung bình</span>
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-indigo-600">
              {report.avg_score} <span className="text-sm text-slate-400 font-bold">/ {report.total_points}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Điểm số trung bình toàn lớp</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cao nhất / Thấp nhất</span>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xs text-slate-500 block">Cao nhất</span>
                <span className="text-xl font-bold text-emerald-600">{report.highest_score}đ</span>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div>
                <span className="text-xs text-slate-500 block">Thấp nhất</span>
                <span className="text-xl font-bold text-rose-600">{report.lowest_score}đ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm học sinh theo tên hoặc email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-500" /> Trạng thái:
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả bài làm</option>
              <option value="SUBMITTED">Đã nộp bài</option>
              <option value="TIMED_OUT">Hết giờ nộp bài</option>
              <option value="IN_PROGRESS">Đang làm bài</option>
            </select>

            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả kết quả</option>
              <option value="PASSED">Đạt yêu cầu</option>
              <option value="FAILED">Chưa đạt</option>
            </select>
          </div>
        </div>

        {/* Student Attempts Table */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Danh sách bài làm ({filteredAttempts.length} lượt)
            </h2>
          </div>

          {filteredAttempts.length === 0 ? (
            <div className="p-12 text-center">
              <GraduationCap className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-bold">Chưa có lượt bài thi phù hợp</p>
              <p className="text-slate-400 text-xs mt-1">
                Hãy kiểm tra lại bộ lọc tìm kiếm hoặc quay lại sau khi học sinh nộp bài.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3.5">Học sinh</th>
                    <th className="px-6 py-3.5">Trạng thái</th>
                    <th className="px-6 py-3.5">Điểm số</th>
                    <th className="px-6 py-3.5">Số câu đúng</th>
                    <th className="px-6 py-3.5">Thời gian nộp</th>
                    <th className="px-6 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
                  {filteredAttempts.map((att) => (
                    <tr key={att.attempt_id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">{att.student_name}</div>
                        <div className="text-slate-500 text-xs">{att.student_email}</div>
                      </td>

                      <td className="px-6 py-4">
                        {att.status === AttemptStatus.IN_PROGRESS ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Đang làm bài
                          </span>
                        ) : att.status === AttemptStatus.SUBMITTED ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã nộp bài
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Clock className="w-3.5 h-3.5 text-purple-600" /> Nộp do hết giờ
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {att.status === AttemptStatus.IN_PROGRESS ? (
                          <span className="text-slate-400 font-bold">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {att.score} <span className="text-slate-400 font-normal text-xs">/ {report.total_points}</span>
                            </span>
                            {att.is_passed ? (
                              <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ĐẠT ({att.percentage}%)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-rose-100 text-rose-800 border border-rose-200">
                                CHƯA ĐẠT ({att.percentage}%)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {att.status === AttemptStatus.IN_PROGRESS ? (
                          <span className="text-slate-400 font-bold">—</span>
                        ) : (
                          <span className="font-bold text-slate-700">
                            {att.correct_count} / {att.total_count} câu
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(att.submitted_at || att.started_at)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {att.status !== AttemptStatus.IN_PROGRESS ? (
                          <button
                            onClick={() => setSelectedAttempt(att)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-bold hover:bg-blue-100 border border-blue-200 transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Chi tiết bài làm
                          </button>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">Chưa có kết quả</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Question Level Analytics & Option Distribution (Phase 7 Implementation) */}
        {report.question_analytics && report.question_analytics.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Phân Tích Độ Khó & Tỉ Lệ Chọn Phương Án (Question & Option Analytics)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3.5">Câu hỏi</th>
                    <th className="px-6 py-3.5 text-center">Tỉ lệ đúng (%)</th>
                    <th className="px-6 py-3.5 text-center">Số câu Đúng / Sai</th>
                    <th className="px-6 py-3.5 text-center">Phân bổ phương án (A / B / C / D)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
                  {report.question_analytics.map((qa, qIdx) => (
                    <tr key={qa.question_id || qIdx} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 max-w-xs sm:max-w-md">
                        <span className="font-bold text-slate-900 block truncate" title={qa.question_text}>
                          Câu {qIdx + 1}: {qa.question_text}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full font-extrabold text-xs ${
                            qa.accuracy_rate >= 70
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : qa.accuracy_rate >= 40
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {qa.accuracy_rate}%
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-emerald-700">{qa.correct_count} đúng</span>
                        <span className="text-slate-400 mx-1.5">/</span>
                        <span className="font-bold text-rose-600">{qa.wrong_count} sai</span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {['A', 'B', 'C', 'D'].map((key) => {
                            const count = qa.option_distribution?.[key] || 0;
                            return (
                              <span
                                key={key}
                                className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold"
                              >
                                <strong className="text-slate-900">{key}:</strong> {count}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>


      {/* Modal Detailed Student Attempt Breakdown */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Bài làm của {selectedAttempt.student_name}
                  </h3>
                  {selectedAttempt.is_passed ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ĐẠT
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      CHƯA ĐẠT
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Email: {selectedAttempt.student_email} • Nộp bài lúc: {formatDate(selectedAttempt.submitted_at)}
                </p>
              </div>

              <button
                onClick={() => setSelectedAttempt(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Metrics Summary */}
            <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-blue-50/50 border-b border-blue-100 text-xs">
              <div>
                <span className="text-slate-500 block">Điểm số đạt được:</span>
                <span className="text-base font-extrabold text-blue-700">
                  {selectedAttempt.score} / {report.total_points} điểm
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Số câu trả lời đúng:</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {selectedAttempt.correct_count} / {selectedAttempt.total_count} câu ({selectedAttempt.percentage}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Trạng thái:</span>
                <span className="text-base font-bold text-slate-800">
                  {selectedAttempt.status === AttemptStatus.SUBMITTED ? 'Tự nộp bài' : 'Hết giờ tự động nộp'}
                </span>
              </div>
            </div>

            {/* Modal Detailed Question Breakdown */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {(!selectedAttempt.detailed_answers || selectedAttempt.detailed_answers.length === 0) ? (
                <div className="text-center py-8 text-slate-500 font-bold">
                  Không có chi tiết đáp án của lượt thi này.
                </div>
              ) : (
                selectedAttempt.detailed_answers.map((item, qIdx) => (
                  <div
                    key={item.question_id || qIdx}
                    className={`p-5 rounded-2xl border bg-white shadow-sm transition ${
                      item.is_correct ? 'border-emerald-200' : 'border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Câu {qIdx + 1}
                        </span>
                        {item.is_correct ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đúng (+{item.points_earned}đ)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Sai (0đ)
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-bold text-slate-900 mb-4 whitespace-pre-line leading-relaxed">
                      {item.question_text}
                    </p>

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      {item.options?.map((opt) => {
                        const isStudentChoice = item.selected_option_key === opt.option_key;
                        const isCorrectOpt = opt.is_correct || item.correct_option_key === opt.option_key;

                        let styleClasses = 'bg-slate-50 border-slate-200 text-slate-700';
                        if (isCorrectOpt) {
                          styleClasses = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold';
                        } else if (isStudentChoice && !isCorrectOpt) {
                          styleClasses = 'bg-rose-50 border-rose-300 text-rose-900 font-bold';
                        }

                        return (
                          <div
                            key={opt.option_key}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${styleClasses}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                                {opt.option_key}
                              </span>
                              <span>{opt.content}</span>
                            </div>

                            {isCorrectOpt && (
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                Đáp án đúng
                              </span>
                            )}
                            {isStudentChoice && !isCorrectOpt && (
                              <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                                Học sinh chọn
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {item.explanation && (
                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                        <span className="font-bold block mb-0.5 text-amber-950">Giải thích:</span>
                        {item.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedAttempt(null)}
                className="px-5 py-2 bg-slate-700 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
