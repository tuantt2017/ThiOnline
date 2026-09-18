'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { LearningRoadmapResponse, Document, DocumentSectionsResponse } from '@/types';
import {
  Compass,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpen,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Target,
  Zap,
  Library,
  Book,
} from 'lucide-react';

const SUBJECTS = [
  'Toán',
  'Tiếng Việt',
  'Tiếng Anh',
  'Khoa học',
  'Lịch sử & Địa lí',
  'Tin học',
];

export default function LearningRoadmapPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [selectedSubject, setSelectedSubject] = useState<string>('Toán');
  const [activeTab, setActiveTab] = useState<'sgk' | 'roadmap'>('sgk');

  // Roadmap states
  const [roadmap, setRoadmap] = useState<LearningRoadmapResponse | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(true);

  // SGK Catalog states
  const [sgkDocuments, setSgkDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [docSections, setDocSections] = useState<DocumentSectionsResponse | null>(null);
  const [loadingSgk, setLoadingSgk] = useState(false);

  // Selection states
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [creatingPractice, setCreatingPractice] = useState(false);

  // 1. Load Roadmap
  const loadRoadmap = useCallback(async () => {
    setLoadingRoadmap(true);
    try {
      const data = await api.getLearningRoadmap(selectedSubject);
      setRoadmap(data);
      if (activeTab === 'roadmap' && data && data.chapter_breakdown) {
        const defaultSelected = data.chapter_breakdown
          .filter((item) => item.status_level !== 'MASTERED')
          .map((item) => item.lesson);

        setSelectedLessons(
          defaultSelected.length > 0
            ? defaultSelected
            : data.chapter_breakdown.map((item) => item.lesson)
        );
      }
    } catch (err: any) {
      console.error('Lỗi khi tải Lộ trình học tập:', err);
    } finally {
      setLoadingRoadmap(false);
    }
  }, [selectedSubject, activeTab]);

  // 2. Load SGK Documents Catalog
  const loadSgkCatalog = useCallback(async () => {
    setLoadingSgk(true);
    try {
      const docs = await api.getDocuments({
        subject: selectedSubject,
        grade: user?.grade || 5,
        status: 'COMPLETED',
      });
      setSgkDocuments(docs || []);
      if (docs && docs.length > 0) {
        setSelectedDocId(docs[0].id);
      } else {
        setSelectedDocId(null);
        setDocSections(null);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải danh mục Sách giáo khoa:', err);
    } finally {
      setLoadingSgk(false);
    }
  }, [selectedSubject, user?.grade]);

  useEffect(() => {
    loadRoadmap();
    loadSgkCatalog();
  }, [loadRoadmap, loadSgkCatalog]);

  // 3. Load sections for selected SGK document
  useEffect(() => {
    async function loadSections() {
      if (!selectedDocId) return;
      setLoadingSgk(true);
      try {
        const sec = await api.getDocumentSections(selectedDocId);
        setDocSections(sec);
        if (sec && sec.all_topics) {
          setSelectedLessons(sec.all_topics);
        }
      } catch (err: any) {
        console.error('Lỗi khi tải đầu mục SGK:', err);
      } finally {
        setLoadingSgk(false);
      }
    }
    if (activeTab === 'sgk') {
      loadSections();
    }
  }, [selectedDocId, activeTab]);

  const toggleLessonSelection = (lessonName: string) => {
    setSelectedLessons((prev) =>
      prev.includes(lessonName)
        ? prev.filter((l) => l !== lessonName)
        : [...prev, lessonName]
    );
  };

  const toggleSelectAllLessons = () => {
    let availableLessons: string[] = [];
    if (activeTab === 'sgk' && docSections) {
      availableLessons = docSections.all_topics || [];
    } else if (roadmap) {
      availableLessons = roadmap.chapter_breakdown.map((item) => item.lesson);
    }

    if (selectedLessons.length === availableLessons.length) {
      setSelectedLessons([]);
    } else {
      setSelectedLessons(availableLessons);
    }
  };

  const handleCreateAdaptivePractice = async (overrideTopics?: string[]) => {
    setCreatingPractice(true);
    try {
      const topicsToUse = overrideTopics !== undefined ? overrideTopics : selectedLessons;
      const res = await api.createAdaptivePractice({
        subject: selectedSubject,
        count: 5,
        document_id: activeTab === 'sgk' && selectedDocId ? selectedDocId : undefined,
        topics: topicsToUse,
      });
      router.push(`/student/exams/${res.exam_id}/take?attemptId=${res.attempt_id}`);
    } catch (err: any) {
      alert(`Lỗi khi tạo đề tự luyện AI: ${err.message}`);
    } finally {
      setCreatingPractice(false);
    }
  };

  const getStatusBadge = (level: string) => {
    switch (level) {
      case 'MASTERED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 🟢 Đã vững
          </span>
        );
      case 'PRACTICE_NEEDED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> 🟡 Cần rèn luyện
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-extrabold text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> 🔴 Điểm yếu
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-10 -translate-y-6">
            <Compass className="w-80 h-80 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100 border border-white/20 mb-3">
                <Library className="w-3.5 h-3.5 text-amber-300" /> Danh Mục Sách Giáo Khoa & Tự Luyện AI (GDPT 2018)
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Hệ Thống Sách Giáo Khoa & Đề Tự Luyện AI
              </h1>
              <p className="text-sm font-medium text-blue-100 mt-1 max-w-2xl">
                Chọn các bài học từ <strong>Danh mục Sách Giáo Khoa</strong> hoặc <strong>Lộ trình điểm yếu</strong> để AI Gemini tạo bộ đề tự luyện ngẫu nhiên 100% bám sát chương trình học!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCreateAdaptivePractice()}
                disabled={creatingPractice}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 shrink-0"
              >
                <Zap className="w-4 h-4 text-slate-950 fill-current" />
                <span>
                  {creatingPractice
                    ? 'AI Đang Tạo Đề...'
                    : selectedLessons.length > 0
                    ? `Tạo Đề AI (${selectedLessons.length} Bài Đã Chọn)`
                    : 'Tạo Đề Tự Luyện AI'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Subject Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SUBJECTS.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition shadow-2xs ${
                selectedSubject === sub
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* Catalog Mode Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-1">
          <button
            onClick={() => {
              setActiveTab('sgk');
              if (docSections) setSelectedLessons(docSections.all_topics || []);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition ${
              activeTab === 'sgk'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Book className="w-4 h-4" /> 📘 Theo Danh Mục Sách Giáo Khoa (SGK)
          </button>

          <button
            onClick={() => {
              setActiveTab('roadmap');
              if (roadmap) {
                setSelectedLessons(roadmap.chapter_breakdown.map((item) => item.lesson));
              }
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition ${
              activeTab === 'roadmap'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Target className="w-4 h-4" /> 🎯 Lộ Trình Ôn Tập & Điểm Yếu AI
          </button>
        </div>

        {/* TAB 1: SGK CATALOG MODE */}
        {activeTab === 'sgk' && (
          <div className="space-y-6">
            {/* Textbook Selectors */}
            {loadingSgk ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                <p className="text-sm font-semibold text-slate-500">Đang tải danh mục Sách Giáo Khoa...</p>
              </div>
            ) : sgkDocuments.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center bg-white">
                <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">
                  Chưa có Sách Giáo Khoa môn {selectedSubject} Lớp {user?.grade || 5}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Vui lòng chuyển sang tab <strong>Lộ trình ôn tập AI</strong> hoặc nhờ Giáo viên tải lên tập SGK chuẩn bộ GD&ĐT.
                </p>
              </div>
            ) : (
              <>
                {/* Select specific SGK Document */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                    1. Chọn Cuốn Sách Giáo Khoa Môn {selectedSubject} (Lớp {user?.grade || 5}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sgkDocuments.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 ${
                          selectedDocId === doc.id
                            ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <Book className={`w-5 h-5 shrink-0 mt-0.5 ${selectedDocId === doc.id ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-900 leading-snug">
                            {doc.title}
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500 block mt-1">
                            {doc.book_series || 'Chuẩn GDPT 2018'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chapters & Lessons from Selected SGK */}
                {docSections && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-blue-600" /> Danh Mục Bài Học Trong {docSections.title}
                        </h2>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          Tích chọn các bài học trong SGK này để Gemini AI lấy làm cơ sở dữ liệu tạo đề ngẫu nhiên!
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={toggleSelectAllLessons}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
                        >
                          {selectedLessons.length === (docSections.all_topics?.length || 0)
                            ? 'Bỏ chọn tất cả'
                            : 'Chọn tất cả'}
                        </button>
                        <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-black text-xs">
                          {selectedLessons.length} / {docSections.all_topics?.length || 0} bài chọn
                        </span>
                      </div>
                    </div>

                    {/* Group Lessons by Chapter */}
                    {docSections.chapters && docSections.chapters.length > 0 ? (
                      <div className="space-y-6">
                        {docSections.chapters.map((chap, cIdx) => (
                          <div key={cIdx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-blue-800 bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-100 inline-block">
                              📌 {chap.title}
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              {chap.lessons.map((lesName, lIdx) => {
                                const isSelected = selectedLessons.includes(lesName);

                                return (
                                  <div
                                    key={lIdx}
                                    onClick={() => toggleLessonSelection(lesName)}
                                    className={`p-4 rounded-2xl border text-xs font-extrabold transition cursor-pointer flex items-start gap-3 ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 text-slate-900'
                                        : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                                    />
                                    <span className="leading-snug">{lesName}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Flat Topic list fallback */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-5 rounded-3xl border border-slate-200">
                        {(docSections.all_topics || []).map((lesName, lIdx) => {
                          const isSelected = selectedLessons.includes(lesName);
                          return (
                            <div
                              key={lIdx}
                              onClick={() => toggleLessonSelection(lesName)}
                              className={`p-4 rounded-2xl border text-xs font-extrabold transition cursor-pointer flex items-start gap-3 ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 text-slate-900'
                                  : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                              />
                              <span className="leading-snug">{lesName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: ROADMAP & WEAKNESS MAP MODE */}
        {activeTab === 'roadmap' && (
          <>
            {loadingRoadmap ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                <p className="text-sm font-semibold text-slate-500">AI đang phân tích kết quả và lập bản đồ điểm yếu...</p>
              </div>
            ) : !roadmap ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                <p className="text-sm text-slate-500">Không có dữ liệu lộ trình học tập.</p>
              </div>
            ) : (
              <>
                {/* AI Daily Action Box */}
                <div className="rounded-3xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 p-6 shadow-md relative">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full border border-amber-400">
                        <Sparkles className="w-3.5 h-3.5 text-amber-700 fill-amber-500" /> Hành Động Ôn Tập Hôm Nay (AI Recommended)
                      </div>
                      <div className="text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                        {roadmap.ai_daily_action}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCreateAdaptivePractice()}
                      disabled={creatingPractice}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-md active:scale-95 transition disabled:opacity-50 shrink-0"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>{creatingPractice ? 'Đang tạo đề...' : 'Luyện Tập Ngay'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Overview Mastery Score Card */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                  <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <span>Mức Độ Thành Thạo Tổng Quan</span>
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                      </div>

                      <div className="mt-4 flex items-baseline gap-3">
                        <span className="text-5xl font-black text-slate-900">{roadmap.overall_mastery_percentage}%</span>
                        <span className="text-xs font-bold text-slate-500">Môn {roadmap.subject} Lớp {roadmap.grade}</span>
                      </div>

                      {/* Overall Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-3.5 mt-4 overflow-hidden border border-slate-200 p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            roadmap.overall_mastery_percentage >= 80
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                              : roadmap.overall_mastery_percentage >= 50
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                              : 'bg-gradient-to-r from-rose-500 to-orange-500'
                          }`}
                          style={{ width: `${Math.max(5, roadmap.overall_mastery_percentage)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <span>Dựa trên {roadmap.total_attempts} bài thi đã hoàn thành</span>
                      <span className="text-blue-600 font-bold">GDPT 2018 Standard</span>
                    </div>
                  </div>

                  {/* Status Breakdown Metrics */}
                  <div className="lg:col-span-2 grid grid-cols-3 gap-3">
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm flex flex-col justify-between text-center">
                      <div className="text-xs font-bold text-emerald-800 uppercase">🟢 Đã Vững</div>
                      <div className="text-3xl font-black text-emerald-700 my-2">{roadmap.mastered_count}</div>
                      <div className="text-[11px] font-semibold text-emerald-800">Chương / Bài</div>
                    </div>

                    <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm flex flex-col justify-between text-center">
                      <div className="text-xs font-bold text-amber-800 uppercase">🟡 Cần Rèn Luyện</div>
                      <div className="text-3xl font-black text-amber-700 my-2">{roadmap.practice_needed_count}</div>
                      <div className="text-[11px] font-semibold text-amber-800">Chương / Bài</div>
                    </div>

                    <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm flex flex-col justify-between text-center">
                      <div className="text-xs font-bold text-rose-800 uppercase">🔴 Điểm Yếu</div>
                      <div className="text-3xl font-black text-rose-700 my-2">{roadmap.weak_count}</div>
                      <div className="text-[11px] font-semibold text-rose-800">Chương / Bài</div>
                    </div>
                  </div>
                </div>

                {/* Detailed Chapter/Lesson Breakdown */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-600" /> Chọn Các Bài Học Để AI Tạo Đề Ngẫu Nhiên
                      </h2>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        Tích chọn 1 hoặc nhiều bài học dưới đây ➔ AI sẽ dựa vào bài học được chọn để sinh đề trắc nghiệm ngẫu nhiên mới!
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={toggleSelectAllLessons}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
                      >
                        {roadmap && selectedLessons.length === roadmap.chapter_breakdown.length
                          ? 'Bỏ chọn tất cả'
                          : 'Chọn tất cả'}
                      </button>
                      <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-black text-xs">
                        {selectedLessons.length} / {roadmap?.chapter_breakdown.length || 0} bài chọn
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roadmap.chapter_breakdown.map((item, idx) => {
                      const isSelected = selectedLessons.includes(item.lesson);

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleLessonSelection(item.lesson)}
                          className={`rounded-3xl border p-5 shadow-sm transition cursor-pointer space-y-3 relative ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20'
                              : 'border-slate-200/90 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                              />
                              <div>
                                <span className="text-[11px] font-bold text-slate-500 block">
                                  {item.chapter} {item.page_reference ? `• Trang ${item.page_reference}` : ''}
                                </span>
                                <h3 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5">
                                  {item.lesson}
                                </h3>
                              </div>
                            </div>
                            {getStatusBadge(item.status_level)}
                          </div>

                          {/* Progress Bar & Percentage */}
                          <div className="space-y-1.5 pt-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-600">Thành thạo: {item.mastery_percentage}%</span>
                              <span className="text-slate-500 font-semibold">
                                {item.total_questions > 0
                                  ? `Đúng ${item.correct_count}/${item.total_questions} câu`
                                  : 'Chưa làm câu hỏi nào'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  item.status_level === 'MASTERED'
                                    ? 'bg-emerald-500'
                                    : item.status_level === 'PRACTICE_NEEDED'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.max(4, item.mastery_percentage)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Bottom Action Bar for selected topics */}
        {selectedLessons.length > 0 && (
          <div className="sticky bottom-6 rounded-3xl bg-slate-900/95 backdrop-blur-md text-white p-4 shadow-2xl border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4 z-20 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-sm">
                {selectedLessons.length}
              </span>
              <div>
                <h4 className="font-extrabold text-sm text-white">
                  Đã chọn {selectedLessons.length} bài học {activeTab === 'sgk' ? 'từ Sách Giáo Khoa' : 'từ Lộ Trình AI'} để tạo đề
                </h4>
                <p className="text-xs text-slate-300">
                  AI Gemini sẽ dựa vào các bài học này để sinh bộ 5 câu hỏi ngẫu nhiên mới!
                </p>
              </div>
            </div>

            <button
              onClick={() => handleCreateAdaptivePractice(selectedLessons)}
              disabled={creatingPractice}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl hover:from-amber-300 hover:to-amber-400 transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{creatingPractice ? 'AI Đang Tạo Đề...' : '🚀 Bắt Đầu Tạo Đề Tự Luyện AI'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
