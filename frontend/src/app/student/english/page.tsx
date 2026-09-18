'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { EnglishRoadmapResponse } from '@/types';
import {
  Headphones,
  Mic,
  BookOpen,
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  Volume2,
  BarChart3,
  RefreshCw,
  Flame,
  X,
  TrendingUp,
  Brain,
  Check,
} from 'lucide-react';

export default function EnglishLearningHubPage() {
  const router = useRouter();
  const [data, setData] = useState<EnglishRoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkillModal, setSelectedSkillModal] = useState<string | null>(null);

  // Custom AI Unit Generator Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState('Giao tiếp & Từ vựng Cuộc sống');
  const [selectedGrade, setSelectedGrade] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const SUGGESTED_TOPICS = [
    'Giao tiếp & Từ vựng Cuộc sống',
    'Thì Hiện tại đơn & Quá khứ đơn',
    'Thời tiết & Các mùa trong năm',
    'Các loài động vật & Tự nhiên',
    'Môn học & Trường lớp SGK',
    'Giao tiếp tại Sân bay & Du lịch',
  ];

  async function loadEnglishData() {
    setLoading(true);
    try {
      const res = await api.getEnglishAiRoadmap('Tiếng Anh');
      if (typeof window !== 'undefined' && res?.units) {
        try {
          const savedCompleted: number[] = JSON.parse(localStorage.getItem('completed_english_units') || '[]');
          if (savedCompleted.length > 0) {
            let completedCount = 0;
            res.units = res.units.map((u) => {
              if (u.status === 'COMPLETED' || savedCompleted.includes(u.id)) {
                completedCount++;
                return { ...u, status: 'COMPLETED', score: u.score ?? 100.0 };
              }
              return u;
            });
            res.completed_units_count = completedCount;
          }
        } catch (e) {
          console.error('Lỗi đọc completed_english_units từ localStorage:', e);
        }
      }
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu môn Tiếng Anh');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEnglishData();
  }, []);

  const handleRecalculateSkills = async () => {
    setIsRecalculating(true);
    try {
      await loadEnglishData();
    } finally {
      setTimeout(() => setIsRecalculating(false), 600);
    }
  };

  const handleGenerateCustomUnit = async () => {
    if (!customTopic.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const generated = await api.generateCustomEnglishUnit(customTopic.trim(), selectedGrade);
      setIsModalOpen(false);
      const targetId = generated?.unit_id ?? 999;
      router.push(`/student/english/unit/${targetId}`);
    } catch (err: any) {
      alert(`Lỗi khi tạo bài học AI: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-purple-600 mb-4" />
        <p className="text-base font-semibold text-slate-700">Đang chuẩn bị Lộ trình Tiếng Anh Đa Phương Thức AI...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md text-center shadow-lg">
          <BookOpen className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-slate-900">Chưa thể tải bài học</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'Có lỗi kết nối máy chủ'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm transition"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const SKILL_DETAILS: Record<string, { title: string; score: number; color: string; bgLight: string; icon: any; details: string[] }> = {
    Vocabulary: {
      title: 'Vocabulary (Từ Vựng 3D Flashcard)',
      score: data.overall_vocabulary_score,
      color: 'text-emerald-600',
      bgLight: 'bg-emerald-50 border-emerald-200',
      icon: BookOpen,
      details: [
        'Đã học và ghi nhớ: 24/28 từ vựng trọng tâm',
        'Độ chính xác bài gõ chính tả: 92%',
        'Phát âm mẫu Audio TTS nghe lại: 15 lượt',
      ],
    },
    Listening: {
      title: 'Listening (Nghe & Chọn Đáp Án)',
      score: data.overall_listening_score,
      color: 'text-blue-600',
      bgLight: 'bg-blue-50 border-blue-200',
      icon: Headphones,
      details: [
        'Đã hoàn thành: 16/20 bài tập luyện nghe',
        'Tốc độ phản xạ âm thanh: 1.2s/câu',
        'Độ hiểu đoạn hội thoại bản ngữ: 85%',
      ],
    },
    Speaking: {
      title: 'Speaking (Phòng Luyện Nói AI)',
      score: data.overall_speaking_score,
      color: 'text-purple-600',
      bgLight: 'bg-purple-50 border-purple-200',
      icon: Mic,
      details: [
        'Số câu đã thu âm luyện đọc: 12 câu',
        'Độ chuẩn trọng âm và nối từ: 78%',
        'Tự tin ngữ điệu câu giao tiếp: Khá xuất sắc',
      ],
    },
    Grammar: {
      title: 'Grammar (Ngữ Pháp & Gõ Cấu Trúc)',
      score: data.overall_grammar_score,
      color: 'text-amber-600',
      bgLight: 'bg-amber-50 border-amber-200',
      icon: Award,
      details: [
        'Đã vượt qua các câu điền từ ngữ cảnh',
        'Độ chính xác viết câu và từ còn thiếu: 84%',
        'Cấu trúc thì Hiện tại đơn & Quá khứ: Đạt yêu cầu',
      ],
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Banner - Clean Gradient */}
        <div className="rounded-3xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 sm:p-8 text-white shadow-xl shadow-purple-500/10 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute -right-10 -bottom-10 opacity-15 pointer-events-none">
            <Headphones className="w-80 h-80 text-white" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-purple-100 mb-3 border border-white/20">
              <Sparkles className="w-4 h-4 text-amber-300" /> English AI Multimodal Hub • GDPT Lớp 4 – 9
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Lộ Trình Học Tiếng Anh Đa Phương Thức
            </h1>
            <p className="text-sm sm:text-base text-purple-100 mt-2 leading-relaxed">
              Học từ vựng lật 3D, nghe audio bản ngữ chuẩn TTS, thu âm luyện đọc AI chấm điểm và tự tạo bài học theo bất kỳ chủ đề yêu cầu!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="relative z-10 shrink-0 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/student/rewards"
              className="px-5 py-3.5 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-extrabold text-sm rounded-2xl shadow-lg hover:scale-105 transition flex items-center gap-2"
            >
              <span>💎</span> Ví Kim Cương & Đổi Quà
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3.5 bg-amber-400 hover:bg-amber-300 text-purple-950 font-extrabold text-sm rounded-2xl shadow-lg hover:scale-105 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-purple-950 fill-purple-950" />
              Tạo Bài Ôn Tiếng Anh AI
            </button>
          </div>
        </div>

        {/* 4-Skill Radar & AI Coach Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 4-Skills Progress Overview Card */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" /> Đánh Giá 4 Kỹ Năng Ngôn Ngữ Trực Tiếp
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Tự động cập nhật chỉ số theo kết quả luyện tập của bạn</p>
              </div>

              <button
                onClick={handleRecalculateSkills}
                disabled={isRecalculating}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${isRecalculating ? 'animate-spin' : ''}`} />
                Tái Đánh Giá AI
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Vocabulary */}
              <div
                onClick={() => setSelectedSkillModal('Vocabulary')}
                className="cursor-pointer bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 p-4 rounded-2xl text-center space-y-1.5 transition shadow-xs group"
              >
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500 font-semibold group-hover:text-emerald-700">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-500" /> Vocabulary
                </div>
                <div className="text-2xl font-extrabold text-emerald-600">{data.overall_vocabulary_score}%</div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${data.overall_vocabulary_score}%` }} />
                </div>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full inline-block mt-1">
                  Xuất sắc
                </span>
              </div>

              {/* Listening */}
              <div
                onClick={() => setSelectedSkillModal('Listening')}
                className="cursor-pointer bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 p-4 rounded-2xl text-center space-y-1.5 transition shadow-xs group"
              >
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500 font-semibold group-hover:text-blue-700">
                  <Headphones className="w-3.5 h-3.5 text-blue-500" /> Listening
                </div>
                <div className="text-2xl font-extrabold text-blue-600">{data.overall_listening_score}%</div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-700" style={{ width: `${data.overall_listening_score}%` }} />
                </div>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full inline-block mt-1">
                  Tốt
                </span>
              </div>

              {/* Speaking */}
              <div
                onClick={() => setSelectedSkillModal('Speaking')}
                className="cursor-pointer bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 p-4 rounded-2xl text-center space-y-1.5 transition shadow-xs group"
              >
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500 font-semibold group-hover:text-purple-700">
                  <Mic className="w-3.5 h-3.5 text-purple-500" /> Speaking
                </div>
                <div className="text-2xl font-extrabold text-purple-600">{data.overall_speaking_score}%</div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                  <div className="bg-purple-500 h-full rounded-full transition-all duration-700" style={{ width: `${data.overall_speaking_score}%` }} />
                </div>
                <span className="text-[11px] font-bold text-purple-600 bg-purple-100/80 px-2 py-0.5 rounded-full inline-block mt-1">
                  Khá
                </span>
              </div>

              {/* Grammar */}
              <div
                onClick={() => setSelectedSkillModal('Grammar')}
                className="cursor-pointer bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 p-4 rounded-2xl text-center space-y-1.5 transition shadow-xs group"
              >
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500 font-semibold group-hover:text-amber-700">
                  <Award className="w-3.5 h-3.5 text-amber-500" /> Grammar
                </div>
                <div className="text-2xl font-extrabold text-amber-600">{data.overall_grammar_score}%</div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-700" style={{ width: `${data.overall_grammar_score}%` }} />
                </div>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full inline-block mt-1">
                  Tốt
                </span>
              </div>
            </div>
          </div>

          {/* AI Coach Card */}
          <div className="rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50/70 p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm mb-2">
                <Flame className="w-5 h-5 text-amber-500 animate-pulse" /> AI Daily English Coach
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/90 p-4 rounded-2xl border border-purple-100 shadow-xs">
                {data.ai_daily_coaching_advice}
              </p>
            </div>
            <Link
              href="/student/english/unit/1"
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 font-bold text-white rounded-2xl text-sm shadow-md transition"
            >
              <Play className="w-4 h-4 fill-white" /> Bắt Đầu Học Ngay (5 Phút)
            </Link>
          </div>
        </div>

        {/* Units Roadmap Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" /> Các Chủ Đề Bài Học (Curriculum Units)
            </h2>
            <span className="text-xs text-slate-500 font-semibold bg-slate-200/60 px-3 py-1 rounded-full border border-slate-300/50">
              Hoàn thành {data.completed_units_count}/{data.total_units_count} bài học
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.units.map((unit) => {
              const isCompleted = unit.status === 'COMPLETED';
              const isLocked = unit.status === 'LOCKED';

              return (
                <div
                  key={unit.id}
                  className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 transition shadow-sm hover:shadow-md ${
                    isCompleted
                      ? 'border-emerald-300 bg-white ring-1 ring-emerald-400/20'
                      : isLocked
                      ? 'border-slate-200 bg-slate-100/60 opacity-60'
                      : 'border-purple-200 bg-white hover:border-purple-400 ring-1 ring-purple-500/10'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200">
                        {unit.topic}
                      </span>
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn thành ({unit.score}%)
                        </span>
                      ) : isLocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full">
                          <Lock className="w-3.5 h-3.5" /> Chưa mở khóa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                          🔥 Đang học
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">{unit.title}</h3>

                    {/* Features list */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 font-medium bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                        {unit.vocab_count} Flashcards 3D
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-purple-600" />
                        Audio TTS Bản Ngữ
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-rose-600" />
                        Luyện Nói AI
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        {unit.exercise_count} Bài Tập Nối/Gõ
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/student/english/unit/${unit.id}`)}
                    disabled={isLocked}
                    className={`w-full py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isCompleted
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        : isLocked
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md'
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" /> Học Lại Bài
                      </>
                    ) : isLocked ? (
                      'Hoàn thành bài trước để mở'
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" /> Vào Bài Học Ngay
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Skill Detail Modal */}
      {selectedSkillModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-fadeIn text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" /> Chi Tiết AI Đánh Giá Kỹ Năng
              </h3>
              <button
                onClick={() => setSelectedSkillModal(null)}
                className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className={`p-4 rounded-2xl border ${SKILL_DETAILS[selectedSkillModal].bgLight}`}>
                <h4 className="font-bold text-sm text-slate-900">{SKILL_DETAILS[selectedSkillModal].title}</h4>
                <div className="text-3xl font-extrabold mt-1 text-slate-900">
                  {SKILL_DETAILS[selectedSkillModal].score}%
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chỉ số chi tiết:</span>
                {SKILL_DETAILS[selectedSkillModal].details.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedSkillModal(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Custom AI Unit Generator Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-fadeIn text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700 border border-purple-200">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tạo Bài Ôn Tiếng Anh AI Theo Yêu Cầu</h3>
                  <p className="text-xs text-slate-500">Chọn hoặc nhập bất kỳ chủ đề nào bạn muốn ôn luyện ngay!</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Select Grade */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Chọn Khối Lớp</label>
                <div className="grid grid-cols-6 gap-2">
                  {[4, 5, 6, 7, 8, 9].map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGrade(g)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        selectedGrade === g
                          ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      Lớp {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested Topics Pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gợi Ý Chủ Đề Hay</label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TOPICS.map((top) => (
                    <button
                      key={top}
                      onClick={() => setCustomTopic(top)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                        customTopic === top
                          ? 'bg-purple-100 border-purple-400 text-purple-800 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {top}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Topic Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hoặc Nhập Chủ Đề Tự Chọn</label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Ví dụ: Thì Hiện tại tiếp diễn, Từ vựng môn Thể thao..."
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-sm text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleGenerateCustomUnit}
                disabled={isGenerating || !customTopic.trim()}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> AI Đang Khởi Tạo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Tạo Bài Học AI Ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
