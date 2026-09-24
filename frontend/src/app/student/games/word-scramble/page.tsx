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
  Loader2,
  Trophy,
  Flag,
  ChevronRight,
  Star,
} from 'lucide-react';

interface SelectedTile {
  index: number;
  letter: string;
  isHint?: boolean;
  targetIndex?: number;
}

export default function WordScrambleGamePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Controls
  const [subject, setSubject] = useState<'Tiếng Việt' | 'Tiếng Anh'>('Tiếng Việt');
  const [grade, setGrade] = useState<number>(5);
  const [stage, setStage] = useState<number>(1); // Stage 1 to 15
  const [questionIndex, setQuestionIndex] = useState<number>(1); // Question 1 to 10 per stage

  // Game state
  const [question, setQuestion] = useState<WordScrambleQuestion | null>(null);
  const [scrambledList, setScrambledList] = useState<string[]>([]);
  const [selectedTiles, setSelectedTiles] = useState<(SelectedTile | null)[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [diamondBalance, setDiamondBalance] = useState<number>(0);

  // Status & Feedback
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<WordScrambleVerifyResponse | null>(null);
  const [showHintModal, setShowHintModal] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(90); // 90 Seconds Timer
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

  // Fetch question for specific subject, grade, stage (1-15) and question_index (1-10)
  const fetchNextQuestion = async (
    targetSub = subject,
    targetGrade = grade,
    targetStage = stage,
    targetQuestionIndex = questionIndex
  ) => {
    setIsFetching(true);
    setQuestion(null); // Clear old question immediately
    setScrambledList([]);
    setSelectedTiles([]);
    setResult(null);
    setShowHintModal(false);
    setShowVictoryModal(false);
    setTimerSeconds(90); // 90 Seconds Countdown

    try {
      const q = await api.getWordScrambleQuestion(targetSub, targetGrade, targetStage, targetQuestionIndex);
      setQuestion(q);
      setScrambledList(q.scrambled_letters);

      // Pre-fill answer tray with hint tiles if present
      const initial: (SelectedTile | null)[] = Array(q.letter_count).fill(null);
      if (q.pre_filled_hints && q.pre_filled_hints.length > 0) {
        q.pre_filled_hints.forEach((hint) => {
          if (hint.target_index >= 0 && hint.target_index < q.letter_count) {
            initial[hint.target_index] = {
              index: hint.scrambled_index,
              letter: hint.letter,
              isHint: true,
              targetIndex: hint.target_index,
            };
          }
        });
      }
      setSelectedTiles(initial);
    } catch (err: any) {
      alert(`Lỗi khi tải câu hỏi Chặng ${targetStage} (Câu ${targetQuestionIndex}/10): ${err.message}`);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNextQuestion(subject, grade, stage, questionIndex);
    }
  }, [user, subject, grade, stage, questionIndex]);

  // Timer Countdown (90s)
  useEffect(() => {
    if (!question || result || isFetching) return;
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
  }, [timerSeconds, question, result, isFetching]);

  const handleTimeOut = () => {
    if (!question || result) return;
    const activeTiles = selectedTiles.filter((t): t is SelectedTile => t !== null);
    setResult({
      is_correct: false,
      target_word: 'HẾT GIỜ',
      user_answer: activeTiles.map((t) => t.letter).join(question.mode === 'sentence' ? ' ' : ''),
      explanation: '⏰ Đã hết thời gian 90 giây! Hãy thử lại Chặng này để tiếp tục hành trình nhé.',
      current_streak: 0,
      earned_diamonds: 0,
      new_diamond_balance: diamondBalance,
    });
    setStreak(0);
  };

  // Handle Tile Click in Scrambled Grid
  const handleTileClick = (index: number, letter: string) => {
    if (result || isVerifying || isFetching) return;
    if (selectedTiles.some((t) => t?.index === index)) return;

    const firstEmptyIndex = selectedTiles.findIndex((t) => t === null);
    if (firstEmptyIndex === -1) return;

    setSelectedTiles((prev) => {
      const next = [...prev];
      next[firstEmptyIndex] = { index, letter };
      return next;
    });
  };

  // Handle Remove Tile from Answer Tray
  const handleRemoveTrayTile = (trayIndex: number) => {
    if (result || isVerifying || isFetching) return;
    if (selectedTiles[trayIndex]?.isHint) return; // Hint tiles are locked

    setSelectedTiles((prev) => {
      const next = [...prev];
      next[trayIndex] = null;
      return next;
    });
  };

  // Reset entire answer tray (preserves hints)
  const handleResetTray = () => {
    if (result || isVerifying || isFetching) return;
    setSelectedTiles((prev) => prev.map((t) => (t?.isHint ? t : null)));
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
    const activeTiles = selectedTiles.filter((t): t is SelectedTile => t !== null);
    if (!question || activeTiles.length === 0 || isVerifying) return;

    const isSentenceMode = question.mode === 'sentence';
    const builtAnswer = activeTiles.map((t) => t.letter).join(isSentenceMode ? ' ' : '');
    setIsVerifying(true);

    try {
      const res = await api.verifyWordScrambleAnswer(question.game_id, builtAnswer, streak);
      setResult(res);
      setStreak(res.current_streak);

      if (res.new_diamond_balance !== undefined && res.new_diamond_balance !== null) {
        setDiamondBalance(res.new_diamond_balance);
      }

      // Check if student reached Stage 15 Question 10 Victory
      if (res.is_correct && stage === 15 && questionIndex === 10) {
        setTimeout(() => {
          setShowVictoryModal(true);
        }, 1200);
      }
    } catch (err: any) {
      alert(`Lỗi kiểm tra đáp án: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Action for advancing to next question / stage or replaying
  const handleNextQuestion = () => {
    if (questionIndex < 10) {
      setQuestionIndex((prev) => prev + 1);
    } else if (stage < 15) {
      setStage((prev) => prev + 1);
      setQuestionIndex(1);
    } else {
      setStage(1);
      setQuestionIndex(1);
    }
  };

  const handleRestartJourney = () => {
    setStage(1);
    setQuestionIndex(1);
    fetchNextQuestion(subject, grade, 1, 1);
  };

  if (isLoading || !user) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center p-12 bg-slate-50 text-slate-800">
        <div className="flex items-center gap-3 text-indigo-600 font-bold bg-white px-6 py-4 rounded-2xl shadow-lg border border-slate-100">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Đang tải hành trình 15 Chặng Vua Từ Vựng SGK...</span>
        </div>
      </div>
    );
  }

  const isSentenceMode = question?.mode === 'sentence';
  const overallProgressPercent = Math.round((((stage - 1) * 10 + questionIndex) / 150) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/60 via-slate-50 to-indigo-50/30 text-slate-800 pb-20 relative select-none">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6 relative z-10">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-md shadow-slate-200/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 rounded-2xl shadow-md shadow-amber-400/20">
              <Crown className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-600">
                <Sparkles className="w-3.5 h-3.5" /> Chinh Phục 15 Chặng Tri Thức SGK (10 Câu/Chặng)
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Vua Từ Vựng SGK
              </h1>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-3">
            {/* Stage & Question Counter */}
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs shadow-sm">
              <Flag className="w-4 h-4 text-indigo-600" />
              <span>Chặng {stage}/15 • Câu {questionIndex}/10</span>
            </div>

            {/* Diamond Balance */}
            <Link
              href="/student/rewards"
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 font-extrabold text-xs hover:bg-amber-100/80 transition shadow-sm"
            >
              <Diamond className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
              <span>{diamondBalance} 💎</span>
            </Link>

            {/* Win Streak */}
            <div
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 font-extrabold text-xs shadow-sm"
              title="Thưởng 1 💎 Kim Cương khi đạt 7 câu đúng liên tiếp (Tối đa nhận 2 💎/ngày)"
            >
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>Chuỗi: {streak}/7 🔥</span>
            </div>
          </div>
        </div>

        {/* Stage Progress Stepper (1-15 & 1-10) */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>
                Tiến Độ: <strong>Chặng {stage}/15</strong> (Câu {questionIndex}/10)
              </span>
            </span>
            <span className="text-slate-500 font-semibold">
              {stage <= 5
                ? '⭐ Cấp Độ Cơ Bản (Từ ghép 2 tiếng)'
                : stage <= 10
                ? '🔥🔥 Cấp Độ Trung Bình (Cụm từ 2-3 tiếng)'
                : '👑 Cấp Độ Thách Thức (Thành ngữ / Câu nói SGK)'}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${overallProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Filter Controls (Subject & Grade Selectors) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Subject Switcher */}
          <div className="flex bg-slate-200/80 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setSubject('Tiếng Việt');
                setStage(1);
                setQuestionIndex(1);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition ${
                subject === 'Tiếng Việt'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>🇻🇳 Vua Tiếng Việt</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubject('Tiếng Anh');
                setStage(1);
                setQuestionIndex(1);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition ${
                subject === 'Tiếng Anh'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>🇬🇧 King of English</span>
            </button>
          </div>

          {/* Grade Selector */}
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/40">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Khối lớp SGK:
            </span>
            <div className="flex gap-1.5">
              {[4, 5, 6, 7, 8, 9].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGrade(g);
                    setStage(1);
                    setQuestionIndex(1);
                  }}
                  className={`w-8 h-8 rounded-xl text-xs font-black transition ${
                    grade === g
                      ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Game Stage */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-8 relative">
          {/* Loading State when fetching new question */}
          {isFetching || !question ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-full animate-bounce shadow-md border border-amber-200">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Đang tải Chặng {stage}/15 - Câu {questionIndex}/10...</span>
                </h3>
                <p className="text-xs text-slate-500">
                  AI đang biên soạn từ vựng SGK Lớp {grade} môn {subject} không trùng lặp cho học sinh
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Stage Top Bar: Mode Banner, Timer & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200/60 font-bold text-xs">
                    {isSentenceMode ? '🧩 Sắp Xếp Câu / Thành Ngữ' : '🔤 Xếp Chữ Cái (Từ ghép)'}
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    Cần xếp: <strong className="text-amber-600">{question.letter_count}</strong>{' '}
                    {isSentenceMode ? 'tiếng/từ' : 'chữ cái'}
                  </span>
                </div>

                {/* Countdown Timer (90s) */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold border transition ${
                      timerSeconds <= 20
                        ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                        : 'bg-slate-100 text-amber-700 border-slate-200'
                    }`}
                  >
                    <span>⏱️</span>
                    <span>{timerSeconds}s</span>
                  </div>

                  {/* Hint & Audio Prompt Buttons */}
                  {subject === 'Tiếng Anh' && question.english_audio_prompt && (
                    <button
                      type="button"
                      onClick={handlePlayAudio}
                      disabled={isPlayingAudio}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold hover:bg-teal-100 transition shadow-xs"
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                      <span>Nghe Mẫu</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHintModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition shadow-xs"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Gợi Ý SGK</span>
                  </button>
                </div>
              </div>

              {/* Hint Quick Banner & Pre-filled Hint Badge */}
              <div className="space-y-2">
                {question.pre_filled_hints && question.pre_filled_hints.length > 0 && (
                  <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-2xl bg-gradient-to-r from-amber-100 via-amber-50 to-orange-100 border border-amber-300 text-amber-900 text-xs font-bold shadow-xs">
                    <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                    <span>
                      💡 Thử thách điền từ: Đã gợi ý sẵn <strong>{question.pre_filled_hints.length}</strong>{' '}
                      {isSentenceMode ? 'từ/tiếng' : 'chữ cái'} trong khay đáp án!
                    </span>
                  </div>
                )}

                {question.hint_meaning && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs font-medium text-amber-900 leading-relaxed text-center shadow-xs">
                    <strong className="text-amber-700 font-extrabold">💡 Gợi Ý Định Nghĩa SGK:</strong>{' '}
                    {question.hint_meaning}
                  </div>
                )}
              </div>

              {/* ANSWER TRAY AREA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>
                    Khay Đáp Án Của Bạn{' '}
                    {isSentenceMode ? '(Sắp xếp các tiếng thành câu)' : '(Sắp xếp chữ cái)'}:
                  </span>
                  {selectedTiles.some((t) => t !== null && !t.isHint) && !result && (
                    <button
                      type="button"
                      onClick={handleResetTray}
                      className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600 transition text-[11px] font-bold"
                    >
                      <RotateCcw className="w-3 h-3" /> Đặt lại
                    </button>
                  )}
                </div>

                <div className="min-h-[84px] p-3.5 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-wrap items-center justify-center gap-2.5 transition">
                  {selectedTiles.length === 0 ? (
                    <span className="text-xs font-medium text-slate-400 italic">
                      {isSentenceMode
                        ? 'Bấm vào các ô tiếng/từ phía dưới theo thứ tự để ghép thành câu...'
                        : 'Bấm vào các ô chữ cái phía dưới theo thứ tự để ghép từ...'}
                    </span>
                  ) : (
                    selectedTiles.map((tile, idx) => {
                      if (!tile) {
                        return (
                          <div
                            key={`empty-slot-${idx}`}
                            className={`flex items-center justify-center border-2 border-dashed border-slate-300/80 bg-slate-100/50 rounded-xl text-slate-400 font-bold transition select-none ${
                              isSentenceMode ? 'h-11 min-w-[70px] px-3 text-xs' : 'h-12 min-w-[48px] px-3 text-sm'
                            }`}
                          >
                            _
                          </div>
                        );
                      }

                      if (tile.isHint) {
                        return (
                          <div
                            key={`hint-slot-${tile.index}-${idx}`}
                            className={`relative flex items-center justify-center font-black rounded-xl border-2 shadow-md transition ${
                              isSentenceMode
                                ? 'h-11 px-4 text-sm tracking-wide bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-300 shadow-emerald-200/50'
                                : 'h-12 min-w-[48px] px-3.5 text-lg bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-amber-200'
                            }`}
                            title="Chữ gợi ý sẵn (được khóa cố định)"
                          >
                            <span className="absolute -top-2 -right-1 bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs border border-white flex items-center gap-0.5">
                              💡
                            </span>
                            {tile.letter === ' ' ? '␣' : tile.letter}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={`user-slot-${tile.index}-${idx}`}
                          type="button"
                          onClick={() => handleRemoveTrayTile(idx)}
                          className={`${
                            isSentenceMode
                              ? 'h-11 px-4 text-sm tracking-wide rounded-xl font-extrabold shadow-sm bg-gradient-to-b from-indigo-500 to-indigo-600 text-white border-b-2 border-indigo-800'
                              : 'h-12 min-w-[48px] px-3 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-black text-lg border-b-2 border-amber-600 shadow-md shadow-amber-200'
                          } hover:scale-105 active:scale-95 transition flex items-center justify-center`}
                        >
                          {tile.letter === ' ' ? '␣' : tile.letter}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SCRAMBLED TILES SELECTION GRID */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-500 px-1">
                  {isSentenceMode
                    ? 'Các Tiếng / Từ Đảo Lộn (Bấm Để Chọn):'
                    : 'Các Ký Tự Đảo Lộn (Bấm Để Chọn):'}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 py-2">
                  {scrambledList.map((letter, index) => {
                    const isSelected = selectedTiles.some((t) => t?.index === index);
                    return (
                      <button
                        key={`scrambled-${index}`}
                        type="button"
                        disabled={isSelected || !!result}
                        onClick={() => handleTileClick(index, letter)}
                        className={`transition flex items-center justify-center shadow-md ${
                          isSentenceMode
                            ? `h-12 px-4 rounded-2xl font-black text-sm border-b-4 ${
                                isSelected
                                  ? 'opacity-25 scale-90 border-transparent bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 border-amber-600 text-slate-950 shadow-amber-200 hover:scale-105 active:scale-95'
                              }`
                            : `h-14 min-w-[54px] px-3.5 rounded-2xl font-black text-xl border-b-4 ${
                                isSelected
                                  ? 'opacity-25 scale-90 border-transparent bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-indigo-800 text-white shadow-indigo-200 hover:scale-110 active:scale-95'
                              }`
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
                    disabled={!selectedTiles.some((t) => t !== null) || isVerifying}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-200/80 disabled:opacity-40 transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-5 h-5 fill-slate-950" />
                        <span>Nộp Đáp Án Câu {questionIndex}/10 (Chặng {stage})</span>
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
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950 shadow-md shadow-emerald-100'
                      : 'bg-rose-50 border-rose-200 text-rose-950 shadow-md shadow-rose-100'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {result.is_correct ? (
                      <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                    ) : (
                      <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-md">
                        <XCircle className="w-7 h-7" />
                      </div>
                    )}

                    <div className="flex-1 space-y-1">
                      <div className="text-base font-black flex items-center gap-2 text-slate-900">
                        <span>
                          {result.is_correct
                            ? `🎉 CHÍNH XÁC! HOÀN THÀNH CÂU ${questionIndex}/10 (CHẶNG ${stage})`
                            : `❌ CHƯA CHÍNH XÁC (CÂU ${questionIndex}/10)`}
                        </span>
                        {result.earned_diamonds > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold animate-bounce">
                            <Award className="w-3.5 h-3.5" /> +{result.earned_diamonds} 💎 Thưởng Streak!
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium leading-relaxed text-slate-700">
                        {result.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Next Question / Stage Action */}
                  <div className="flex justify-end pt-2 border-t border-slate-200/60">
                    {result.is_correct ? (
                      questionIndex < 10 ? (
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-200 transition flex items-center gap-2"
                        >
                          <span>Sang Câu Tiếp Theo (Câu {questionIndex + 1}/10)</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : stage < 15 ? (
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-200 transition flex items-center gap-2"
                        >
                          <span>🚀 Hoàn Thành Chặng {stage} &rarr; Tiến Vào Chặng {stage + 1}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowVictoryModal(true)}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shadow-md shadow-amber-200 transition flex items-center gap-2"
                        >
                          <Trophy className="w-4 h-4" />
                          <span>Xem Vinh Danh Hoàn Thành Xuất Sắc 15 Chặng</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => fetchNextQuestion(subject, grade, stage, questionIndex)}
                        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs shadow-md transition flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Thử Lại Câu {questionIndex}/10</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* SGK HINT MODAL */}
      {showHintModal && question && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600 font-extrabold text-sm">
                <Lightbulb className="w-5 h-5 fill-amber-500 text-amber-500" />
                <span>Gợi Ý Tri Thức SGK - Chặng {stage}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHintModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="font-bold text-slate-500 block mb-1">📖 Bài học SGK:</span>
                <span className="text-slate-800 font-semibold">{question.hint_sgk_lesson || 'Chương trình GDPT Lớp 4-9'}</span>
              </div>

              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80">
                <span className="font-bold text-amber-700 block mb-1">💡 Nghĩa của từ / Cụm từ:</span>
                <span className="text-amber-900 font-semibold">{question.hint_meaning}</span>
              </div>

              {question.first_letter_hint && (
                <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200">
                  <span className="font-bold text-indigo-600 block mb-1">
                    {isSentenceMode ? '🔤 Từ đầu tiên:' : '🔤 Ký tự đầu tiên:'}
                  </span>
                  <span className="text-indigo-900 font-extrabold text-sm uppercase">
                    "{question.first_letter_hint}"...
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHintModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-md"
            >
              Đã Hiểu, Quay Lại Trò Chơi
            </button>
          </div>
        </div>
      )}

      {/* STAGE 15 VICTORY MODAL */}
      {showVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in zoom-in-95 duration-200">
          <div className="w-full max-w-lg bg-white border border-amber-200 rounded-3xl p-8 space-y-6 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-200/40 rounded-full blur-2xl pointer-events-none" />

            <div className="inline-flex p-4 bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 rounded-3xl shadow-xl shadow-amber-200 animate-bounce">
              <Trophy className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Xuất Sắc Hoàn Thành 15 Chặng
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                Chúc Mừng Tân Vua Từ Vựng SGK!
              </h2>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Bạn đã vượt qua xuất sắc cả 15 Chặng xếp từ và sắp xếp thành ngữ môn {subject} Lớp {grade}!
              </p>
            </div>

            {/* Achievement Stats Box */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 text-orange-600 rounded-xl font-bold">
                  <Flame className="w-5 h-5 fill-orange-500" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Chuỗi Thắng</span>
                  <strong className="text-sm font-black text-slate-900">{streak} Câu 🔥</strong>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl font-bold">
                  <Diamond className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Số Dư Kim Cương</span>
                  <strong className="text-sm font-black text-amber-600">{diamondBalance} 💎</strong>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleRestartJourney}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-200 transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi Lại Từ Chặng 1</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowVictoryModal(false);
                  const nextSub = subject === 'Tiếng Việt' ? 'Tiếng Anh' : 'Tiếng Việt';
                  setSubject(nextSub);
                  setStage(1);
                }}
                className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition"
              >
                Chuyển Sang Môn {subject === 'Tiếng Việt' ? '🇬🇧 Tiếng Anh' : '🇻🇳 Tiếng Việt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
