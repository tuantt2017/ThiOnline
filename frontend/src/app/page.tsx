import Link from 'next/link';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Timer,
  Bot,
  BarChart3,
  ArrowRight,
  Database,
  Cpu,
  Layers,
} from 'lucide-react';

export default function HomePage() {
  const phases = [
    {
      id: 'Phase 1',
      title: 'Foundation Architecture',
      desc: 'FastAPI, PostgreSQL / SQLite, SQLAlchemy, Alembic, JWT & RBAC Auth, Next.js 15 UI.',
      status: 'Hoàn thành (Phase hiện tại)',
      active: true,
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'Phase 2',
      title: 'Document Knowledge',
      desc: 'Parser tài liệu SGK (PDF, DOCX, TXT), Chunking tự động và xây dựng cây Knowledge Map.',
      status: 'Sẵn sàng triển khai',
      active: false,
      color: 'from-blue-500/10 to-indigo-500/10 border-zinc-200 dark:border-zinc-800 text-zinc-500',
    },
    {
      id: 'Phase 3',
      title: 'Question Bank',
      desc: 'Quản lý ngân hàng câu hỏi, Import Word thông minh chuẩn A/B/C/D, Quy trình kiểm duyệt.',
      status: 'Kế hoạch',
      active: false,
      color: 'from-zinc-500/10 to-zinc-500/10 border-zinc-200 dark:border-zinc-800 text-zinc-500',
    },
    {
      id: 'Phase 4',
      title: 'Gemini AI Generation',
      desc: 'Grounding Rule: SGK chuẩn kiến thức + Internet bối cảnh thực tế. Backend Validation đa tầng.',
      status: 'Kế hoạch',
      active: false,
      color: 'from-purple-500/10 to-pink-500/10 border-zinc-200 dark:border-zinc-800 text-zinc-500',
    },
    {
      id: 'Phase 5',
      title: 'Server Exam Engine',
      desc: 'Server-authoritative Timer đếm ngược, Autosave liên tục từng câu, Chấm điểm bảo mật tuyệt đối.',
      status: 'Kế hoạch',
      active: false,
      color: 'from-amber-500/10 to-orange-500/10 border-zinc-200 dark:border-zinc-800 text-zinc-500',
    },
    {
      id: 'Phase 6',
      title: 'Personalized AI Tutor',
      desc: 'Phân tích lỗi sai, chỉ rõ điểm hổng kiến thức, dẫn chiếu bài học SGK và phương pháp khắc phục.',
      status: 'Kế hoạch',
      active: false,
      color: 'from-rose-500/10 to-red-500/10 border-zinc-200 dark:border-zinc-800 text-zinc-500',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-zinc-50 dark:from-zinc-900/60 dark:via-zinc-950 dark:to-zinc-950 py-20 md:py-28 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="container relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Đặc tả tiêu chuẩn MVP — Online Exam AI (Phase 1)</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white max-w-4xl mx-auto leading-tight sm:leading-tight">
            Nền Tảng Thi Trực Tuyến & <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Trợ Lý Khảo Thí AI Thông Minh
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Kết hợp sức mạnh phân tích tri thức SGK, AI Gemini sinh câu hỏi bối cảnh sống động, bộ đếm giờ chuẩn Server và Gia sư ảo chỉ dẫn giải bài chi tiết.
          </p>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:scale-[1.02] transition-all"
            >
              Vào Đăng Nhập / Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" /> Bảng Quản Trị Admin
            </Link>
            <Link
              href="/dashboard/student"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Khu Vực Học Sinh
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/70 backdrop-blur-sm p-4 text-center dark:border-zinc-800/80 dark:bg-zinc-900/60 shadow-sm">
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">100%</div>
              <div className="text-xs text-zinc-500 font-medium mt-0.5">Test Suite Passed</div>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white/70 backdrop-blur-sm p-4 text-center dark:border-zinc-800/80 dark:bg-zinc-900/60 shadow-sm">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">FastAPI</div>
              <div className="text-xs text-zinc-500 font-medium mt-0.5">Python 3.14 Backend</div>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white/70 backdrop-blur-sm p-4 text-center dark:border-zinc-800/80 dark:bg-zinc-900/60 shadow-sm">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Next.js 15</div>
              <div className="text-xs text-zinc-500 font-medium mt-0.5">App Router & Tailwind</div>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white/70 backdrop-blur-sm p-4 text-center dark:border-zinc-800/80 dark:bg-zinc-900/60 shadow-sm">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">JWT & RBAC</div>
              <div className="text-xs text-zinc-500 font-medium mt-0.5">Phân quyền 3 Cấp</div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap & Phases Section */}
      <section className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            Lộ Trình Triển Khai 7 Giai Đoạn (Spec Compliance)
          </h2>
          <p className="mt-2 text-sm text-zinc-500 max-w-xl mx-auto">
            Hệ thống phát triển tuần tự, đảm bảo mỗi phase hoàn thiện 100% kiểm thử và xác thực nghiệm thu trước khi bước sang phase tiếp theo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phases.map((phase) => (
            <div
              key={phase.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all hover:shadow-md ${
                phase.active
                  ? 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-sm ring-1 ring-emerald-500/20'
                  : 'border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-zinc-400">
                    {phase.id}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      phase.active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {phase.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
                  {phase.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {phase.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
                <span>{phase.active ? 'Sẵn sàng sử dụng' : 'Khóa cho tới khi hoàn tất Phase 1'}</span>
                {phase.active && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
