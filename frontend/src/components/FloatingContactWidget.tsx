'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Phone, X, Headphones, ExternalLink } from 'lucide-react';

export function FloatingContactWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Configurable URLs via env or default links
  const zaloUrl = process.env.NEXT_PUBLIC_ZALO_URL || 'https://zalo.me/0987654321';
  const fbMessengerUrl = process.env.NEXT_PUBLIC_FB_MESSENGER_URL || 'https://m.me/OnlineExamAI';
  const hotline = process.env.NEXT_PUBLIC_HOTLINE || '0987654321';

  // Close widget when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={widgetRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Expanded Contact Panel */}
      {isOpen && (
        <div className="mb-3 w-72 rounded-3xl bg-slate-900/95 backdrop-blur-md border border-cyan-500/30 p-4 shadow-2xl text-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white leading-tight">Hỗ Trợ & Liên Hệ</h4>
                <p className="text-[11px] text-slate-400">Kết nối trực tiếp Thầy Cô 24/7</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
              aria-label="Đóng bảng liên hệ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Zalo Chat Button */}
            <a
              href={zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-2xl bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-xs shadow-md transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm">
                  Z
                </div>
                <span>Chat Trực Tiếp Zalo</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Facebook Messenger Button */}
            <a
              href={fbMessengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white">
                  <MessageCircle className="w-4 h-4 fill-white" />
                </div>
                <span>Facebook Messenger</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Hotline Call Button */}
            <a
              href={`tel:${hotline.replace(/\s+/g, '')}`}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:bg-slate-800/90 text-emerald-400 font-bold text-xs transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <span>Hotline: {hotline}</span>
              </div>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800">
                Gọi ngay
              </span>
            </a>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20"
        aria-label="Liên hệ hỗ trợ Zalo/Facebook"
      >
        {/* Pulsing Aura Effect */}
        <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 opacity-40 blur-sm group-hover:opacity-75 transition duration-500 animate-pulse" />

        <div className="relative flex items-center gap-2">
          {isOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-5 h-5 text-white fill-white/20" />
              <span className="font-extrabold text-xs tracking-wider uppercase">Liên Hệ Support</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
