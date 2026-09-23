'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { WordScrambleQuestion, WordScrambleVerifyResponse } from '@/types';
import {
  Crown,
  Sparkles,
  Volume2,
  RefreshCw,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  Diamond,
  GraduationCap,
  BookOpen,
  RotateCcw,
  Zap,
  Award,
} from 'lucide-react';

interface SelectedTile {
  index: number;
  letter: string;
}

export default function WordScrambleGamePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Controls
  const [subject, setSubject] = useState<'Tiếng Việt' | 'Tiếng Anh'>('Tiếng Việt');
  const [grade, setGrade] = useState<number>(5);

  // Game state
  const [question, setQuestion] = useState<WordScrambleQuestion | null>(null);
  const [scrambledList, setScrambledList] = useState<string[]>([]);
  const [selectedTiles, setSelectedTiles] = useState<SelectedTile[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [diamondBalance, setDiamondBalance] = useState<number>(0);

  // Status & Feedback
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<WordScrambleVerifyResponse | null>(null);
  const [showHintModal, setShowHintModal] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Authenticate user
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (user) {
      setGrade(user.grade || 5);
    }
  }, [user, isLoading, router]);

  // Load user diamond balance
  useEffect(() => {
    if (user) {
      api.getRewardBalance()
        .then((b) => setDiamondBalance(b.diamond_balance))
        .catch(() => {});
    }
  }, [user]);

  // Fetch question
  const fetchNextQuestion = async (targetSub = subject, targetGrade = grade) => {
    setIsFetching(true);
    setResult(null);
    setSelectedTiles([]);
    setShowHintModal(false);
    setTimerSeconds(60);

    try {
      const q = await api.getWordScrambleQuestion(targetSub, targetGrade);
      setQuestion(q);
      setScrambledList(q.scrambled_letters);
    } catch (err: any) {
      alert(`Lỗi khi tải câu hỏi Vua Từ Vựng: ${err.message}`);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNextQuestion(subject, grade);
    }
  }, [user, subject, grade]);

  // Timer Countdown
  useEffect(() => {
    if (!question || result) return;
    if (timerSeconds <= 0) {
      handleTimeOut();
      return;
    }

    timerRef.current = setTimeout(() => {
      setTimerSeconds((prev) => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timerSeconds, question, result]);

  const handleTimeOut = () => {
    if (!question || result) return;
    setResult({
      is_correct: false,
      target_word: 'HẾT GIỜ',
      user_answer: selectedTiles.map((t) => t.letter).join(''),
      explanation: '⏰ Đã hết thời gian 60 giây! Hãy nhấn "Từ Tiếp Theo" để thử sức câu mới.',
      current_streak: 0,
      earned_diamonds: 0,
      new_diamond_balance: diamondBalance,
    });
    setStreak(0);
  };

  // Handle Tile Click in Scrambled Grid
  const handleTileClick = (index: number, letter: string) => {
    if (result || isVerifying) return;
    // Check if tile already selected
    if (selectedTiles.some((t) => t.index === index)) return;

    setSelectedTiles((prev) => [...prev, { index, letter }]);
  };

  // Handle Remove Tile from Answer Tray
  const handleRemoveTrayTile = (trayIndex: number) => {
    if (result || isVerifying) return;
    setSelectedTiles((prev) => prev.filter((_, idx) => idx !== trayIndex));
  };

  // Reset entire answer tray
  const handleResetTray = () => {
    if (result || isVerifying) return;
    setSelectedTiles([]);
  };

  // Audio TTS for English prompt
  const handlePlayAudio = () => {
    if (!question?.english_audio_prompt || typeof window === 'undefined') return;
    try {
      setIsPlayingAudio(true);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(question.english_audio_prompt);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
    }
  };

  // Verify built answer
  const handleSubmitAnswer = async () => {
    if (!question || selectedTiles.length === 0 || isVerifying) return;

    const builtWord = selectedTiles.map((t) => t.letter).join('');
    setIsVerifying(true);

    try {
      const res = await api.verifyWordScrambleAnswer(question.game_id, builtWord, streak);
      setResult(res);
      setStreak(res.current_streak);

      if (res.new_diamond_balance !== undefined && res.new_diamond_balance !== null) {
        setDiamondBalance(res.new_diamond_balance);
      }
    } catch (err: any) {
      alert(`Lỗi kiểm tra đáp án: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-slate-900 text-white">
        <div className="flex items-center gap-3 text-amber-400 font-bold">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>Đang tải đấu trường Vua Từ Vựng SGK...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 relative overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6 relative z-10">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/80 backdrop-blur-md p-4 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20">
              <Crown className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                <Sparkles className="w-3.5 h-3.5" /> Đấu Trường Tri Thức SGK
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Vua Từ Vựng SGK
              </h1>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-3">
            {/* Diamond Balance */}
            <Link
              href="/student/rewards"
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-extrabold text-xs hover:bg-amber-500/20 transition shadow-inner"
            >
              <Diamond className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
              <span>{diamondBalance} 💎</span>
            </Link>

            {/* Win Streak */}
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 font-extrabold text-xs shadow-inner" title="Thưởng 1-2 💎 Kim Cương khi đạt 10 câu đúng liên tiếp cho mỗi môn">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>Chuỗi: {streak}/10 🔥</span>
            </div>

          </div>
        </div>

        {/* Filter Controls (Subject & Grade Selectors) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Subject Switcher */}
          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setSubject('Tiếng Việt');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition ${
                subject === 'Tiếng Việt'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>🇻🇳 Vua Tiếng Việt</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubject('Tiếng Anh');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition ${
                subject === 'Tiếng Anh'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>🇬🇧 King of English</span>
            </button>
          </div>

          {/* Grade Selector */}
          <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2 rounded-2xl border border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Khối lớp SGK:
            </span>
            <div className="flex gap-1">
              {[4, 5, 6, 7, 8, 9].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`w-8 h-8 rounded-xl text-xs font-black transition ${
                    grade === g
                      ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Game Stage */}
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800/90 p-6 sm:p-8 shadow-2xl space-y-8 relative">
          {/* Stage Top Bar: Timer & Actions */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="p-1.5 bg-slate-800 rounded-lg text-amber-400">💡</span>
              <span>
                Cần xếp: <strong className="text-amber-400">{question?.letter_count || 0}</strong>{' '}
                ký tự
              </span>
            </div>

            {/* Countdown Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold border transition ${
                timerSeconds <= 15
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  : 'bg-slate-800/80 text-amber-300 border-slate-700'
              }`}
            >
              <span>⏱️</span>
              <span>{timerSeconds}s</span>
            </div>

            {/* Hint & Audio Prompt Buttons */}
            <div className="flex items-center gap-2">
              {subject === 'Tiếng Anh' && question?.english_audio_prompt && (
                <button
                  type="button"
                  onClick={handlePlayAudio}
                  disabled={isPlayingAudio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-300 border border-teal-500/30 text-xs font-bold hover:bg-teal-500/20 transition"
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                  <span>Nghe Mẫu</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHintModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/20 transition"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Gợi Ý SGK</span>
              </button>
            </div>
          </div>

          {/* Hint Quick Banner */}
          {question?.hint_meaning && (
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-xs font-medium text-slate-300 leading-relaxed text-center shadow-inner">
              <strong className="text-amber-400">💡 Gợi Ý Định Nghĩa SGK:</strong>{' '}
              {question.hint_meaning}
            </div>
          )}

          {/* ANSWER TRAY AREA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
              <span>Khay Đáp Án Của Bạn:</span>
              {selectedTiles.length > 0 && !result && (
                <button
                  type="button"
                  onClick={handleResetTray}
                  className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 transition text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" /> Đặt lại
                </button>
              )}
            </div>

            <div className="min-h-[72px] p-3 rounded-2xl bg-slate-950/80 border-2 border-dashed border-slate-800 flex flex-wrap items-center justify-center gap-2 transition">
              {selectedTiles.length === 0 ? (
                <span className="text-xs font-semibold text-slate-600 italic">
                  Bấm vào các ô chữ cái phía dưới theo thứ tự để chọn...
                </span>
              ) : (
                selectedTiles.map((tile, idx) => (
                  <button
                    key={`${tile.index}-${idx}`}
                    type="button"
                    onClick={() => handleRemoveTrayTile(idx)}
                    className="h-12 min-w-[48px] px-3 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-black text-lg shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition flex items-center justify-center border-t border-amber-200"
                  >
                    {tile.letter === ' ' ? '␣' : tile.letter}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* SCRAMBLED TILES SELECTION GRID */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-slate-400 px-1">
              Các Ký Tự Đảo Lộn (Bấm Để Chọn):
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 py-2">
              {scrambledList.map((letter, index) => {
                const isSelected = selectedTiles.some((t) => t.index === index);
                return (
                  <button
                    key={`scrambled-${index}`}
                    type="button"
                    disabled={isSelected || !!result}
                    onClick={() => handleTileClick(index, letter)}
                    className={`h-14 min-w-[54px] px-3.5 rounded-2xl font-black text-xl shadow-md transition flex items-center justify-center border-b-4 ${
                      isSelected
                        ? 'opacity-20 scale-90 border-transparent bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 border-indigo-900 text-white shadow-indigo-500/25 hover:scale-110 active:scale-95'
                    }`}
                  >
                    {letter === ' ' ? '␣' : letter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Action Button */}
          {!result && (
            <div className="pt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={selectedTiles.length === 0 || isVerifying}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 disabled:opacity-40 transition flex items-center justify-center gap-2 active:scale-95"
              >
                {isVerifying ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-slate-950" />
                    <span>Nộp Đáp Án</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* VERIFICATION RESULT FEEDBACK BOX */}
          {result && (
            <div
              className={`p-6 rounded-3xl border space-y-4 animate-in fade-in zoom-in-95 duration-200 ${
                result.is_correct
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-100'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-100'
              }`}
            >
              <div className="flex items-start gap-4">
                {result.is_correct ? (
                  <div className="p-3 bg-emerald-500 text-slate-950 rounded-2xl shadow-lg">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg">
                    <XCircle className="w-8 h-8" />
                  </div>
                )}

                <div className="flex-1 space-y-1">
                  <div className="text-base font-black flex items-center gap-2">
                    <span>{result.is_correct ? '🎉 CHÍNH XÁC 100%!' : '❌ CHƯA CHÍNH XÁC'}</span>
                    {result.earned_diamonds > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold animate-bounce">
                        <Award className="w-3.5 h-3.5" /> +{result.earned_diamonds} 💎 Thưởng Streak!
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-medium leading-relaxed opacity-90">
                    {result.explanation}
                  </p>
                </div>
              </div>

              {/* Next Question Action */}
              <div className="flex justify-end pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => fetchNextQuestion(subject, grade)}
                  className="px-6 py-2.5 rounded-xl bg-white text-slate-950 font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2"
                >
                  <span>Từ Tiếp Theo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SGK HINT MODAL */}
      {showHintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Lightbulb className="w-5 h-5 fill-amber-400" />
                <span>Gợi Ý Tri Thức SGK</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHintModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="font-bold text-slate-400 block mb-1">📖 Bài học SGK:</span>
                <span className="text-slate-200 font-semibold">{question?.hint_sgk_lesson || 'Chương trình GDPT Lớp 4-9'}</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="font-bold text-slate-400 block mb-1">💡 Nghĩa của từ / Cụm từ:</span>
                <span className="text-amber-300 font-semibold">{question?.hint_meaning}</span>
              </div>

              {question?.first_letter_hint && (
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30">
                  <span className="font-bold text-amber-400 block mb-1">🔤 Ký tự đầu tiên:</span>
                  <span className="text-amber-200 font-extrabold text-sm uppercase">
                    "{question.first_letter_hint}"...
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHintModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Đã Hiểu, Quay Lại Trò Chơi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
