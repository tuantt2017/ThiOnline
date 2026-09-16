# Phase 1 Report — Foundation

## Implemented

- **Cấu trúc dự án hoàn chỉnh**: Khởi tạo kiến trúc phân tầng Monolith tách biệt `backend/` (FastAPI) và `frontend/` (Next.js 15).
- **Cơ sở dữ liệu & Migrations**:
  - Tích hợp SQLAlchemy 2.0 và cấu trúc model `User` gồm các vai trò: `ADMIN`, `TEACHER`, `STUDENT`.
  - Khởi tạo hệ thống migration Alembic với migration `f31981969248_create_users_table`.
  - Thiết kế đa dialect hỗ trợ PostgreSQL (qua Docker) và SQLite fallback cho kiểm thử & phát triển độc lập không phụ thuộc môi trường máy chủ.
- **Bảo mật & Xác thực (Authentication & RBAC)**:
  - Băm mật khẩu chuẩn bảo mật cao bằng `bcrypt` (giới hạn 72-byte an toàn).
  - Cấp phát và giải mã JWT token (PyJWT) với thời hạn tùy chỉnh.
  - Các endpoint xác thực:
    - `POST /api/v1/auth/register`: Đăng ký tài khoản học sinh.
    - `POST /api/v1/auth/login`: Đăng nhập lấy access token và thông tin profile.
    - `GET /api/v1/auth/me`: Lấy thông tin user hiện tại qua Bearer token.
    - `POST /api/v1/auth/seed`: Khởi tạo sẵn tài khoản Admin, Student, Teacher mẫu.
  - Phân quyền (RBAC) chặt chẽ bằng FastAPI dependencies (`get_current_user`, `get_current_active_admin`, `get_current_teacher_or_admin`, `get_current_student`).
  - Endpoint quản trị: `GET /api/v1/users/` và `POST /api/v1/users/` (chỉ dành cho ADMIN, học sinh truy cập bị từ chối 403 Forbidden).
- **Frontend Next.js 15 App Router**:
  - Giao diện thẩm mỹ cao, hiện đại với Tailwind CSS, icon Lucide và Responsive trên mọi thiết bị.
  - Tích hợp `AuthContext` và bộ thư viện gọi API trung tâm `api.ts`.
  - Màn hình Trang chủ (`/`): Giới thiệu hệ thống, trạng thái kết nối backend thời gian thực, tiến độ 7 phases.
  - Màn hình Đăng nhập (`/login`): Hỗ trợ điền nhanh thông tin tài khoản mẫu (Admin/Student/Teacher) chỉ bằng 1 cú click.
  - Màn hình Đăng ký (`/register`): Đăng ký tài khoản học sinh mới kèm tự động đăng nhập.
  - Bảng Quản trị Admin (`/dashboard/admin`): Thống kê tổng quan người dùng, trạng thái kết nối database, danh sách tài khoản theo vai trò (Role badge).
  - Không gian Học sinh (`/dashboard/student`): Thẻ thông tin học sinh, trạng thái sẵn sàng cho Phase 5 (Exam Engine) & Phase 6 (AI Tutor).
- **Docker & Đóng gói**:
  - `Dockerfile` cho Backend.
  - `Dockerfile` cho Frontend.
  - `docker-compose.yml` định nghĩa cụm dịch vụ `postgres`, `backend`, `frontend`.

---

## Files Changed / Created

- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/phase-reports/phase-1.md`
- `README.md`
- `.gitignore`
- `.env.example`
- `docker-compose.yml`
- **Backend**:
  - `backend/requirements.txt`
  - `backend/Dockerfile`
  - `backend/alembic.ini`
  - `backend/alembic/env.py`
  - `backend/alembic/versions/f31981969248_create_users_table.py`
  - `backend/app/core/config.py`
  - `backend/app/core/database.py`
  - `backend/app/core/security.py`
  - `backend/app/models/base.py`
  - `backend/app/models/user.py`
  - `backend/app/schemas/token.py`
  - `backend/app/schemas/user.py`
  - `backend/app/api/deps.py`
  - `backend/app/api/v1/auth.py`
  - `backend/app/api/v1/users.py`
  - `backend/app/api/v1/router.py`
  - `backend/app/main.py`
  - `backend/tests/conftest.py`
  - `backend/tests/test_auth.py`
  - `backend/tests/test_users.py`
- **Frontend**:
  - `frontend/src/types/index.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/context/AuthContext.tsx`
  - `frontend/src/components/Navbar.tsx`
  - `frontend/src/app/layout.tsx`
  - `frontend/src/app/page.tsx`
  - `frontend/src/app/login/page.tsx`
  - `frontend/src/app/register/page.tsx`
  - `frontend/src/app/dashboard/admin/page.tsx`
  - `frontend/src/app/dashboard/student/page.tsx`
  - `frontend/Dockerfile`

---

## Tests

- Chạy bộ kiểm thử tự động Backend (Pytest):
  - `tests/test_auth.py::test_health_check` — PASS
  - `tests/test_auth.py::test_register_student_success` — PASS
  - `tests/test_auth.py::test_register_duplicate_email_fails` — PASS
  - `tests/test_auth.py::test_login_admin_success` — PASS
  - `tests/test_auth.py::test_login_student_success` — PASS
  - `tests/test_auth.py::test_login_wrong_password_fails` — PASS
  - `tests/test_auth.py::test_login_nonexistent_email_fails` — PASS
  - `tests/test_auth.py::test_get_current_user_me_authenticated` — PASS
  - `tests/test_auth.py::test_get_current_user_me_unauthorized` — PASS
  - `tests/test_auth.py::test_get_current_user_me_invalid_token` — PASS
  - `tests/test_auth.py::test_seed_default_users` — PASS
  - `tests/test_users.py::test_admin_can_list_users` — PASS
  - `tests/test_users.py::test_student_cannot_list_users` — PASS
  - `tests/test_users.py::test_unauthenticated_cannot_list_users` — PASS
  - `tests/test_users.py::test_admin_can_create_user` — PASS
  - `tests/test_users.py::test_student_cannot_create_user` — PASS
- Chạy kiểm thử build Frontend:
  - `npm run build` — PASS (TypeScript compiles cleanly with 0 errors, all routes statically rendered).
- Xác minh thủ công Live Server:
  - Khởi động uvicorn server và gọi test live API `/api/health` -> 200 Healthy.
  - Đăng nhập Admin & Student -> Nhận JWT Token hợp lệ và trả về 401 khi không có token.

---

## Test Result

**PASS (100% 16/16 backend tests pass, frontend build pass)**

---

## Known Issues

- Không có vấn đề tồn đọng nào trong Phase 1.

---

## Architecture Decisions

- Sử dụng trực tiếp thư viện `bcrypt` nguyên bản thay vì thông qua `passlib` để loại bỏ xung đột giới hạn chuỗi 72-byte và cảnh báo lỗi phiên bản giữa passlib và bcrypt 5.0+.
- Hỗ trợ cơ chế kết nối cơ sở dữ liệu linh hoạt (Multi-dialect): Sử dụng PostgreSQL trong môi trường container và tự động fallback sang SQLite local cho developer workstation để đảm bảo chạy và kiểm thử nhanh chóng mà không gặp trở ngại cài đặt.

---

## Next Phase

**Phase 2 — Document Knowledge** (Upload tài liệu SGK PDF/DOCX, trích xuất cấu trúc chương/bài/mục tiêu học tập và thiết lập Knowledge Map).
*Lưu ý: Không triển khai Phase 2 cho đến khi Phase 1 được người dùng nghiệm thu.*
