'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Timer,
  BarChart3,
  ArrowRight,
  GraduationCap,
  Layers,
  FileCheck2,
  LayoutDashboard,
  HelpCircle,
  ClipboardList,
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();

  const features = [
    {
      icon: <BookOpen className="w-6 h-6 text-blue-600" />,
      title: 'Ngân Hàng Đề Thi Chuẩn GDPT',
      desc: 'Hệ thống đề thi đa dạng dành cho học sinh từ Lớp 4 đến Lớp 9 các môn Toán, Tiếng Việt, Tiếng Anh, Khoa học, Lịch sử & Địa lí.',
    },
    {
      icon: <Timer className="w-6 h-6 text-indigo-600" />,
      title: 'Đồng Hồ Đếm Giờ & Chấm Điểm Tự Động',
      desc: 'Bộ đếm thời gian máy chủ chuẩn xác, tự động lưu từng đáp án và tính điểm ngay lập tức sau khi nộp bài thi.',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-purple-600" />,
      title: 'Trợ Lý AI Gemini Thông Minh',
      desc: 'Hỗ trợ giáo viên khởi tạo câu hỏi theo bối cảnh thực tế và cung cấp lời giải thích chi tiết cho từng phương án.',
    },
    {
      icon: <Layers className="w-6 h-6 text-emerald-600" />,
      title: 'Bản Đồ Tri Thức Sách Giáo Khoa',
      desc: 'Trích xuất và trực quan hóa cấu trúc chương học SGK giúp học sinh nắm vững cây kiến thức trọng tâm.',
    },
    {
      icon: <FileCheck2 className="w-6 h-6 text-amber-600" />,
      title: 'Import Đề Thi Từ File Word',
      desc: 'Giúp giáo viên nhập nhanh câu hỏi từ tài liệu Microsoft Word chuẩn định dạng A/B/C/D chỉ với một thao tác.',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-rose-600" />,
      title: 'Xem Kết Quả & Lịch Sử Làm Bài',
      desc: 'Xem lại kết quả chi tiết từng câu hỏi, đáp án đúng và phân tích điểm đạt/chưa đạt một cách minh bạch.',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-slate-50 py-20 md:py-28 border-b border-slate-200">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="container relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-700 mb-6 shadow-sm">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>Nền Tảng Thi Trực Tuyến & Ôn Luyện AI GDPT Lớp 4 – 9</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight sm:leading-tight">
            Khảo Thí Trực Tuyến & <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Trợ Lý Khảo Thí AI Thông Minh
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Nền tảng làm bài thi trực tuyến bám sát chương trình Sách giáo khoa, tích hợp AI Gemini sinh câu hỏi bối cảnh thực tế và chỉ dẫn lời giải chi tiết.
          </p>

          {/* Dynamic Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {user ? (
              // Actions when Logged In (Hide Login button)
              <>
                {user.role === 'STUDENT' ? (
                  <>
                    <Link
                      href="/student/exams"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:scale-[1.02] transition-all"
                    >
                      <ClipboardList className="w-4 h-4" /> Danh Sách Đề Thi <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/dashboard/student"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition"
                    >
                      <LayoutDashboard className="w-4 h-4 text-blue-600" /> Trang Cá Nhân
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/exams"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:scale-[1.02] transition-all"
                    >
                      <FileCheck2 className="w-4 h-4" /> Quản Lý Đề Thi <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/questions"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition"
                    >
                      <HelpCircle className="w-4 h-4 text-indigo-600" /> Ngân Hàng Câu Hỏi
                    </Link>
                    {user.role === 'ADMIN' && (
                      <Link
                        href="/dashboard/admin"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-600" /> Bảng Quản Trị
                      </Link>
                    )}
                  </>
                )}
              </>
            ) : (
              // Actions when Not Logged In (Guest)
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:scale-[1.02] transition-all"
                >
                  Vào Đăng Nhập <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đăng Ký Tài Khoản
                </Link>
              </>
            )}
          </div>

          {/* Value Proposition Metrics */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 text-center shadow-sm">
              <div className="text-xl font-bold text-slate-900">Khảo Thí GDPT</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Toán, Tiếng Việt, Tiếng Anh...</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 text-center shadow-sm">
              <div className="text-xl font-bold text-blue-600">Khối Lớp 4 - 9</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Chuẩn chương trình SGK</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 text-center shadow-sm">
              <div className="text-xl font-bold text-indigo-600">Đếm Giờ Server</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Chấm điểm & lưu tự động</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 text-center shadow-sm">
              <div className="text-xl font-bold text-emerald-600">Trợ Lý AI Gemini</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Sinh câu hỏi & hướng dẫn giải</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Showcase Section */}
      <section className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Tính Năng Nổi Bật Của Hệ Thống
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
            Giải pháp toàn diện hỗ trợ học sinh ôn luyện kiến thức và giúp giáo viên quản lý khảo thí hiệu quả.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all hover:border-blue-500/40"
            >
              <div>
                <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                  {item.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
