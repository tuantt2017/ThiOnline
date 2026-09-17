'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Question } from '@/types';
import {
  FileCheck2,
  ArrowLeft,
  Search,
  Layers,
  CheckSquare,
  Square,
  AlertCircle,
  Shuffle,
  Sparkles,
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

export default function CreateExamPage() {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [totalPoints, setTotalPoints] = useState(10.0);
  const [passingScore, setPassingScore] = useState(5.0);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  // Question Selection State
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [randomCount, setRandomCount] = useState<number>(10);

  // Submit State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to pick random N questions from available pool
  const handlePickRandom = (countToPick?: number, sourceQuestions?: Question[]) => {
    const pool = sourceQuestions || availableQuestions;
    if (!pool || pool.length === 0) return;
    
    const count = countToPick !== undefined ? countToPick : randomCount;
    const numToPick = Math.min(Math.max(1, count), pool.length);

    // Shuffle array randomly
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const pickedIds = shuffled.slice(0, numToPick).map((q) => q.id);
    setSelectedQuestionIds(pickedIds);
  };

  // Load APPROVED questions matching subject & grade
  useEffect(() => {
    setLoadingQuestions(true);
    api
      .getQuestions({
        subject,
        grade,
        status: 'APPROVED',
        search: searchQuery || undefined,
        page: 1,
        page_size: 100,
      })
      .then((res) => {
        const items = res.items || [];
        setAvailableQuestions(items);
        if (items.length > 0) {
          // Auto select up to 10 random questions by default
          const defaultCount = Math.min(10, items.length);
          setRandomCount(defaultCount);
          handlePickRandom(defaultCount, items);
        } else {
          setSelectedQuestionIds([]);
        }
      })
      .catch(() => {
        setAvailableQuestions([]);
        setSelectedQuestionIds([]);
      })
      .finally(() => setLoadingQuestions(false));
  }, [subject, grade, searchQuery]);

  const toggleSelectQuestion = (id: number) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === availableQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(availableQuestions.map((q) => q.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề đề thi.');
      return;
    }

    if (selectedQuestionIds.length === 0) {
      setError('Vui lòng chọn ít nhất 1 câu hỏi từ Ngân hàng câu hỏi.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createExam({
        title: title.trim(),
        description: description.trim() || undefined,
        subject,
        grade,
        duration_minutes: durationMinutes,
        total_points: totalPoints,
        passing_score: passingScore,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        question_ids: selectedQuestionIds,
      });

      router.push('/exams');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo đề thi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Navigation */}
        <Link
          href="/exams"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Danh sách Đề thi
        </Link>

        <div className="border-b border-slate-200 pb-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Tạo Đề Thi Mới
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">
            Cấu hình thời gian làm bài, điểm số và nhập số câu hỏi chọn ngẫu nhiên từ Ngân hàng câu hỏi.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic Exam Configuration */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-blue-600" /> 1. Thông Tin Cấu Hình Đề Thi
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tiêu Đề Đề Thi *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Đề thi Giữa kỳ 1 Môn Toán Lớp 5"
                  className="w-full px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mô Tả Hướng Dẫn (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú hướng dẫn cho học sinh khi làm bài..."
                  className="w-full px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Môn Học
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Khối Lớp (4-9)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Lớp {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Thời Gian (Phút)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 45)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Thang Điểm Tối Đa
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={totalPoints}
                    onChange={(e) => setTotalPoints(parseFloat(e.target.value) || 10.0)}
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Shuffling Options */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  Xáo trộn thứ tự câu hỏi khi học sinh làm
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  Xáo trộn phương án A/B/C/D
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Question Selection & Random Picker */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" /> 2. Lựa Chọn Câu Hỏi Cho Đề Thi
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Đã chọn <strong className="text-indigo-600 font-extrabold">{selectedQuestionIds.length}</strong> / {availableQuestions.length} câu hỏi phù hợp với {subject} Lớp {grade}.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm câu hỏi..."
                  className="pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Random Picker Box */}
            <div className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-slate-50 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md font-bold">
                    <Shuffle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                      Chọn Ngẫu Nhiên Trong Ngân Hàng <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Nhập số câu mong muốn, hệ thống sẽ tự động bốc ngẫu nhiên từ kho {availableQuestions.length} câu hỏi đã duyệt.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={availableQuestions.length || 100}
                      value={randomCount}
                      onChange={(e) => setRandomCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-3 py-2 text-xs font-extrabold text-center rounded-xl border border-indigo-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                    <span className="text-xs font-bold text-slate-600 ml-1.5 shrink-0">câu</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePickRandom(randomCount)}
                    disabled={availableQuestions.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md transition disabled:opacity-50 shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> Bốc Ngẫu Nhiên
                  </button>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-100/80">
                <span className="text-[11px] font-bold text-slate-500">Bốc nhanh:</span>
                {[5, 10, 15, 20, 30].map((count) => (
                  <button
                    key={count}
                    type="button"
                    disabled={availableQuestions.length === 0}
                    onClick={() => {
                      setRandomCount(count);
                      handlePickRandom(count);
                    }}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition ${
                      selectedQuestionIds.length === count
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {count} câu
                  </button>
                ))}
                <button
                  type="button"
                  disabled={availableQuestions.length === 0}
                  onClick={toggleSelectAll}
                  className="px-3 py-1 text-[11px] font-bold rounded-lg border bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition ml-auto"
                >
                  Tất cả ({availableQuestions.length} câu)
                </button>
              </div>
            </div>

            {/* Questions List */}
            {loadingQuestions ? (
              <div className="text-center py-10 text-xs font-semibold text-slate-500">Đang tải câu hỏi...</div>
            ) : availableQuestions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs font-semibold text-slate-500">
                Không tìm thấy câu hỏi đã duyệt nào phù hợp với môn {subject} Lớp {grade}.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold border-b border-slate-100 pb-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-700"
                  >
                    {selectedQuestionIds.length === availableQuestions.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Chọn thủ công ({selectedQuestionIds.length}/{availableQuestions.length})
                  </button>
                  <span>
                    Điểm trung bình mỗi câu: {selectedQuestionIds.length > 0 ? (totalPoints / selectedQuestionIds.length).toFixed(2) : '0'} điểm
                  </span>
                </div>

                {availableQuestions.map((q) => {
                  const isSelected = selectedQuestionIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleSelectQuestion(q.id)}
                      className={`p-4 rounded-xl border text-xs cursor-pointer transition flex items-start gap-3 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500/20 font-medium'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <button type="button" className="mt-0.5 text-slate-400 hover:text-indigo-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 space-y-1">
                        <div className="font-bold text-slate-900 leading-relaxed">
                          {q.content}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
                          <span>Độ khó: {q.difficulty === 'EASY' ? 'Dễ' : q.difficulty === 'HARD' ? 'Khó' : 'TB'}</span>
                          {q.chapter && <span>• {q.chapter}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/exams"
              className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Hủy bỏ
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md disabled:opacity-50 transition"
            >
              {submitting ? 'Đang tạo đề...' : 'Xác Nhận Tạo Đề Thi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
