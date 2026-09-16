# Online Exam AI

Hệ thống Khảo Thí Trực Tuyến & Gia Sư Trí Tuệ Nhân Tạo Thông Minh (MVP) theo chuẩn đặc tả kỹ thuật [ONLINE_EXAM_AI_SPEC.md](docs/ONLINE_EXAM_AI_SPEC.md).

---

## 1. Yêu Cầu Hệ Thống (Prerequisites)

- **Python**: 3.11+ (Hỗ trợ tốt trên Python 3.14)
- **Node.js**: 20+ (Khuyên dùng Node 22 hoặc 24)
- **Cơ sở dữ liệu**: PostgreSQL 16 (Hỗ trợ SQLite zero-setup cho môi trường phát triển cục bộ và testing)
- **Docker & Docker Compose** (Tùy chọn khi triển khai production)

---

## 2. Cài Đặt & Khởi Chạy

### 2.1. Cấu hình biến môi trường
Sao chép file cấu hình mẫu:
```bash
cp .env.example .env
```

### 2.2. Khởi chạy Backend (FastAPI)

1. Di chuyển vào thư mục backend và kích hoạt môi trường ảo:
```bash
cd backend
python -m venv .venv
# Trên Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Trên Linux/macOS:
source .venv/bin/activate
```

2. Cài đặt các thư viện cần thiết:
```bash
pip install -r requirements.txt
```

3. Chạy migration cơ sở dữ liệu:
```bash
alembic upgrade head
```

4. Khởi chạy Uvicorn server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Health Check: `http://localhost:8000/api/health`
- Swagger UI / OpenAPI Docs: `http://localhost:8000/docs`

### 2.3. Khởi chạy Frontend (Next.js 15)

1. Di chuyển vào thư mục frontend:
```bash
cd frontend
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Khởi chạy server phát triển:
```bash
npm run dev
```
Truy cập giao diện tại: `http://localhost:3000`

---

## 3. Tài Khoản Dùng Thử Mẫu (Seeded Demo Accounts)

Hệ thống đã chuẩn bị sẵn endpoint `/api/v1/auth/seed` và các tài khoản demo 1-click tại trang Đăng nhập:

| Vai trò (Role) | Email | Mật khẩu mặc định | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@example.com` | `Admin@123` | Quản trị hệ thống, xem toàn bộ người dùng, quản lý cấu hình |
| **TEACHER** | `teacher@example.com` | `Teacher@123` | Quản lý SGK, duyệt câu hỏi, soạn đề thi |
| **STUDENT** | `student@example.com` | `Student@123` | Thi trực tuyến, lưu bài làm, học cùng AI Tutor |

---

## 4. Chạy Kiểm Thử Tự Động (Testing)

### 4.1. Backend Tests (Pytest)
```bash
cd backend
pytest -v tests/
```

### 4.2. Frontend Build & Typecheck
```bash
cd frontend
npm run build
```

---

## 5. Triển Khai Với Docker Compose

Khởi chạy đồng thời PostgreSQL, Backend và Frontend trong các container tách biệt:
```bash
docker compose up --build -d
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

---

## 6. Trạng Thái Các Giai Đoạn Phát Triển (Phase Status)

- [x] **Phase 1 — Foundation**: Hoàn tất 100%, tất cả test cases passed, giao diện Next.js và API FastAPI kết nối hoàn chỉnh.
- [ ] **Phase 2 — Document Knowledge**: Sẵn sàng triển khai khi Phase 1 được nghiệm thu.
- [ ] **Phase 3 — Question Bank**
- [ ] **Phase 4 — Gemini AI**
- [ ] **Phase 5 — Exam Engine**
- [ ] **Phase 6 — AI Tutor**
- [ ] **Phase 7 — Dashboard & Analytics**
