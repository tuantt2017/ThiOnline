'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  WordScrambleQuestion,
  WordScrambleVerifyResponse,
  WordCollectionItem,
} from '@/types';
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
  BookMarked,
  AlertTriangle,
  Infinity as InfinityIcon,
  Search,
  Lock,
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
  const [stage, setStage] = useState<number>(1); // Stage 1 to 15 or Infinite (16+)
  const [maxUnlockedStage, setMaxUnlockedStage] = useState<number>(1); // Highest unlocked stage
  const [questionIndex, setQuestionIndex] = useState<number>(1); // Question 1 to 10 per stage

  // Game state
  const [question, setQuestion] = useState<WordScrambleQuestion | null>(null);
  const [scrambledList, setScrambledList] = useState<string[]>([]);
  const [selectedTiles, setSelectedTiles] = useState<(SelectedTile | null)[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [diamondBalance, setDiamondBalance] = useState<number>(0);
  const [totalCollected, setTotalCollected] = useState<number>(0);

  // Status & Feedback
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<WordScrambleVerifyResponse | null>(null);
  const [showHintModal, setShowHintModal] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(90); // 90 Seconds Timer
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Collection Modal States
  const [showCollectionModal, setShowCollectionModal] = useState<boolean>(false);
  const [collectionList, setCollectionList] = useState<WordCollectionItem[]>([]);
  const [loadingCollection, setLoadingCollection] = useState<boolean>(false);
  const [collectionFilter, setCollectionFilter] = useState<'ALL' | 'COMMON' | 'RARE' | 'LEGENDARY'>('ALL');
  const [collectionSearch, setCollectionSearch] = useState<string>('');

  // Flash Hint States
  const [flashingTileIndex, setFlashingTileIndex] = useState<number | null>(null);
  const [flashingTrayIndex, setFlashingTrayIndex] = useState<number | null>(null);
  const [flashHintMessage, setFlashHintMessage] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch question for specific subject, grade, stage and question_index
  const fetchNextQuestion = async (
    targetSub = subject,
    targetGrade = grade,
    targetStage = stage,
    targetQuestionIndex = questionIndex,
    forceRefresh = false
  ) => {
    setIsFetching(true);
    setQuestion(null); // Clear old question immediately
    setScrambledList([]);
    setSelectedTiles([]);
    setResult(null);
    setShowHintModal(false);
    setShowVictoryModal(false);
    setTimerSeconds(90); // 90 Seconds Countdown
    setFlashingTileIndex(null);
    setFlashingTrayIndex(null);
    setFlashHintMessage(null);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);

    try {
      const q = await api.getWordScrambleQuestion(targetSub, targetGrade, targetStage, targetQuestionIndex, forceRefresh);
      setQuestion(q);
      setScrambledList(q.scrambled_letters);

      if (q.max_unlocked_stage) {
        setMaxUnlockedStage((prev) => Math.max(prev, q.max_unlocked_stage!));
      }
      if (q.stage && q.stage !== targetStage) {
        setStage(q.stage);
      }

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

  // Load and sync user stage progress per subject & grade
  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    const loadAndFetch = async () => {
      const key = `word_scramble_progress_${user.id}_${subject}_${grade}`;
      let s = 1;
      let maxS = 1;
      let q = 1;
      let st = streak;

      // 1. Try reading from LocalStorage for instant UI feedback
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.stage) s = parsed.stage;
          if (parsed.maxUnlockedStage) maxS = parsed.maxUnlockedStage;
          else if (parsed.stage) maxS = Math.max(maxS, parsed.stage);
          if (parsed.questionIndex) q = parsed.questionIndex;
          if (parsed.streak !== undefined) st = parsed.streak;
        }
      } catch {}

      if (s > maxS) s = maxS;

      if (isMounted) {
        setStage(s);
        setMaxUnlockedStage(maxS);
        setQuestionIndex(q);
        setStreak(st);
      }

      // 2. Sync with backend API
      try {
        const res = await api.getWordScrambleProgress(subject, grade);
        if (res && res.stage) {
          if (res.max_unlocked_stage) {
            maxS = Math.max(maxS, res.max_unlocked_stage);
          } else {
            maxS = Math.max(maxS, res.stage);
          }
          s = Math.min(res.stage, maxS);
          q = res.question_index;
          st = res.streak;

          if (isMounted) {
            setStage(s);
            setMaxUnlockedStage(maxS);
            setQuestionIndex(q);
            setStreak(st);
            if (res.total_words_collected !== undefined) {
              setTotalCollected(res.total_words_collected);
            }
          }

          try {
            localStorage.setItem(key, JSON.stringify({ stage: s, maxUnlockedStage: maxS, questionIndex: q, streak: st }));
          } catch {}
        }
      } catch (err) {
        console.error('Failed to sync progress with backend:', err);
      }

      if (isMounted) {
        fetchNextQuestion(subject, grade, s, q);
      }
    };

    loadAndFetch();

    return () => {
      isMounted = false;
    };
  }, [user, subject, grade]);

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
      explanation: '⏰ Đã hết thời gian 90 giây! Hãy thử lại câu này để tiếp tục hành trình nhé.',
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

    setFlashingTileIndex(null);
    setFlashingTrayIndex(null);
    setFlashHintMessage(null);

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

    setFlashingTileIndex(null);
    setFlashingTrayIndex(null);
    setFlashHintMessage(null);

    setSelectedTiles((prev) => {
      const next = [...prev];
      next[trayIndex] = null;
      return next;
    });
  };

  // Reset entire answer tray (preserves hints)
  const handleResetTray = () => {
    if (result || isVerifying || isFetching) return;
    setFlashingTileIndex(null);
    setFlashingTrayIndex(null);
    setFlashHintMessage(null);
    setSelectedTiles((prev) => prev.map((t) => (t?.isHint ? t : null)));
  };

  // Flash Next Letter Hint Handler
  const handleFlashNextLetterHint = () => {
    if (!question || !question.target_word || result || isVerifying || isFetching) return;

    const rawTarget = question.target_word.trim().toUpperCase();
    let targetArray: string[] = [];
    if (question.mode === 'sentence') {
      targetArray = rawTarget.split(/\s+/);
    } else {
      targetArray = rawTarget.replace(/\s+/g, '').split('');
    }

    const emptyIdx = selectedTiles.findIndex((t) => t === null);
    if (emptyIdx === -1) {
      setFlashHintMessage('⚠️ Bạn đã chọn đủ tất cả các ô trên khay đáp án!');
      return;
    }

    const expectedItem = targetArray[emptyIdx];
    if (!expectedItem) return;

    const matchingSIndex = scrambledList.findIndex((letter, sIdx) => {
      const isSelectedInTray = selectedTiles.some((t) => t?.index === sIdx);
      return !isSelectedInTray && letter.toUpperCase() === expectedItem.toUpperCase();
    });

    if (matchingSIndex !== -1) {
      setFlashingTileIndex(matchingSIndex);
      setFlashingTrayIndex(emptyIdx);
      setFlashHintMessage(`💡 Gợi ý: Chọn ô "${expectedItem === ' ' ? 'Space' : expectedItem}" đang nháy sáng bên dưới!`);

      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlashingTileIndex(null);
        setFlashingTrayIndex(null);
        setFlashHintMessage(null);
      }, 4000);
    } else {
      setFlashHintMessage('💡 Không tìm thấy ô tự do khớp vị trí này. Thử bấm "Đặt lại" khay đáp án nhé!');
    }
  };

  // Audio TTS for English prompt or collection items
  const handlePlayAudio = (textToSpeak?: string, isEng: boolean = true) => {
    const text = textToSpeak || question?.english_audio_prompt;
    if (!text || typeof window === 'undefined') return;
    try {
      setIsPlayingAudio(true);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = isEng ? 'en-US' : 'vi-VN';
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
    }
  };

  // Open Vocabulary Collection Modal
  const handleOpenCollection = async () => {
    setShowCollectionModal(true);
    setLoadingCollection(true);
    try {
      const res = await api.getWordScrambleCollection(subject, grade);
      setCollectionList(res.items || []);
      setTotalCollected(res.total_collected || 0);
    } catch (err) {
      console.error('Failed to load vocabulary collection:', err);
    } finally {
      setLoadingCollection(false);
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

      if (res.unlocked_new_word) {
        setTotalCollected((prev) => prev + 1);
      }

      // Check if student completed question 10 of current stage -> unlock next stage
      if (res.is_correct && questionIndex === 10) {
        const nextUnlocked = stage + 1;
        setMaxUnlockedStage((prev) => {
          const updated = Math.max(prev, nextUnlocked);
          if (user) {
            const key = `word_scramble_progress_${user.id}_${subject}_${grade}`;
            try {
              localStorage.setItem(
                key,
                JSON.stringify({ stage, maxUnlockedStage: updated, questionIndex, streak: res.current_streak })
              );
            } catch {}
          }
          return updated;
        });
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

  // Action for advancing to next question / stage
  const handleNextQuestion = () => {
    let nextStage = stage;
    let nextQuestionIndex = questionIndex;

    if (questionIndex < 10) {
      nextQuestionIndex = questionIndex + 1;
    } else {
      nextStage = stage + 1; // Seamless progression into Infinite Stages (16+)
      nextQuestionIndex = 1;
    }

    const updatedMaxUnlocked = Math.max(maxUnlockedStage, nextStage);
    setStage(nextStage);
    setMaxUnlockedStage(updatedMaxUnlocked);
    setQuestionIndex(nextQuestionIndex);

    // Save progress to LocalStorage & Backend
    if (user) {
      const key = `word_scramble_progress_${user.id}_${subject}_${grade}`;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ stage: nextStage, maxUnlockedStage: updatedMaxUnlocked, questionIndex: nextQuestionIndex, streak })
        );
      } catch {}
      api.saveWordScrambleProgress({
        subject,
        grade,
        stage: nextStage,
        max_unlocked_stage: updatedMaxUnlocked,
        question_index: nextQuestionIndex,
        streak,
      }).catch(() => {});
    }

    fetchNextQuestion(subject, grade, nextStage, nextQuestionIndex);
  };

  // Jump to specific stage (1 to 15 or Infinite 16+)
  const handleSelectStage = (selectedStage: number) => {
    if (isFetching || isVerifying) return;
    if (selectedStage > maxUnlockedStage) {
      alert(`Chặng ${selectedStage} đang khóa! Bạn cần hoàn thành các chặng trước để mở khóa nhé.`);
      return;
    }
    setStage(selectedStage);
    setQuestionIndex(1);

    if (user) {
      const key = `word_scramble_progress_${user.id}_${subject}_${grade}`;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ stage: selectedStage, maxUnlockedStage, questionIndex: 1, streak })
        );
      } catch {}
      api.saveWordScrambleProgress({
        subject,
        grade,
        stage: selectedStage,
        max_unlocked_stage: maxUnlockedStage,
        question_index: 1,
        streak,
      }).catch(() => {});
    }

    fetchNextQuestion(subject, grade, selectedStage, 1);
  };

  // Re-generate 10 fresh AI words for current stage with Gemini
  const handleRefreshStageAiWords = () => {
    if (isFetching || isVerifying) return;
    fetchNextQuestion(subject, grade, stage, 1, true);
    setQuestionIndex(1);
  };

  const handleRestartJourney = () => {
    setStage(1);
    setQuestionIndex(1);

    if (user) {
      const key = `word_scramble_progress_${user.id}_${subject}_${grade}`;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ stage: 1, maxUnlockedStage, questionIndex: 1, streak: 0 })
        );
      } catch {}
      api.saveWordScrambleProgress({
        subject,
        grade,
        stage: 1,
        max_unlocked_stage: maxUnlockedStage,
        question_index: 1,
        streak: 0,
      }).catch(() => {});
    }

    fetchNextQuestion(subject, grade, 1, 1);
  };

  const handleEnterInfiniteArena = () => {
    setShowVictoryModal(false);
    const updatedMaxUnlocked = Math.max(maxUnlockedStage, 16);
    setStage(16);
    setMaxUnlockedStage(updatedMaxUnlocked);
    setQuestionIndex(1);

    if (user) {
      const key = `word_scramble_progress_${user.id}_${subject}_${grade}`;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ stage: 16, maxUnlockedStage: updatedMaxUnlocked, questionIndex: 1, streak })
        );
      } catch {}
      api.saveWordScrambleProgress({
        subject,
        grade,
        stage: 16,
        max_unlocked_stage: updatedMaxUnlocked,
        question_index: 1,
        streak,
      }).catch(() => {});
    }

    fetchNextQuestion(subject, grade, 16, 1);
  };

  if (isLoading || !user) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center p-12 bg-slate-50 text-slate-800">
        <div className="flex items-center gap-3 text-indigo-600 font-bold bg-white px-6 py-4 rounded-2xl shadow-lg border border-slate-100">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Đang tải hành trình Vua Từ Vựng SGK...</span>
        </div>
      </div>
    );
  }

  const isSentenceMode = question?.mode === 'sentence';
  const isInfinite = stage > 15 || !!question?.is_infinite_stage;
  const overallProgressPercent = isInfinite
    ? 100
    : Math.min(100, Math.round((((stage - 1) * 10 + questionIndex) / 150) * 100));

  // Filtered collection list
  const filteredCollection = collectionList.filter((item) => {
    if (collectionFilter !== 'ALL' && item.rarity !== collectionFilter) return false;
    if (collectionSearch.trim()) {
      const q = collectionSearch.trim().toLowerCase();
      return (
        item.word.toLowerCase().includes(q) ||
        (item.hint && item.hint.toLowerCase().includes(q)) ||
        (item.lesson && item.lesson.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/60 via-slate-50 to-indigo-50/30 text-slate-800 pb-20 relative select-none">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6 relative z-10">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-md shadow-slate-200/50">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl shadow-md ${
              isInfinite
                ? 'bg-gradient-to-br from-purple-500 via-indigo-600 to-amber-500 text-white shadow-purple-500/30 animate-pulse'
                : 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 shadow-amber-400/20'
            }`}>
              {isInfinite ? <InfinityIcon className="w-7 h-7" /> : <Crown className="w-7 h-7" />}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-600">
                <Sparkles className="w-3.5 h-3.5" />
                {isInfinite
                  ? `♾️ ĐẤU TRƯỜNG VÔ CỰC • CHẶNG ${stage}`
                  : 'Chinh Phục 15 Chặng Tri Thức SGK (10 Câu/Chặng)'}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Vua Từ Vựng SGK</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold">
                  {question?.rank_title || (isInfinite ? '⚔️ Đại Tướng Vô Cực' : '🥉 Học Giả Tập Sự')}
                </span>
              </h1>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Stage Counter */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-extrabold shadow-sm ${
              isInfinite
                ? 'bg-purple-50 border-purple-300 text-purple-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
            }`}>
              <Flag className="w-4 h-4 text-indigo-600" />
              <span>
                {isInfinite ? `Chặng Vô Cực ${stage}` : `Chặng ${stage}/15`} • Câu {questionIndex}/10
              </span>
            </div>

            {/* Vocabulary Album Button */}
            <button
              type="button"
              onClick={handleOpenCollection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 text-indigo-800 font-extrabold text-xs hover:from-indigo-100 hover:to-blue-100 transition shadow-sm"
              title="Mở Sổ Tay Vua Từ Vựng để xem các từ ngữ bạn đã thu thập"
            >
              <BookMarked className="w-4 h-4 text-indigo-600" />
              <span>Sổ Tay: {totalCollected} 📖</span>
            </button>

            {/* Diamond Balance */}
            <Link
              href="/student/rewards"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 font-extrabold text-xs hover:bg-amber-100/80 transition shadow-sm"
            >
              <Diamond className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{diamondBalance} 💎</span>
            </Link>

            {/* Win Streak */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 font-extrabold text-xs shadow-sm"
              title="Thưởng 1 💎 Kim Cương khi đạt 7 câu đúng liên tiếp (Tối đa nhận 2 💎/ngày)"
            >
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>Chuỗi: {streak}/7 🔥</span>
            </div>
          </div>
        </div>

        {/* Stage Progress Stepper & Theme Banner */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold text-slate-600 gap-2">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>
                {isInfinite ? (
                  <>
                    <strong className="text-purple-700">Đấu Trường Vô Cực: Chặng {stage}</strong> (Câu {questionIndex}/10)
                  </>
                ) : (
                  <>
                    Tiến Độ: <strong>Chặng {stage}/15</strong> (Câu {questionIndex}/10)
                  </>
                )}
              </span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-amber-800 font-extrabold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{question?.theme_title || 'Chủ điểm: Khám Phá Tri Thức SGK'}</span>
              </span>

              {/* Regenerate Stage AI Words Button */}
              <button
                type="button"
                onClick={handleRefreshStageAiWords}
                disabled={isFetching}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black transition shadow-xs active:scale-95 disabled:opacity-50"
                title="Yêu cầu Gemini AI tạo 1 bộ 10 từ mới toanh cho chặng này"
              >
                <RefreshCw className={`w-3 h-3 text-amber-600 ${isFetching ? 'animate-spin' : ''}`} />
                <span>Đổi Bộ Từ AI 🎲</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isInfinite
                  ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-amber-400 animate-pulse'
                  : 'bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-600'
              }`}
              style={{ width: `${overallProgressPercent}%` }}
            />
          </div>

          {/* Interactive Stage Selector Bar */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Flag className="w-3 h-3 text-indigo-500" />
                <span>Bản Đồ Chặng (AI tạo sẵn 10 từ cho mỗi chặng):</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
                Click vào chặng để AI chuẩn bị từ vựng
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((sNum) => {
                const isActive = stage === sNum;
                const isLocked = sNum > maxUnlockedStage;
                const isCompleted = sNum < maxUnlockedStage;
                return (
                  <button
                    key={sNum}
                    type="button"
                    onClick={() => handleSelectStage(sNum)}
                    disabled={isFetching || isLocked}
                    title={
                      isLocked
                        ? `Chặng ${sNum} đang khóa - Hãy hoàn thành Chặng ${sNum - 1} trước`
                        : isCompleted
                        ? `Chặng ${sNum} (Đã hoàn thành - Bấm để luyện lại)`
                        : `Chặng ${sNum} (Chặng hiện tại)`
                    }
                    className={`flex-shrink-0 px-2.5 py-1 rounded-xl font-black text-xs transition border flex items-center gap-1 ${
                      isLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : isActive
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md scale-105 ring-2 ring-amber-300'
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 hover:bg-amber-50 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>C.{sNum}</span>
                      </>
                    ) : isCompleted ? (
                      <>
                        <span>C.{sNum}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                      </>
                    ) : (
                      <span>C.{sNum}</span>
                    )}
                  </button>
                );
              })}
              {/* Infinite Arena Shortcut Button */}
              {(() => {
                const isInfiniteLocked = maxUnlockedStage < 16;
                return (
                  <button
                    type="button"
                    onClick={() => handleSelectStage(16)}
                    disabled={isFetching || isInfiniteLocked}
                    title={
                      isInfiniteLocked
                        ? 'Đấu Trường Vô Cực đang khóa - Vượt qua Chặng 15 để mở khóa!'
                        : 'Đấu Trường Vô Cực (Chặng 16+)'
                    }
                    className={`flex-shrink-0 px-2.5 py-1 rounded-xl font-black text-xs transition border flex items-center gap-1 ${
                      isInfiniteLocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : stage >= 16
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-105 ring-2 ring-purple-300'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
                    }`}
                  >
                    {isInfiniteLocked ? (
                      <>
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Vô Cực</span>
                      </>
                    ) : (
                      <>
                        <InfinityIcon className="w-3 h-3" />
                        <span>Vô Cực</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Filter Controls (Subject & Grade Selectors) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Subject Switcher */}
          <div className="flex bg-slate-200/80 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setSubject('Tiếng Việt')}
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
              onClick={() => setSubject('Tiếng Anh')}
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
                  onClick={() => setGrade(g)}
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
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span>
                    {questionIndex === 1
                      ? `Gemini AI đang tạo 1 list 10 từ cho Chặng ${stage}...`
                      : `Đang tải ${isInfinite ? `Chặng Vô Cực ${stage}` : `Chặng ${stage}/15`} - Câu ${questionIndex}/10...`}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {questionIndex === 1
                    ? '⚡ Chỉ mất 1 lần gọi AI tạo sẵn 1 thể toàn bộ 10 từ của chặng. Các câu 2 đến 10 sẽ mở tức thì không cần chờ!'
                    : '⚡ Lấy từ bộ từ vựng đã được AI tạo sẵn cho chặng này (phản hồi tức thì).'}
                </p>
              </div>
            </div>
          ) : (

            <>
              {/* Stage Top Bar: Mode Banner, Timer & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200/60 font-bold text-xs">
                    {isSentenceMode ? '🧩 Sắp Xếp Câu / Thành Ngữ' : '🔤 Xếp Chữ Cái (Từ ghép)'}
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    Cần xếp: <strong className="text-amber-600">{question.letter_count}</strong>{' '}
                    {isSentenceMode ? 'tiếng/từ' : 'chữ cái'}
                  </span>
                  {question.has_distractors && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-extrabold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-500" />
                      <span>Có chữ gây nhiễu!</span>
                    </span>
                  )}
                  {question.rarity && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      question.rarity === 'LEGENDARY'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : question.rarity === 'RARE'
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {question.rarity === 'LEGENDARY' ? '👑 Huyền Thoại' : question.rarity === 'RARE' ? '⭐ Hiếm' : '🌱 Phổ Biến'}
                    </span>
                  )}
                </div>

                {/* Countdown Timer (90s) & Buttons */}
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold border transition ${
                      timerSeconds <= 20
                        ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                        : 'bg-slate-100 text-amber-700 border-slate-200'
                    }`}
                  >
                    <span>⏱️</span>
                    <span>{timerSeconds}s</span>
                  </div>

                  {/* Hint & Audio Prompt Buttons */}
                  <button
                    type="button"
                    onClick={handleFlashNextLetterHint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 text-slate-950 font-black text-xs hover:brightness-105 active:scale-95 transition shadow-sm border border-amber-300"
                    title="Nhấp để làm nháy sáng ô chữ/tiếng tiếp theo cần chọn"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Gợi Ý Nháy Sáng</span>
                  </button>

                  {subject === 'Tiếng Anh' && question.english_audio_prompt && (
                    <button
                      type="button"
                      onClick={() => handlePlayAudio()}
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

              {/* Hint Quick Banner & Visual Emoji Clues */}
              <div className="space-y-3">
                {flashHintMessage && (
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 font-black text-xs text-center shadow-md animate-bounce border border-amber-300">
                    {flashHintMessage}
                  </div>
                )}

                {/* VISUAL EMOJI CLUES (Gợi ý hình tượng AI) */}
                {question.emoji_clues && question.emoji_clues.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-indigo-50/90 border border-amber-200/90 shadow-sm gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <span className="p-1.5 bg-amber-200/60 rounded-lg text-sm">💡</span>
                      <span>Gợi ý hình tượng liên tưởng (AI Clue):</span>
                    </div>
                    <div className="flex items-center gap-2 justify-center bg-white/80 px-4 py-1.5 rounded-xl border border-amber-200 shadow-xs">
                      {question.emoji_clues.map((em, idx) => (
                        <span key={idx} className="text-2xl hover:scale-125 transition-transform" title="Emoji gợi ý">
                          {em}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {question.pre_filled_hints && question.pre_filled_hints.length > 0 && (
                  <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-2xl bg-gradient-to-r from-amber-100 via-amber-50 to-orange-100 border border-amber-300 text-amber-900 text-xs font-bold shadow-xs">
                    <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                    <span>
                      💡 Thử thách: Đã mở sẵn <strong>{question.pre_filled_hints.length}</strong>{' '}
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
                        const isTrayFlashing = idx === flashingTrayIndex;
                        return (
                          <div
                            key={`empty-slot-${idx}`}
                            className={`flex items-center justify-center border-2 rounded-xl font-extrabold transition select-none ${
                              isTrayFlashing
                                ? 'border-amber-500 bg-amber-200/90 text-amber-950 ring-4 ring-amber-300 animate-pulse scale-105'
                                : 'border-dashed border-slate-300/80 bg-slate-100/50 text-slate-400'
                            } ${isSentenceMode ? 'h-11 min-w-[70px] px-3 text-xs' : 'h-12 min-w-[48px] px-3 text-sm'}`}
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
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>
                    {isSentenceMode
                      ? 'Các Tiếng / Từ Đảo Lộn (Bấm Để Chọn):'
                      : 'Các Ký Tự Đảo Lộn (Bấm Để Chọn):'}
                  </span>
                  {question.has_distractors && (
                    <span className="text-[11px] text-amber-600 italic">
                      * Chú ý: Bàn có chứa chữ thừa gây nhiễu, hãy chọn đúng số ô đáp án!
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 py-2">
                  {scrambledList.map((letter, index) => {
                    const isSelected = selectedTiles.some((t) => t?.index === index);
                    const isFlashing = index === flashingTileIndex;
                    return (
                      <button
                        key={`scrambled-${index}`}
                        type="button"
                        disabled={isSelected || !!result}
                        onClick={() => handleTileClick(index, letter)}
                        className={`transition flex items-center justify-center shadow-md ${
                          isSentenceMode
                            ? 'h-12 px-4 rounded-2xl font-black text-sm border-b-4'
                            : 'h-14 min-w-[54px] px-3.5 rounded-2xl font-black text-xl border-b-4'
                        } ${
                          isFlashing
                            ? 'ring-4 ring-amber-400 ring-offset-2 animate-bounce bg-gradient-to-b from-amber-300 via-amber-400 to-yellow-500 border-amber-300 text-slate-950 font-black scale-110 shadow-xl shadow-amber-400/80 z-20'
                            : isSelected
                            ? 'opacity-25 scale-90 border-transparent bg-slate-200 text-slate-400 cursor-not-allowed'
                            : isSentenceMode
                            ? 'bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 border-amber-600 text-slate-950 shadow-amber-200 hover:scale-105 active:scale-95'
                            : 'bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-indigo-800 text-white shadow-indigo-200 hover:scale-110 active:scale-95'
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
                        <span>
                          Nộp Đáp Án Câu {questionIndex}/10 ({isInfinite ? `Chặng Vô Cực ${stage}` : `Chặng ${stage}`})
                        </span>
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

                    <div className="flex-1 space-y-1.5">
                      <div className="text-base font-black flex flex-wrap items-center gap-2 text-slate-900">
                        <span>
                          {result.is_correct
                            ? `🎉 CHÍNH XÁC! HOÀN THÀNH CÂU ${questionIndex}/10 (${isInfinite ? `CHẶNG VÔ CỰC ${stage}` : `CHẶNG ${stage}`})`
                            : `❌ CHƯA CHÍNH XÁC (CÂU ${questionIndex}/10)`}
                        </span>
                        {result.earned_diamonds > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold animate-bounce">
                            <Award className="w-3.5 h-3.5" /> +{result.earned_diamonds} 💎 Thưởng Streak!
                          </span>
                        )}
                        {result.unlocked_new_word && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 font-extrabold">
                            <BookMarked className="w-3.5 h-3.5 text-indigo-600" /> +1 Mở Khóa Sổ Tay!
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
                          onClick={() => {
                            if (stage === 15) {
                              setShowVictoryModal(true);
                            } else {
                              handleNextQuestion();
                            }
                          }}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 text-white font-black text-xs shadow-md shadow-purple-200 transition flex items-center gap-2"
                        >
                          <InfinityIcon className="w-4 h-4" />
                          <span>
                            {stage === 15
                              ? '🏆 Xem Vinh Danh 15 Chặng'
                              : `🚀 Tiếp Tục Chặng Vô Cực ${stage + 1}`}
                          </span>
                          <ChevronRight className="w-4 h-4" />
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
                <span>Gợi Ý Tri Thức SGK - {isInfinite ? `Chặng Vô Cực ${stage}` : `Chặng ${stage}`}</span>
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

      {/* VOCABULARY ALBUM MODAL (SỔ TAY VUA TỪ VỰNG) */}
      {showCollectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-sm">
                  <BookMarked className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Sổ Tay Vua Từ Vựng SGK
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đã mở khóa <strong>{collectionList.length}</strong> từ vựng {subject} Lớp {grade}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold p-1 rounded-xl hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCollectionFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    collectionFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất Cả ({collectionList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionFilter('COMMON')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    collectionFilter === 'COMMON' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🌱 Thường
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionFilter('RARE')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    collectionFilter === 'RARE' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⭐ Hiếm
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionFilter('LEGENDARY')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    collectionFilter === 'LEGENDARY' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  👑 Huyền Thoại
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  placeholder="Tìm kiếm từ đã mở khóa..."
                  className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {/* List / Cards Container */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[240px]">
              {loadingCollection ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs">Đang tải thẻ bài từ vựng...</span>
                </div>
              ) : filteredCollection.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">
                    {collectionList.length === 0
                      ? 'Bạn chưa mở khóa từ vựng nào. Hãy hoàn thành các câu đố để lưu từ vào sổ tay nhé!'
                      : 'Không tìm thấy từ vựng nào khớp với bộ lọc.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredCollection.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition shadow-xs flex flex-col justify-between space-y-2 ${
                        item.rarity === 'LEGENDARY'
                          ? 'bg-gradient-to-br from-amber-50 to-orange-50/60 border-amber-300'
                          : item.rarity === 'RARE'
                          ? 'bg-gradient-to-br from-purple-50 to-indigo-50/60 border-purple-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            item.rarity === 'LEGENDARY'
                              ? 'bg-amber-200 text-amber-900'
                              : item.rarity === 'RARE'
                              ? 'bg-purple-200 text-purple-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.rarity === 'LEGENDARY' ? '👑 Huyền Thoại' : item.rarity === 'RARE' ? '⭐ Hiếm' : '🌱 Phổ Biến'}
                          </span>

                          {item.emoji_clues && item.emoji_clues.length > 0 && (
                            <span className="text-base tracking-widest">{item.emoji_clues.join('')}</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <h4 className="font-black text-sm text-slate-900">{item.word}</h4>
                          <button
                            type="button"
                            onClick={() => handlePlayAudio(item.word, item.subject === 'Tiếng Anh')}
                            className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white/80 transition"
                            title="Nghe phát âm"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.hint && (
                          <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                            {item.hint}
                          </p>
                        )}
                      </div>

                      {item.lesson && (
                        <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100 truncate">
                          📖 {item.lesson}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Đóng Sổ Tay
              </button>
            </div>
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
                Bạn đã vượt qua xuất sắc cả 15 Chặng xếp từ và sắp xếp thành ngữ môn {subject} Lớp {grade}! Giờ đây bạn đã đủ điều kiện tiến vào <strong>Đấu Trường Vô Cực</strong> để thử thách các cấp bậc huyền thoại cao hơn!
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
            <div className="space-y-2.5 pt-2">
              {/* Enter Infinite Arena Button */}
              <button
                type="button"
                onClick={handleEnterInfiniteArena}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:brightness-110 text-white font-black text-sm shadow-xl shadow-purple-300 transition flex items-center justify-center gap-2"
              >
                <InfinityIcon className="w-5 h-5" />
                <span>🔥 MỞ KHÓA ĐẤU TRƯỜNG VÔ CỰC (CHẶNG 16+)</span>
              </button>

              <button
                type="button"
                onClick={handleRestartJourney}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Chơi Lại Từ Chặng 1</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowVictoryModal(false);
                  const nextSub = subject === 'Tiếng Việt' ? 'Tiếng Anh' : 'Tiếng Việt';
                  setSubject(nextSub);
                }}
                className="w-full py-2.5 rounded-2xl text-slate-500 hover:text-slate-800 font-semibold text-xs transition"
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
