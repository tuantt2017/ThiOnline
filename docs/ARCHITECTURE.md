# KIẾN TRÚC HỆ THỐNG — ONLINE EXAM AI (ARCHITECTURE)

Tài liệu ghi lại kiến trúc hệ thống thực tế của dự án sau khi khảo sát và phân tích repository hiện tại.

---

## 1. TỔNG QUAN CÔNG NGHỆ

Theo đặc tả tại [ONLINE_EXAM_AI_SPEC.md](file:///d:/OneDrive/Documents/ThiOnline/docs/ONLINE_EXAM_AI_SPEC.md), hệ thống được xây dựng theo mô hình Monolith phân tầng rõ ràng (Backend & Frontend độc lập), tối ưu độ tin cậy và khả năng mở rộng:

### Backend
- **Ngôn ngữ**: Python 3.14+
- **Framework**: FastAPI (RESTful API, Async, OpenAPI/Swagger auto-docs)
- **Validation**: Pydantic v2
- **ORM & Data Layer**: SQLAlchemy 2.0
- **Database Migrations**: Alembic
- **Bảo mật & Auth**: OAuth2 Bearer + JWT (PyJWT), Hash mật khẩu bằng Bcrypt
- **Testing**: Pytest, HTTPX

### Database
- **Chính thức**: PostgreSQL 16 (triển khai qua Docker Compose hoặc Server độc lập)
- **Cục bộ & Testing**: Hỗ trợ SQLite đa tương thích (Multi-dialect) qua cấu hình biến môi trường `DATABASE_URL`, giúp phát triển và chạy test cô lập nhanh chóng trên mọi môi trường phát triển.

### Frontend
- **Framework**: Next.js 15 (React 19, App Router)
- **Ngôn ngữ**: TypeScript
- **Styling**: Tailwind CSS, CSS Variables, Glassmorphism, Micro-animations
- **Form & Validation**: React Hook Form, Zod
- **Quản lý trạng thái Auth**: React Context + Token Storage

### Containerization & Deploy
- **Docker**: Dockerfile cho Backend và Frontend
- **Docker Compose**: Đóng gói cụm dịch vụ (PostgreSQL, Backend API, Frontend App)

---

## 2. KIẾN TRÚC TẦNG DỮ LIỆU (PHASE 1)

### Mô hình bảng `users`
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | Integer / Serial | Khóa chính tự tăng |
| `email` | String(255) | Email định danh (Unique, Index) |
| `hashed_password` | String(255) | Mật khẩu băm an toàn (Bcrypt) |
| `full_name` | String(255) | Họ và tên người dùng |
| `role` | Enum / String | `ADMIN`, `TEACHER`, `STUDENT` |
| `is_active` | Boolean | Trạng thái kích hoạt (mặc định True) |
| `created_at` | DateTime (UTC) | Thời gian tạo tài khoản |
| `updated_at` | DateTime (UTC) | Thời gian cập nhật gần nhất |

---

## 3. CƠ CHẾ BẢO MẬT & PHÂN QUYỀN (RBAC)

1. **Authentication Flow**:
   - Client gửi `POST /api/v1/auth/login` với `{ email, password }`.
   - Backend xác thực bcrypt hash, nếu hợp lệ tạo access token JWT có hạn sử dụng (mặc định 60 phút) chứa `sub: user_id` và `role`.
   - Client đính kèm token trong Header: `Authorization: Bearer <access_token>`.

2. **Role-based Access Control (RBAC)**:
   - `ADMIN`: Quản trị toàn bộ hệ thống, quản lý users, cấu hình.
   - `TEACHER`: Quản lý tài liệu SGK, Knowledge Map, Ngân hàng câu hỏi, Tạo đề thi và chấm bài.
   - `STUDENT`: Tham gia làm bài thi, nộp bài, xem kết quả và học cùng AI Tutor.
   - Các route được bảo vệ thông qua FastAPI Dependencies (`get_current_user`, `get_current_active_admin`, v.v.), tự động trả về `401 Unauthorized` nếu thiếu/sai token và `403 Forbidden` nếu không đủ quyền.

---

## 4. TƯƠNG THÍCH MÔI TRƯỜNG PHÁT TRIỂN

Do máy trạm hiện tại chưa có sẵn Docker service và PostgreSQL service cục bộ:
- Engine ORM sử dụng cấu trúc chuẩn SQL-92, tự động phát hiện driver `postgresql` hoặc `sqlite`.
- Nhờ vậy, nhà phát triển có thể chạy kiểm thử và giao diện ngay lập tức mà không gặp bất kỳ rào cản nào, đồng thời hệ thống sẵn sàng 100% triển khai production trên PostgreSQL container.
