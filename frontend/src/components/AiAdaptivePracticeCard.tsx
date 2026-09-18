'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Document, DocumentSectionsResponse } from '@/types';
import {
  Sparkles,
  Zap,
  RefreshCw,
  ArrowRight,
  Brain,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

const SUBJECTS = [
  'Toán',
  'Tiếng Việt',
  'Tiếng Anh',
  'Khoa học',
  'Lịch sử & Địa lí',
  'Tin học',
];

interface Props {
  className?: string;
  defaultSubject?: string;
}

export default function AiAdaptivePracticeCard({ className = '', defaultSubject = 'Toán' }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const [subject, setSubject] = useState<string>(defaultSubject);
  const [count, setCount] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // SGK catalog states
  const [sgkDocuments, setSgkDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [docSections, setDocSections] = useState<DocumentSectionsResponse | null>(null);
  const [loadingSections, setLoadingSections] = useState<boolean>(false);

  // Lesson selection states
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [showLessonPicker, setShowLessonPicker] = useState<boolean>(false);

  // 1. Load documents when subject changes
  const loadSgkDocuments = useCallback(async () => {
    setLoadingSections(true);
    try {
      const docs = await api.getDocuments({
        subject,
        grade: user?.grade || 5,
        status: 'COMPLETED',
      });
      setSgkDocuments(docs || []);
      if (docs && docs.length > 0) {
        setSelectedDocId(docs[0].id);
      } else {
        setSelectedDocId(null);
        setDocSections(null);
        setSelectedLessons([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh mục SGK:', err);
    } finally {
      setLoadingSections(false);
    }
  }, [subject, user?.grade]);

  useEffect(() => {
    loadSgkDocuments();
  }, [loadSgkDocuments]);

  // 2. Load sections when selectedDocId changes
  useEffect(() => {
    async function loadSections() {
      if (!selectedDocId) return;
      setLoadingSections(true);
      try {
        const sec = await api.getDocumentSections(selectedDocId);
        setDocSections(sec);
        if (sec && sec.all_topics) {
          setSelectedLessons(sec.all_topics);
        }
      } catch (err) {
        console.error('Lỗi khi tải đầu mục SGK:', err);
      } finally {
        setLoadingSections(false);
      }
    }
    loadSections();
  }, [selectedDocId]);

  const toggleLessonSelection = (lessonName: string) => {
    setSelectedLessons((prev) =>
      prev.includes(lessonName)
        ? prev.filter((l) => l !== lessonName)
        : [...prev, lessonName]
    );
  };

  const toggleSelectAll = () => {
    const all = docSections?.all_topics || [];
    if (selectedLessons.length === all.length) {
      setSelectedLessons([]);
    } else {
      setSelectedLessons(all);
    }
  };

  const handleCreatePractice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.createAdaptivePractice({
        subject,
        count,
        document_id: selectedDocId || undefined,
        topics: selectedLessons.length > 0 ? selectedLessons : undefined,
      });

      // Automatically redirect straight into taking the exam
      router.push(`/student/exams/${res.exam_id}/take?attemptId=${res.attempt_id}`);
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo đề tự luyện AI.');
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-3xl border border-indigo-200/90 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden ${className}`}>
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Header Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-400/30 px-3.5 py-1 text-xs font-bold text-amber-300 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Tính Năng AI Tự Tạo Đề Bám Sát Bài Học (GDPT 2018)
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-400 shrink-0" />
              Tạo Đề Tự Luyện AI Theo Bài Học
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl font-normal leading-relaxed">
              Tùy chọn cuốn <strong>Sách Giáo Khoa</strong> &amp; các <strong>bài học đã học trên lớp</strong>. AI Gemini sẽ chỉ sinh câu hỏi bám sát phạm vi bài học bạn chọn, tránh kiến thức chưa học!
            </p>
          </div>
        </div>

        {/* Configuration Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* Select Subject */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 space-y-1">
            <label className="block text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
              1. Chọn Môn Học
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-950/80 border border-indigo-300/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {SUBJECTS.map((sub) => (
                <option key={sub} value={sub} className="bg-slate-900 text-white">
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Select Question Count */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 space-y-1">
            <label className="block text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
              2. Số Lượng Câu Hỏi
            </label>
            <div className="flex items-center gap-1.5 pt-0.5">
              {[3, 5, 10, 15].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={loading}
                  onClick={() => setCount(num)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition ${
                    count === num
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md font-extrabold'
                      : 'bg-slate-950/60 text-slate-200 border-white/10 hover:bg-white/20'
                  }`}
                >
                  {num} câu
                </button>
              ))}
            </div>
          </div>

          {/* Select Textbook (SGK) */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 space-y-1">
            <label className="block text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
              3. Bộ Sách Giáo Khoa
            </label>
            {loadingSections ? (
              <div className="flex items-center gap-2 py-2 text-xs text-indigo-200 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> Đang tải bộ SGK...
              </div>
            ) : sgkDocuments.length > 0 ? (
              <select
                value={selectedDocId || ''}
                onChange={(e) => setSelectedDocId(Number(e.target.value))}
                disabled={loading}
                className="w-full bg-slate-950/80 border border-indigo-300/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {sgkDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id} className="bg-slate-900 text-white">
                    {doc.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="py-2 text-xs text-indigo-300 font-medium italic">
                Chưa có SGK môn {subject} Lớp {user?.grade || 5}
              </div>
            )}
          </div>
        </div>

        {/* Lesson Scope Picker Bar */}
        {docSections && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  Phạm Vi Bài Học (Nội dung câu hỏi):
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-extrabold border border-amber-400/30">
                  {selectedLessons.length} / {docSections.all_topics?.length || 0} bài chọn
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition border border-white/10"
                >
                  {selectedLessons.length === (docSections.all_topics?.length || 0)
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả bài'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLessonPicker((prev) => !prev)}
                  className="px-3 py-1 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-xs transition flex items-center gap-1.5 border border-indigo-400/30"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{showLessonPicker ? 'Ẩn Danh Sách Bài' : 'Xem / Chọn Bài Học'}</span>
                  {showLessonPicker ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Expandable Lessons Checkboxes Grid */}
            {showLessonPicker && (
              <div className="pt-3 border-t border-white/10 space-y-4 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {docSections.chapters && docSections.chapters.length > 0 ? (
                  docSections.chapters.map((chap, cIdx) => (
                    <div key={cIdx} className="space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 inline-block">
                        📌 {chap.title}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {chap.lessons.map((lesName, lIdx) => {
                          const isSelected = selectedLessons.includes(lesName);
                          return (
                            <div
                              key={lIdx}
                              onClick={() => toggleLessonSelection(lesName)}
                              className={`p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-start gap-2.5 ${
                                isSelected
                                  ? 'border-amber-400/80 bg-amber-400/15 text-white'
                                  : 'border-white/10 bg-slate-950/40 text-indigo-200 hover:bg-white/10'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="mt-0.5 h-3.5 w-3.5 rounded border-indigo-300/40 text-amber-400 focus:ring-amber-400 cursor-pointer shrink-0"
                              />
                              <span className="leading-snug">{lesName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(docSections.all_topics || []).map((lesName, lIdx) => {
                      const isSelected = selectedLessons.includes(lesName);
                      return (
                        <div
                          key={lIdx}
                          onClick={() => toggleLessonSelection(lesName)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-start gap-2.5 ${
                            isSelected
                              ? 'border-amber-400/80 bg-amber-400/15 text-white'
                              : 'border-white/10 bg-slate-950/40 text-indigo-200 hover:bg-white/10'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-indigo-300/40 text-amber-400 focus:ring-amber-400 cursor-pointer shrink-0"
                          />
                          <span className="leading-snug">{lesName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit Action Button */}
        <button
          type="button"
          onClick={handleCreatePractice}
          disabled={loading}
          className="w-full h-[54px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>AI Gemini Đang Phân Tích Bài Học & Khởi Tạo Đề...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>
                🚀 Bắt Đầu Tạo Đề Tự Luyện ({selectedLessons.length > 0 ? `${selectedLessons.length} Bài Đã Chọn` : 'Tất Cả Bài Học'})
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 p-3 text-xs font-semibold text-rose-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

