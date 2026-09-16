# IMPLEMENTATION PLAN — ONLINE EXAM AI

Dự án phát triển MVP **Online Exam AI** theo đặc tả tại [ONLINE_EXAM_AI_SPEC.md](file:///d:/OneDrive/Documents/ThiOnline/docs/ONLINE_EXAM_AI_SPEC.md).

---

## 1. TỔNG QUAN CÁC GIAI ĐOẠN (PHASES)

Hệ thống được chia thành 7 giai đoạn phát triển tuần tự:

- **Phase 1 — Foundation**: Cấu trúc dự án, Docker, Database, Backend FastAPI, Frontend Next.js, Authentication (JWT), Phân quyền Role (Admin/Teacher/Student), Kiểm thử và CI/CD cơ bản.
- **Phase 2 — Document Knowledge**: Pipeline xử lý tài liệu (PDF, DOCX, TXT), Chunking, Trích xuất cấu trúc kiến thức (Knowledge Map: Subject -> Grade -> Book -> Chapter -> Lesson -> Topic -> Learning Objective).
- **Phase 3 — Question Bank**: Quản lý ngân hàng câu hỏi (CRUD, Options, Trạng thái DRAFT/REVIEW/APPROVED/REJECTED), Import Word theo chuẩn định dạng, Duyệt câu hỏi.
- **Phase 4 — Gemini AI**: Tích hợp Google Gemini API, Grounding Rule (SGK làm chuẩn kiến thức, Internet làm bối cảnh thực tế), AI Question Generator, Backend Validation, Teacher Review interface.
- **Phase 5 — Exam Engine**: Tạo đề thi, Phân bổ câu hỏi, Giao bài cho học sinh, Server-authoritative Timer, Autosave đáp án từng câu, Bảo mật đề thi (không lộ đáp án xuống frontend), Tự động chấm điểm.
- **Phase 6 — AI Tutor**: Phân tích câu sai sau khi nộp bài, Gemini giải thích nguyên nhân sai, nhắc lại khái niệm cốt lõi theo SGK, gợi ý tài liệu học tập.
- **Phase 7 — Dashboard & Analytics**: Báo cáo thống kê dành cho giáo viên và học sinh, phân tích độ khó câu hỏi, tỷ lệ lựa chọn các phương án.

---

## 2. KẾ HOẠCH CHI TIẾT PHASE 1 — FOUNDATION

### 2.1. Mục tiêu
```text
[x] Phân tích hiện trạng repository và môi trường thực tế
[ ] Thiết lập cấu trúc dự án chuẩn: backend/ và frontend/
[ ] Cấu hình cơ sở dữ liệu (PostgreSQL sẵn sàng qua Docker, SQLite fallback chạy độc lập cục bộ)
[ ] Backend FastAPI hoàn chỉnh: Cấu hình, Database Engine, Model User, Schemas, Security (Bcrypt + JWT)
[ ] Alembic migrations tạo bảng users
[ ] API endpoints: Register, Login, Me, Seed demo data, Quản lý Users (Admin)
[ ] Frontend Next.js 15: Giao diện hiện đại, Auth Context, Trang Chủ, Login, Register, Admin Dashboard, Student Dashboard
[ ] Bộ kiểm thử tự động (Unit & Integration tests) cho Backend
[ ] Docker Compose cấu hình trọn gói
[ ] Kiểm tra lint, build và tạo báo cáo Phase 1 Report
```

### 2.2. Kiến trúc thư mục dự kiến
```text
ThiOnline/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py
│   │   │   │   ├── users.py
│   │   │   │   └── router.py
│   │   │   ├── deps.py
│   │   │   └── api.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   ├── base.py
│   │   │   └── user.py
│   │   ├── schemas/
│   │   │   └── user.py
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   └── test_users.py
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (auth)/register/
│   │   │   ├── dashboard/admin/
│   │   │   ├── dashboard/student/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docs/
│   ├── ONLINE_EXAM_AI_SPEC.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── ARCHITECTURE.md
│   └── phase-reports/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

### 2.3. Acceptance Criteria Phase 1
```text
[ ] Backend start thành công (Uvicorn / FastAPI)
[ ] Frontend start thành công (Next.js 15)
[ ] Database connection OK
[ ] Migration chạy OK (Alembic)
[ ] Admin login OK
[ ] Student login OK
[ ] Unauthorized request bị reject (401 / 403)
[ ] Pytest suite 100% pass
[ ] Frontend build thành công (TypeScript & Next.js build pass)
```
