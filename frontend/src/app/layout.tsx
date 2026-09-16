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
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
          <footer className="border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-950/50 py-6 text-center text-xs text-zinc-500">
            <div className="container mx-auto px-4">
              <p>© 2026 Online Exam AI. Được xây dựng dựa trên đặc tả kỹ thuật tiêu chuẩn.</p>
              <p className="mt-1 text-zinc-400 dark:text-zinc-600">FastAPI • PostgreSQL • Next.js • Tailwind CSS • Google Gemini AI</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
