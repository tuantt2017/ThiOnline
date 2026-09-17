'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { api, ApiError } from '@/lib/api';
import {
  TeacherClassOverviewResponse,
  StudentRiskItem,
  ClassKnowledgeGapItem,
  StudentAiEvaluationResponse,
  User,
} from '@/types';
import {
  Sparkles,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Users,
  Send,
  ClipboardCheck,
  RefreshCw,
  Search,
  BookOpen,
  X,
  ArrowLeft,
  Filter,
} from 'lucide-react';

const SUBJECT_OPTIONS = ['Toán', 'Tiếng Việt', 'Tiếng Anh', 'Khoa học', 'Lịch sử & Địa lí'];
const GRADE_OPTIONS = [4, 5, 6, 7, 8, 9];

export default function TeacherAnalyticsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [data, setData] = useState<TeacherClassOverviewResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  // Evaluation Modal State
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalData, setEvalData] = useState<StudentAiEvaluationResponse | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);

  // Remedial Assignment Modal State
  const [remedialModalOpen, setRemedialModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [remedialTopic, setRemedialTopic] = useState('');
  const [remedialCount, setRemedialCount] = useState(5);
  const [submittingRemedial, setSubmittingRemedial] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, [subject, grade]);

  const checkAuthAndLoad = async () => {
    setLoading(true);
    setError('');
    try {
      const me = await api.getMe();
      if (me.role !== 'TEACHER' && me.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }
      setCurrentUser(me);

      const res = await api.getTeacherClassAnalytics(subject, grade);
      setData(res);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
      } else {
        setError(err.message || 'Không thể tải dữ liệu phân tích lớp học.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFetchEvaluation = async (studentId: number) => {
    setEvalLoading(true);
    setEvalModalOpen(true);
    setEvalData(null);
    setCopiedNote(false);
    try {
      const res = await api.getStudentAiEvaluation(studentId);
      setEvalData(res);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi sinh báo cáo nhận xét AI.');
      setEvalModalOpen(false);
    } finally {
      setEvalLoading(false);
    }
  };

  const handleOpenRemedialModal = (targetStudentId?: number, defaultTopic?: string) => {
    if (targetStudentId) {
      setSelectedStudentIds([targetStudentId]);
    } else {
      // Default to high risk and monitor students
      const weakIds = data?.risk_students
        .filter((s) => s.risk_level === 'HIGH_RISK' || s.risk_level === 'MONITOR')
        .map((s) => s.student_id) || [];
      setSelectedStudentIds(weakIds);
    }
    setRemedialTopic(defaultTopic || (data?.class_knowledge_gaps[0]?.lesson || `Ôn tập trọng tâm môn ${subject}`));
    setRemedialCount(5);
    setRemedialModalOpen(true);
  };

  const handleAssignRemedialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 học sinh để giao bài thi.');
      return;
    }

    setSubmittingRemedial(true);
    try {
      const res = await api.assignRemedialPractice({
        student_ids: selectedStudentIds,
        subject,
        grade,
        topic: remedialTopic,
        question_count: remedialCount,
      });
      setSuccessMsg(res.message);
      setRemedialModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi giao bài tự luyện khắc phục điểm yếu.');
    } finally {
      setSubmittingRemedial(false);
    }
  };

  const copyParentNoteToClipboard = () => {
    if (evalData?.parent_note) {
      navigator.clipboard.writeText(evalData.parent_note);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 3000);
    }
  };

  // Filtering students
  const filteredStudents = data?.risk_students.filter((s) => {
    const matchesSearch =
      s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = filterRisk === 'ALL' || s.risk_level === filterRisk;
    return matchesSearch && matchesRisk;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/dashboard/teacher')}
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại Dashboard
          </button>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" /> GDPT 2018 Standard
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-8 h-8 text-indigo-600" />
                Trợ Lý AI Quản Lý &amp; Giám Sát Lớp Học
              </h1>
              <p className="mt-1 text-sm md:text-base text-slate-600">
                Phân tích rủi ro học tập, nhận diện lỗ hổng kiến thức chuẩn SGK và tạo nhận xét học sinh tự động 1-click.
              </p>
            </div>

            {/* Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Môn học</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {SUBJECT_OPTIONS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Khối lớp</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={checkAuthAndLoad}
                disabled={loading}
                className="mt-5 inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Tải lại
              </button>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-sm font-medium animate-fade-in">
            <div className="flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 flex-shrink-0" />
              {successMsg}
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-sm font-medium">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-rose-600 flex-shrink-0" />
              {error}
            </div>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Đang phân tích dữ liệu học sinh &amp; lỗ hổng kiến thức bằng AI...</p>
          </div>
        ) : data ? (
          <>
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sĩ số học sinh</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{data.total_students} em</h3>
                  <p className="text-xs text-slate-500 mt-1">Khối Lớp {data.grade}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Điểm TB Lớp</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{data.avg_class_score} / 10</h3>
                  <p className="text-xs text-slate-500 mt-1">Môn {data.subject}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <FileCheck2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tỷ lệ Đạt yêu cầu</p>
                  <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{data.pass_rate}%</h3>
                  <p className="text-xs text-slate-500 mt-1">Trên tổng bài làm</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Phân loại Rủi ro AI</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                      🔴 {data.high_risk_count}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      🟡 {data.monitor_count}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      🟢 {data.good_count}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* AI Strategic Teaching Advice Card */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 md:p-8 text-white shadow-lg mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md flex-shrink-0">
                  <Sparkles className="w-7 h-7 text-amber-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-200 flex items-center gap-2">
                    Chiến Lược Giảng Dạy Khuyên Dùng Từ AI Sư Phạm
                  </h3>
                  <div className="mt-2 text-sm text-indigo-100 whitespace-pre-line leading-relaxed">
                    {data.ai_teaching_advice}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleOpenRemedialModal()}
                      className="inline-flex items-center px-4 py-2 bg-amber-400 hover:bg-amber-300 text-indigo-950 text-xs font-extrabold rounded-xl transition shadow-sm"
                    >
                      <Send className="w-4 h-4 mr-1.5" /> Giao Đề Khắc Phục Cho Nhóm Yếu (1-Click)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Class Knowledge Gaps Grid */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Bản Đồ Lỗ Hổng Kiến Thức Toàn Lớp (SGK Grounded)
                </h2>
                <span className="text-xs font-semibold text-slate-500">
                  Top bài học có tỷ lệ làm sai cao nhất
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {data.class_knowledge_gaps.map((gap, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 mb-1">
                          {gap.chapter}
                        </span>
                        <h4 className="text-base font-bold text-slate-900">{gap.lesson}</h4>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">
                          {gap.error_rate}% làm sai
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">{gap.affected_students_count} học sinh mắc lỗi</p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-700">
                      <strong className="text-indigo-900 font-semibold block mb-1">💡 Gợi ý cho giáo viên:</strong>
                      {gap.teaching_recommendation}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => handleOpenRemedialModal(undefined, gap.lesson)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center"
                      >
                        Tạo bài thi tự luyện bài này &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Student Risk Analytics & Assessment Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-12">
              <div className="p-5 md:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Danh Sách &amp; Phân Loại Rủi Ro Học Sinh ({data.risk_students.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click "Nhận xét AI" để xuất báo cáo 1-click gửi phụ huynh
                  </p>
                </div>

                {/* Filter and Search controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm tên/email học sinh..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none w-48 sm:w-64"
                    />
                  </div>

                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => setFilterRisk('ALL')}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterRisk === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => setFilterRisk('HIGH_RISK')}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterRisk === 'HIGH_RISK' ? 'bg-rose-500 text-white shadow-sm' : 'text-rose-700 hover:text-rose-900'
                      }`}
                    >
                      🔴 Nguy cơ
                    </button>
                    <button
                      onClick={() => setFilterRisk('MONITOR')}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterRisk === 'MONITOR' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:text-amber-900'
                      }`}
                    >
                      🟡 Theo dõi
                    </button>
                    <button
                      onClick={() => setFilterRisk('GOOD')}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterRisk === 'GOOD' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-700 hover:text-emerald-900'
                      }`}
                    >
                      🟢 Tốt/Khá
                    </button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3.5 px-4">Học sinh</th>
                      <th className="py-3.5 px-4">Số bài thi</th>
                      <th className="py-3.5 px-4">Điểm TB</th>
                      <th className="py-3.5 px-4">Phân loại AI</th>
                      <th className="py-3.5 px-4">Chủ đề hổng kiến thức</th>
                      <th className="py-3.5 px-4 text-right">Thao tác AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm font-medium">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          Không tìm thấy học sinh nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.student_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{student.student_name}</div>
                            <div className="text-xs text-slate-500">{student.email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 font-semibold">{student.total_attempts} bài</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-extrabold ${
                                student.avg_score >= 8.0
                                  ? 'text-emerald-600'
                                  : student.avg_score >= 5.0
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {student.avg_score} / 10
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {student.risk_level === 'HIGH_RISK' && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">
                                🔴 Nguy cơ cao
                              </span>
                            )}
                            {student.risk_level === 'MONITOR' && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
                                🟡 Cần theo dõi
                              </span>
                            )}
                            {student.risk_level === 'GOOD' && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                                🟢 Học lực Tốt/Khá
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {student.weak_topics.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {student.weak_topics.map((wt, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700"
                                  >
                                    {wt}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Chưa phát hiện rủi ro</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleFetchEvaluation(student.student_id)}
                              className="inline-flex items-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
                            >
                              <Sparkles className="w-3.5 h-3.5 mr-1" /> Nhận xét AI
                            </button>
                            <button
                              onClick={() => handleOpenRemedialModal(student.student_id)}
                              className="inline-flex items-center px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" /> Giao bài
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* 1-Click AI Student Evaluation Modal */}
        {evalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setEvalModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>

              {evalLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">AI đang lập Báo Cáo &amp; Nhận Xét Học Sinh...</p>
                </div>
              ) : evalData ? (
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                      {evalData.student_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900">
                        Báo Cáo Đánh Giá AI: {evalData.student_name}
                      </h3>
                      <p className="text-xs text-slate-500">Khối Lớp {evalData.grade} &bull; Chuẩn GDPT 2018</p>
                    </div>
                  </div>

                  {/* Overall Comment */}
                  <div className="mb-5 bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center">
                      <Sparkles className="w-4 h-4 mr-1 text-indigo-600" /> Nhận xét tổng quan của Giáo Viên (AI gợi ý)
                    </h4>
                    <p className="text-sm text-slate-800 leading-relaxed font-medium">{evalData.overall_comment}</p>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
                      <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Điểm mạnh nổi bật
                      </h4>
                      <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 font-medium">
                        {evalData.strengths.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-100">
                      <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1 text-rose-600" /> Kiến thức cần củng cố
                      </h4>
                      <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 font-medium">
                        {evalData.weaknesses.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Parent Note with Copy Button */}
                  <div className="mb-5 bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center">
                        <ClipboardCheck className="w-4 h-4 mr-1 text-amber-600" /> Lời nhắn gửi Phụ Huynh Học Sinh
                      </h4>
                      <button
                        onClick={copyParentNoteToClipboard}
                        className="inline-flex items-center text-xs font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                        {copiedNote ? 'Đã sao chép!' : 'Sao chép tin nhắn'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-800 italic leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200/60">
                      "{evalData.parent_note}"
                    </p>
                  </div>

                  {/* Action Plan */}
                  <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      🎯 Kế hoạch &amp; Mục tiêu học tập tiếp theo
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{evalData.action_plan}</p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setEvalModalOpen(false)}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Batch Remedial Exam Assignment Modal */}
        {remedialModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-100 relative">
              <button
                onClick={() => setRemedialModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 mb-1">
                <Send className="w-6 h-6 text-indigo-600" />
                Giao Bài Thi Tự Luyện Khắc Phục Điểm Yếu
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Hệ thống AI tự động tổng hợp câu hỏi chuẩn SGK tập trung đúng bài học còn yếu.
              </p>

              <form onSubmit={handleAssignRemedialSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số lượng học sinh được nhận bài: ({selectedStudentIds.length} em)
                  </label>
                  <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
                    {data?.risk_students
                      .filter((s) => selectedStudentIds.includes(s.student_id))
                      .map((s) => s.student_name)
                      .join(', ') || 'Chưa chọn học sinh'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chủ đề / Bài học SGK cần tập trung ôn tập
                  </label>
                  <input
                    type="text"
                    required
                    value={remedialTopic}
                    onChange={(e) => setRemedialTopic(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số câu hỏi trong bài tự luyện</label>
                  <select
                    value={remedialCount}
                    onChange={(e) => setRemedialCount(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  >
                    <option value={5}>5 câu hỏi (Nhanh - 15 phút)</option>
                    <option value={10}>10 câu hỏi (Tiêu chuẩn - 30 phút)</option>
                    <option value={15}>15 câu hỏi (Nâng cao - 45 phút)</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setRemedialModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRemedial}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition inline-flex items-center shadow-md shadow-indigo-200"
                  >
                    {submittingRemedial ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Đang khởi tạo...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1.5" /> Giao bài ngay
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
