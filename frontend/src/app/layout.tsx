import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Online Exam AI — Hệ Thống Khảo Thí & Gia Sư AI Thông Minh',
  description: 'Nền tảng thi trực tuyến tích hợp trí tuệ nhân tạo Gemini: tạo câu hỏi chuẩn SGK, bối cảnh thực tế, timer server-authoritative và AI Tutor giải thích chi tiết.',
  keywords: ['online exam', 'ai tutor', 'thi trực tuyến', 'khảo thí ai', 'gemini ai exam'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
          <footer className="border-t border-slate-200/80 bg-white/80 backdrop-blur-md py-6 text-center text-xs text-slate-500">
            <div className="container mx-auto px-4">
              <p>© 2026 Online Exam AI. Hệ thống thi trực tuyến & trợ lý khảo thí thông minh.</p>
              <p className="mt-1 text-slate-400">GDPT Lớp 4 – Lớp 9 • Môn Toán, Tiếng Việt, Tiếng Anh...</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
