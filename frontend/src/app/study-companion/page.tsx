'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ChatMessageItem, SgkCitation } from '@/types';
import {
  Sparkles,
  Send,
  BookOpen,
  GraduationCap,
  RefreshCw,
  HelpCircle,
  Lightbulb,
  FileText,
  ChevronRight,
  Bot,
  User as UserIcon,
  BookMarked,
  CheckCircle2,
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

interface ExtendedMessage extends ChatMessageItem {
  id: string;
  citations?: SgkCitation[];
  suggested_followups?: string[];
  timestamp: string;
}

export default function AiStudyCompanionPage() {
  const { user } = useAuth();

  const [selectedSubject, setSelectedSubject] = useState<string>('Toán');
  const [selectedGrade, setSelectedGrade] = useState<number>(user?.grade || 5);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCitationModal, setActiveCitationModal] = useState<SgkCitation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync user's grade when logged in
  useEffect(() => {
    if (user?.grade && user.grade >= 4 && user.grade <= 9) {
      setSelectedGrade(user.grade);
    }
  }, [user]);

  // Initial welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Xin chào **${user?.full_name || 'học sinh'}**! Thầy/Cô là **Trợ Lý Học Tập AI 1-on-1**. 

Em đang tìm hiểu kiến thức nào trong Sách Giáo Khoa môn **${selectedSubject} Lớp ${selectedGrade}**? Hãy đặt câu hỏi, AI sẽ giải thích từng bước sinh động kèm ví dụ trực quan và trích dẫn chuẩn SGK nhé! 🚀`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggested_followups: [
          `Giải thích giúp em kiến thức trọng tâm môn ${selectedSubject} Lớp ${selectedGrade}?`,
          `Cho em xin ví dụ bài tập mẫu và phương pháp giải môn ${selectedSubject}?`,
          `Làm sao để ghi nhớ nhanh các định nghĩa trong bài học môn ${selectedSubject}?`,
        ],
      },
    ]);
  }, [selectedSubject, selectedGrade, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || inputMessage).trim();
    if (!messageText || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const newHistory: ExtendedMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: messageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(newHistory);
    setInputMessage('');
    setLoading(true);

    try {
      // Build conversation history format for API
      const historyPayload: ChatMessageItem[] = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await api.chatWithAiCompanion({
        message: messageText,
        subject: selectedSubject,
        grade: selectedGrade,
        conversation_history: historyPayload,
      });

      const aiMsgId = `ai-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: 'assistant',
          content: response.reply,
          citations: response.citations,
          suggested_followups: response.suggested_followups,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Không thể kết nối với Trợ Lý AI**: ${err.message || 'Đã có lỗi xảy ra'}. Vui lòng thử lại sau giây lát.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header Bar */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 sm:p-8 text-white shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-12 -translate-y-6">
            <Sparkles className="w-80 h-80 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100 border border-white/20 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Trợ Lý Học Tập AI Tương Tác 1-on-1
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                AI Study Companion & Q&A Bot
              </h1>
              <p className="text-sm font-medium text-blue-100 mt-1 max-w-2xl">
                Hỏi đáp trực tiếp với AI về mọi bài học SGK (GDPT 2018 Lớp 4–9). AI giải thích sinh động theo đúng trình độ khối lớp và trích dẫn chuẩn Bài / Chương / Trang SGK.
              </p>
            </div>

            {/* Subject & Grade Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <div>
                <label className="block text-[11px] font-bold text-blue-100 mb-1">Môn học *</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-white/30 bg-slate-900/40 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {SUBJECTS.map((sub) => (
                    <option key={sub} value={sub} className="bg-slate-900 text-white">
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-100 mb-1">Khối lớp *</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(parseInt(e.target.value))}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-white/30 bg-slate-900/40 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g} className="bg-slate-900 text-white">
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Box Container */}
        <div className="rounded-3xl border border-slate-200/90 bg-white shadow-xl overflow-hidden flex flex-col h-[650px]">
          
          {/* Chat Top Banner */}
          <div className="bg-slate-100/90 px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Đang kết nối: AI Tutor GDPT 2018 ({selectedSubject} - Lớp {selectedGrade})</span>
            </div>
            <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              <BookMarked className="w-3.5 h-3.5 text-indigo-600" /> Grounded SGK Lớp {selectedGrade}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <UserIcon className="w-5 h-5" />
                  ) : (
                    <Bot className="w-5 h-5" />
                  )}
                </div>

                {/* Message Bubble & Content */}
                <div className={`max-w-3xl space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  
                  {/* Sender Name & Time */}
                  <div
                    className={`flex items-center gap-2 text-[11px] font-semibold text-slate-400 ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{msg.role === 'user' ? user?.full_name || 'Học sinh' : 'Trợ Lý AI Tutor'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Main Bubble */}
                  <div
                    className={`p-4 sm:p-5 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-none font-normal'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* SGK Citations Cards (AI Response Only) */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>Nguồn Trích Dẫn SGK Tham Chiếu Đối Chiếu:</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {msg.citations.map((cite, cIdx) => (
                          <div
                            key={cIdx}
                            onClick={() => setActiveCitationModal(cite)}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-indigo-100 hover:border-indigo-400 transition cursor-pointer shadow-2xs group"
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                                  {cite.document_title} — {cite.lesson}
                                </h4>
                                <p className="text-[11px] font-semibold text-slate-500">
                                  {cite.chapter} {cite.page_number ? `• Trang ${cite.page_number}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                              Xem trích dẫn <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Followups (AI Response Only) */}
                  {msg.suggested_followups && msg.suggested_followups.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Gợi ý câu hỏi đào sâu tiếp theo:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.suggested_followups.map((fol, fIdx) => (
                          <button
                            key={fIdx}
                            onClick={() => handleSendMessage(fol)}
                            disabled={loading}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition shadow-2xs text-left active:scale-95 disabled:opacity-50"
                          >
                            💡 {fol}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Spinner State */}
            {loading && (
              <div className="flex gap-3.5 items-start">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-white border border-slate-200/90 rounded-3xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-600">
                    Trợ lý AI đang tra cứu SGK và soạn câu trả lời...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-4 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-3"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Hỏi AI bất kỳ kiến thức SGK môn ${selectedSubject} Lớp ${selectedGrade}...`}
                  className="w-full pl-4 pr-10 py-3 text-sm font-medium rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition disabled:opacity-50 shrink-0"
              >
                <span>Gửi</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Modal Citation Viewer */}
        {activeCitationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Trích Dẫn SGK Chuẩn
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{activeCitationModal.document_title}</h3>
                </div>
                <button
                  onClick={() => setActiveCitationModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-semibold space-y-1">
                  <p><strong>Chương / Chủ đề:</strong> {activeCitationModal.chapter}</p>
                  <p><strong>Bài học:</strong> {activeCitationModal.lesson}</p>
                  {activeCitationModal.page_number && (
                    <p><strong>Trang SGK:</strong> Trang {activeCitationModal.page_number}</p>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Đoạn trích kiến thức đối chiếu:</h4>
                  <div className="p-3 bg-amber-50/80 border border-amber-200/80 text-amber-900 rounded-xl font-medium leading-relaxed italic">
                    "{activeCitationModal.snippet}"
                  </div>
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setActiveCitationModal(null)}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
