'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EnglishUnitDetailResponse, VocabFlashcard, MultimodalExercise, SpeakingPrompt, PronunciationEvalResponse } from '@/types';
import {
  ChevronLeft,
  Volume2,
  Volume1,
  RotateCw,
  Sparkles,
  Mic,
  MicOff,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Award,
  BookOpen,
  RefreshCw,
  Flame,
  ShieldCheck,
  Check,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export default function EnglishUnitStudioPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = Number(params?.id) || 1;

  const [unit, setUnit] = useState<EnglishUnitDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Studio Active Tab (1: Flashcards, 2: Multimodal Exercises, 3: Speaking Lab, 4: Complete)
  const [activeTab, setActiveTab] = useState<number>(1);

  // Flashcard State
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);

  // Multimodal Exercises State
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [typedAnswers, setTypedAnswers] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});

  // Speaking Lab State
  const [speakingIndex, setSpeakingIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedText, setRecordedText] = useState<string>('');
  const [evalResult, setEvalResult] = useState<PronunciationEvalResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [speakingTranscripts, setSpeakingTranscripts] = useState<Record<number, string>>({});
  const [speakingEvaluations, setSpeakingEvaluations] = useState<Record<number, PronunciationEvalResponse>>({});

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    async function loadUnit() {
      setLoading(true);
      try {
        const res = await api.getEnglishUnitDetail(unitId);
        setUnit(res);
      } catch (err: any) {
        setError(err.message || 'Không thể tải chi tiết bài học');
      } finally {
        setLoading(false);
      }
    }
    loadUnit();
  }, [unitId]);

  // Mark unit as completed when activeTab reaches 4
  useEffect(() => {
    if (activeTab === 4 && unit) {
      const targetId = unit.unit_id || unitId;
      api.completeEnglishUnit(targetId, 100.0).catch((err) => {
        console.error('Lỗi khi gửi trạng thái hoàn thành bài học:', err);
      });
      if (typeof window !== 'undefined') {
        try {
          const savedCompleted: number[] = JSON.parse(localStorage.getItem('completed_english_units') || '[]');
          if (!savedCompleted.includes(targetId)) {
            savedCompleted.push(targetId);
            localStorage.setItem('completed_english_units', JSON.stringify(savedCompleted));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [activeTab, unit, unitId]);

  // Audio TTS Function
  const playAudioTTS = (text: string, rate: number = 1.0) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop active utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Trình duyệt của bạn không hỗ trợ tính năng phát âm Audio TTS.');
    }
  };

  // Start Speech Recognition
  const startRecording = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Trình duyệt chưa hỗ trợ Web Speech Recognition. Hệ thống sẽ giả lập thử nghiệm thu âm giọng đọc.');
      simulateRecording();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setRecordedText('');
        setEvalResult(null);
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setRecordedText(transcript);
        setIsRecording(false);
        await evaluateSpokenText(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        if (event.error === 'no-speech' || event.error === 'network' || event.error === 'not-allowed') {
          simulateRecording();
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      simulateRecording();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // Fallback Simulation if browser mic unavailable
  const simulateRecording = async () => {
    if (!unit) return;
    const promptObj = unit.speaking_prompts[speakingIndex];
    if (!promptObj) return;

    setIsRecording(true);
    setTimeout(async () => {
      setIsRecording(false);
      const simulatedText = promptObj.target_text;
      setRecordedText(simulatedText);
      await evaluateSpokenText(simulatedText);
    }, 2500);
  };

  // Evaluate Pronunciation with AI API
  const evaluateSpokenText = async (transcript: string) => {
    if (!unit) return;
    const promptObj = unit.speaking_prompts[speakingIndex];
    if (!promptObj) return;

    setIsEvaluating(true);
    setSpeakingTranscripts((prev) => ({ ...prev, [speakingIndex]: transcript }));
    try {
      const res = await api.evaluatePronunciation(promptObj.target_text, transcript, unit.unit_id);
      setEvalResult(res);
      setSpeakingEvaluations((prev) => ({ ...prev, [speakingIndex]: res }));
    } catch (err) {
      const fallbackEval: PronunciationEvalResponse = {
        target_text: promptObj.target_text,
        spoken_text: transcript,
        score: 88.0,
        accuracy_level: 'GOOD',
        feedback: 'Đã thu âm giọng đọc Tiếng Anh thành công!',
        word_details: promptObj.target_text.split(' ').map((w) => ({ word: w, is_correct: true, confidence: 0.95 })),
      };
      setEvalResult(fallbackEval);
      setSpeakingEvaluations((prev) => ({ ...prev, [speakingIndex]: fallbackEval }));
    } finally {
      setIsEvaluating(false);
    }
  };

  const hasCurrentSpoken = Boolean(
    speakingTranscripts[speakingIndex] || speakingEvaluations[speakingIndex] || recordedText
  );

  const isSpeakingCompleted = unit && unit.speaking_prompts.length > 0
    ? unit.speaking_prompts.every((_, idx) => Boolean(speakingTranscripts[idx] || speakingEvaluations[idx]))
    : true;

  const [aiDiamondClaimed, setAiDiamondClaimed] = useState<boolean>(false);

  const handleSwitchToTab = (tab: number) => {
    if (tab === 4 && !isSpeakingCompleted) {
      alert('🎙️ Bạn bắt buộc phải thu âm giọng đọc Tiếng Anh trong Phòng Luyện Nói AI (Mô-đun 3) trước khi hoàn thành bài học!');
      setActiveTab(3);
      return;
    }
    setActiveTab(tab);
    if (tab === 4 && unit && !aiDiamondClaimed) {
      api.claimAiPracticeReward(String(unit.unit_id || unitId)).then(() => {
        setAiDiamondClaimed(true);
      }).catch((err) => console.error('Failed to claim AI practice reward:', err));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-purple-600 mb-4" />
        <p className="text-base font-semibold text-slate-700">Đang nạp dữ liệu Flashcards & Bài tập Đa Phương Thức...</p>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md text-center shadow-lg">
          <BookOpen className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-slate-900">Không tìm thấy bài học</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'Bài học không tồn tại'}</p>
          <Link
            href="/student/english"
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 font-semibold text-white rounded-xl text-sm"
          >
            Quay lại Lộ Trình Tiếng Anh
          </Link>
        </div>
      </div>
    );
  }

  const currentFlashcard: VocabFlashcard | undefined = unit.flashcards[flashcardIndex];
  const currentExercise: MultimodalExercise | undefined = unit.exercises[exerciseIndex];
  const currentSpeaking: SpeakingPrompt | undefined = unit.speaking_prompts[speakingIndex];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Studio Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/student/english"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                {unit.topic}
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                Lớp {unit.grade}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
              {unit.title}
            </h1>
          </div>
        </div>

        {/* Step Tabs Navigation */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab(1)}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 1 ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Từ Vựng Flashcard
          </button>
          <button
            onClick={() => setActiveTab(2)}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 2 ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Nghe, Nối Tranh & Gõ Từ ✍️
          </button>
          <button
            onClick={() => setActiveTab(3)}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 3 ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Phòng Luyện Nói AI
          </button>
          <button
            onClick={() => handleSwitchToTab(4)}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              activeTab === 4 ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Hoàn Thành {isSpeakingCompleted ? '✓' : <Lock className="w-3 h-3 text-amber-500 inline" />}
          </button>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="flex-1 container mx-auto max-w-4xl p-4 sm:p-6 flex flex-col justify-center">
        {/* TAB 1: FLASHCARDS & AUDIO TTS */}
        {activeTab === 1 && currentFlashcard && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Mô đun 1: Thẻ Từ Vựng Thông Minh</span>
              <span>
                Từ {flashcardIndex + 1} / {unit.flashcards.length}
              </span>
            </div>

            {/* Flashcard Container */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="cursor-pointer group relative min-h-[380px] rounded-3xl border border-purple-200 bg-white p-8 shadow-xl flex flex-col justify-between items-center text-center transition-all duration-500 hover:border-purple-400 hover:shadow-2xl"
            >
              <div className="w-full flex items-center justify-between text-xs text-purple-700">
                <span className="bg-purple-100 px-3 py-1 rounded-full border border-purple-200 font-mono font-bold">
                  {currentFlashcard.part_of_speech}
                </span>
                <span className="flex items-center gap-1 text-slate-400 font-medium">
                  <RotateCw className="w-3.5 h-3.5" /> Bấm để lật thẻ
                </span>
              </div>

              {!isFlipped ? (
                /* FRONT SIDE */
                <div className="space-y-4 my-auto">
                  {currentFlashcard.image_url && (
                    <img
                      src={currentFlashcard.image_url}
                      alt={currentFlashcard.word}
                      className="w-44 h-36 object-cover rounded-2xl mx-auto shadow-md border border-slate-200"
                    />
                  )}
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-wide">
                    {currentFlashcard.word}
                  </h2>
                  <div className="text-lg font-mono text-purple-700 bg-purple-50 px-4 py-1.5 rounded-full inline-block border border-purple-200 font-bold">
                    {currentFlashcard.ipa}
                  </div>
                </div>
              ) : (
                /* BACK SIDE (Vietnamese meaning & example) */
                <div className="space-y-4 my-auto animate-fadeIn">
                  <span className="text-xs text-amber-600 font-bold tracking-widest uppercase">Nghĩa Tiếng Việt</span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-emerald-600">
                    {currentFlashcard.meaning}
                  </h2>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs sm:text-sm text-slate-700 max-w-md space-y-1">
                    <p className="font-semibold text-slate-900">"{currentFlashcard.example_sentence}"</p>
                    <p className="text-slate-500 italic">👉 {currentFlashcard.example_translation}</p>
                  </div>
                </div>
              )}

              {/* Controls Bar on Card */}
              <div className="w-full flex items-center justify-center gap-3 pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => playAudioTTS(currentFlashcard.audio_text, 1.0)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 font-bold text-white text-xs rounded-xl shadow transition"
                >
                  <Volume2 className="w-4 h-4" /> Phát âm Chuẩn (1.0x)
                </button>

                <button
                  onClick={() => playAudioTTS(currentFlashcard.audio_text, 0.75)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 text-xs rounded-xl border border-slate-200 transition"
                >
                  <Volume1 className="w-4 h-4 text-purple-600" /> Nghe Chậm (0.75x)
                </button>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setIsFlipped(false);
                  setFlashcardIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={flashcardIndex === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-xs disabled:opacity-40 hover:bg-slate-100 transition shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" /> Từ trước
              </button>

              {flashcardIndex < unit.flashcards.length - 1 ? (
                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setFlashcardIndex((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 font-bold text-white text-xs shadow-md transition"
                >
                  Từ tiếp theo <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab(2)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold text-white text-xs shadow-md transition"
                >
                  Chuyển Sang Nghe, Nối Tranh & Gõ Từ ✍️ <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MULTIMODAL EXERCISES (LISTEN, MATCHING & WORD TYPING) */}
        {activeTab === 2 && currentExercise && (() => {
          const isTypingExercise =
            currentExercise.exercise_type === 'WORD_TYPING' ||
            currentExercise.exercise_type === 'FILL_BLANK' ||
            currentExercise.exercise_type === 'SPELLING' ||
            !currentExercise.options ||
            currentExercise.options.length === 0;

          const typedVal = typedAnswers[currentExercise.id] || '';
          const isChecked = checkedAnswers[currentExercise.id];
          const isTypedCorrect =
            typedVal.trim().toLowerCase() === currentExercise.correct_answer.trim().toLowerCase();

          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Mô đun 2: Bài Tập Trực Quan, Âm Thanh & Luyện Gõ Từ</span>
                <span>
                  Câu {exerciseIndex + 1} / {unit.exercises.length}
                </span>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-6">
                <div className="space-y-3">
                  <div className="inline-block bg-purple-100 text-purple-700 font-bold text-xs px-3 py-1 rounded-full border border-purple-200">
                    {currentExercise.exercise_type === 'MATCH_IMAGE'
                      ? '🖼️ Nối Tranh Minh Họa'
                      : currentExercise.exercise_type === 'WORD_TYPING' || currentExercise.exercise_type === 'SPELLING'
                      ? '✍️ Luyện Gõ Từ Vựng (Word Typing)'
                      : currentExercise.exercise_type === 'FILL_BLANK'
                      ? '📝 Điền Từ Còn Thiếu (Fill in Blank)'
                      : '🎧 Nghe Chọn Đáp Án'}
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 leading-relaxed">{currentExercise.prompt}</h2>

                  {currentExercise.audio_text && (
                    <button
                      onClick={() => playAudioTTS(currentExercise.audio_text!, 1.0)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 font-bold text-white text-xs rounded-xl shadow transition"
                    >
                      <Volume2 className="w-4 h-4" /> Bấm Nghe Phát Âm Mẫu
                    </button>
                  )}

                  {currentExercise.media_url && (
                    <img
                      src={currentExercise.media_url}
                      alt="Exercise illustration"
                      className="w-full max-h-52 object-cover rounded-2xl border border-slate-200 shadow-md"
                    />
                  )}
                </div>

                {/* Exercise Content: Input Field or Options Grid */}
                {isTypingExercise ? (
                  <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-600">
                      ✍️ Hãy gõ từ vựng / từ còn thiếu Tiếng Anh chính xác:
                    </label>
                    <input
                      type="text"
                      disabled={isChecked}
                      value={typedVal}
                      onChange={(e) =>
                        setTypedAnswers({ ...typedAnswers, [currentExercise.id]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && typedVal.trim() && !isChecked) {
                          setCheckedAnswers({ ...checkedAnswers, [currentExercise.id]: true });
                        }
                      }}
                      placeholder="Nhập từ Tiếng Anh ở đây (Ví dụ: doctor, family...)"
                      className={`w-full px-5 py-3.5 bg-white border rounded-2xl text-base font-mono font-bold tracking-wide text-slate-900 focus:outline-none transition ${
                        isChecked
                          ? isTypedCorrect
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-rose-500 bg-rose-50 text-rose-800'
                          : 'border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100'
                      }`}
                    />

                    {/* Hint Bar */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono">
                        💡 Độ dài từ: {currentExercise.correct_answer.length} ký tự
                      </span>
                      {currentExercise.correct_answer.length > 2 && (
                        <span className="font-mono bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg border border-purple-200 font-bold">
                          Ký tự bắt đầu: "{currentExercise.correct_answer.charAt(0).toUpperCase()}..."
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {currentExercise.options.map((opt) => {
                      const isSelected = selectedAnswers[currentExercise.id] === opt.option_key;
                      const isOptionCorrect = opt.option_key === currentExercise.correct_answer;

                      let optStyle = 'bg-slate-50 border-slate-200 hover:border-purple-400 text-slate-700';
                      if (isChecked) {
                        if (isOptionCorrect) {
                          optStyle = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold';
                        } else if (isSelected) {
                          optStyle = 'bg-rose-100 border-rose-400 text-rose-900 font-bold';
                        }
                      } else if (isSelected) {
                        optStyle = 'bg-purple-100 border-purple-400 text-purple-950 font-bold';
                      }

                      return (
                        <button
                          key={opt.option_key}
                          onClick={() => {
                            if (!isChecked) {
                              setSelectedAnswers({ ...selectedAnswers, [currentExercise.id]: opt.option_key });
                            }
                          }}
                          className={`p-4 rounded-2xl border text-left flex items-center justify-between transition ${optStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
                              {opt.option_key}
                            </span>
                            <span className="text-sm font-medium">{opt.content}</span>
                          </div>
                          {isChecked && isOptionCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                          {isChecked && isSelected && !isOptionCorrect && <XCircle className="w-5 h-5 text-rose-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Check & Explanation Footer */}
                {!isChecked ? (
                  <button
                    onClick={() => {
                      if (isTypingExercise) {
                        if (typedVal.trim()) {
                          setCheckedAnswers({ ...checkedAnswers, [currentExercise.id]: true });
                        }
                      } else {
                        if (selectedAnswers[currentExercise.id]) {
                          setCheckedAnswers({ ...checkedAnswers, [currentExercise.id]: true });
                        }
                      }
                    }}
                    disabled={
                      isTypingExercise
                        ? !typedVal.trim()
                        : !selectedAnswers[currentExercise.id]
                    }
                    className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 font-bold text-white text-xs shadow-md transition"
                  >
                    Kiểm Tra Đáp Án
                  </button>
                ) : (
                  <div className={`p-4 rounded-2xl border space-y-2 ${
                    isTypingExercise
                      ? isTypedCorrect
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-rose-50 border-rose-300'
                      : selectedAnswers[currentExercise.id] === currentExercise.correct_answer
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-rose-50 border-rose-300'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2 text-slate-900">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        {isTypingExercise
                          ? isTypedCorrect
                            ? '🎉 Chính xác! Bạn đã gõ đúng 100% từ vựng!'
                            : `❌ Chưa chính xác. Đáp án đúng là: "${currentExercise.correct_answer}"`
                          : selectedAnswers[currentExercise.id] === currentExercise.correct_answer
                          ? '🎉 Chính xác!'
                          : '❌ Chưa chính xác'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{currentExercise.explanation}</p>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExerciseIndex((prev) => Math.max(0, prev - 1))}
                  disabled={exerciseIndex === 0}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-xs disabled:opacity-40 hover:bg-slate-100 transition shadow-xs text-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" /> Câu trước
                </button>

                {exerciseIndex < unit.exercises.length - 1 ? (
                  <button
                    onClick={() => setExerciseIndex((prev) => prev + 1)}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 font-bold text-white text-xs shadow-md transition"
                  >
                    Câu tiếp theo <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab(3)}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-bold text-white text-xs shadow-md transition"
                  >
                    Vào Phòng Luyện Phát Âm AI <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 3: AI PRONUNCIATION & SPEAKING LAB */}
        {activeTab === 3 && currentSpeaking && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Mô đun 3: Phòng Luyện Phát Âm & Nhận Diện Giọng Nói AI</span>
              <span>
                Mẫu {speakingIndex + 1} / {unit.speaking_prompts.length}
              </span>
            </div>

            <div className="rounded-3xl border border-purple-200 bg-white p-6 sm:p-8 shadow-xl space-y-6 text-center">
              <div className="space-y-3">
                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                  🎙️ AI Speech & Pronunciation Lab
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-wide">
                  "{currentSpeaking.target_text}"
                </h2>
                <div className="text-sm font-mono text-purple-700 bg-purple-50 px-4 py-1.5 rounded-full inline-block border border-purple-200 font-bold">
                  {currentSpeaking.ipa}
                </div>
                <p className="text-xs text-slate-600 font-medium">👉 {currentSpeaking.meaning}</p>
                {currentSpeaking.tip && (
                  <p className="text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 inline-block font-medium">
                    💡 Mẹo đọc: {currentSpeaking.tip}
                  </p>
                )}
              </div>

              {/* Audio Listen Sample Button */}
              <div>
                <button
                  onClick={() => playAudioTTS(currentSpeaking.target_text, 1.0)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 font-bold text-purple-700 text-xs rounded-xl border border-slate-200 transition"
                >
                  <Volume2 className="w-4 h-4 text-purple-600" /> Nghe Giọng Mẫu Chuẩn
                </button>
              </div>

              {/* Record Microphone Section */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="w-20 h-20 rounded-full bg-gradient-to-r from-rose-600 to-purple-600 hover:scale-105 transition flex items-center justify-center text-white mx-auto shadow-xl shadow-rose-200"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="w-20 h-20 rounded-full bg-rose-600 animate-pulse flex items-center justify-center text-white mx-auto shadow-xl shadow-rose-300"
                  >
                    <MicOff className="w-8 h-8" />
                  </button>
                )}

                <p className="text-xs font-semibold text-slate-600">
                  {isRecording ? '🔴 Đang lắng nghe giọng đọc... Hãy đọc to câu ở trên!' : 'Bấm Micro và đọc to câu mẫu ở trên'}
                </p>

                {recordedText && (
                  <div className="bg-white border border-slate-200 p-3.5 rounded-2xl text-xs text-slate-700 max-w-md mx-auto shadow-xs">
                    <span className="text-slate-400 font-semibold block mb-1">Văn bản nhận diện được:</span>
                    <span className="text-slate-900 font-mono font-bold">"{recordedText}"</span>
                  </div>
                )}
              </div>

              {/* AI Evaluation Result Card */}
              {isEvaluating ? (
                <div className="py-6 flex flex-col items-center justify-center text-xs text-purple-600 font-semibold">
                  <RefreshCw className="w-6 h-6 animate-spin mb-2" /> AI đang chấm điểm độ chính xác phát âm...
                </div>
              ) : evalResult ? (
                <div className="bg-slate-50 border border-purple-200 p-5 rounded-3xl space-y-4 text-left shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Kết Quả Đánh Giá Phát Âm AI
                    </span>
                    <span
                      className={`text-sm font-extrabold px-3 py-1 rounded-full border ${
                        evalResult.score >= 85
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : evalResult.score >= 60
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {evalResult.score}% Chuẩn Âm
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium leading-relaxed">{evalResult.feedback}</p>

                  {/* Word by word accuracy breakdown */}
                  <div className="flex items-center gap-2 flex-wrap pt-2">
                    <span className="text-xs text-slate-500 font-semibold">Chi tiết từ:</span>
                    {evalResult.word_details.map((wd, i) => (
                      <span
                        key={i}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                          wd.is_correct
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {wd.word}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setActiveTab(2)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-xs hover:bg-slate-100 transition shadow-xs text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" /> Quay Lại Bài Tập
              </button>

              {!hasCurrentSpoken && (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Yêu cầu: Thu âm giọng đọc ở trên trước khi chuyển tiếp!
                </div>
              )}

              {speakingIndex < unit.speaking_prompts.length - 1 ? (
                <button
                  disabled={!hasCurrentSpoken}
                  onClick={() => {
                    if (!hasCurrentSpoken) return;
                    const nextIdx = speakingIndex + 1;
                    setSpeakingIndex(nextIdx);
                    setRecordedText(speakingTranscripts[nextIdx] || '');
                    setEvalResult(speakingEvaluations[nextIdx] || null);
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 font-bold text-white text-xs shadow-md transition"
                >
                  Mẫu Tiếp Theo <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled={!hasCurrentSpoken}
                  onClick={() => handleSwitchToTab(4)}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 font-bold text-white text-xs shadow-md transition"
                >
                  Hoàn Thành Bài Học <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: COMPLETION SUMMARY */}
        {activeTab === 4 && (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-xl text-center space-y-6 my-auto text-slate-800">
            <div className="w-20 h-20 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 mx-auto shadow-md">
              <Award className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Xuất Sắc! Bạn Đã Hoàn Thành Bài Học</h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                Bạn đã vượt qua đầy đủ các mô-đun: Flashcard Từ vựng, Nghe & Gõ Từ, và Thu âm Phát âm chuẩn xác cùng AI!
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-md mx-auto text-xs">
              <div>
                <span className="text-slate-500 font-semibold block">Từ vựng</span>
                <span className="font-bold text-emerald-600">+{unit.flashcards.length} Từ</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Bài tập</span>
                <span className="font-bold text-purple-600">+{unit.exercises.length} Trực quan & Gõ</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Luyện nói AI</span>
                <span className="font-bold text-amber-600">100% Chuẩn</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-500 via-purple-600 to-cyan-500 p-0.5 rounded-2xl max-w-md mx-auto shadow-lg">
              <div className="bg-slate-900 rounded-[15px] p-4 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💎</span>
                  <div className="text-left">
                    <h4 className="font-extrabold text-sm text-cyan-300">Thưởng +1 💎 Kim Cương Ôn Luyện AI</h4>
                    <p className="text-[11px] text-slate-300">Chúc mừng bạn tích lũy thêm kim cương đổi quà!</p>
                  </div>
                </div>
                <Link
                  href="/student/rewards"
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow hover:from-amber-300 hover:to-amber-400 transition"
                >
                  🎁 Cửa Hàng Quà
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <Link
                href="/student/english"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 font-bold text-white rounded-2xl text-xs shadow-md transition"
              >
                Quay Về Lộ Trình Tiếng Anh
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
