# IMPLEMENTATION PLAN — ONLINE EXAM AI

Dự án phát triển MVP **Online Exam AI** theo đặc tả tại [ONLINE_EXAM_AI_SPEC.md](file:///d:/OneDrive/Documents/ThiOnline/docs/ONLINE_EXAM_AI_SPEC.md).

---

## 1. TỔNG QUAN CÁC GIAI ĐOẠN (PHASES)

Hệ thống được chia thành 7 giai đoạn phát triển tuần tự:

- **Phase 1 — Foundation**: [ĐÃ HOÀN THÀNH 100%] Cấu trúc dự án, Docker, Database, Backend FastAPI, Frontend Next.js, Authentication (JWT), Phân quyền Role (Admin/Teacher/Student), Kiểm thử và CI/CD cơ bản.
- **Phase 2 — Document Knowledge**: [ĐÃ HOÀN THÀNH 100%] Pipeline xử lý tài liệu (PDF, DOCX, TXT), Chunking có bảo toàn ngữ cảnh, Trích xuất cấu trúc kiến thức 8 cấp (Knowledge Map: Subject -> Grade -> Book -> Chapter -> Lesson -> Topic -> Concept -> Learning Objective), Giao diện Quản lý Tài liệu & Trình duyệt Cây Tri thức tương tác.
- **Phase 3 — Question Bank**: [ĐÃ HOÀN THÀNH 100%] Quản lý ngân hàng câu hỏi (CRUD, Options, Trạng thái DRAFT/REVIEW/APPROVED/REJECTED), Import Word (.docx) theo chuẩn định dạng, Duyệt câu hỏi đơn lẻ & hàng loạt.
- **Phase 4 — Gemini AI**: [ĐÃ HOÀN THÀNH 100%] Tích hợp Google Gemini API, Grounding Rule (SGK làm chuẩn kiến thức, Internet làm bối cảnh thực tế), AI Question Generator, Backend Validation, Teacher Review interface.
- **Phase 5 — Exam Engine**: [ĐÃ HOÀN THÀNH 100%] Tạo đề thi, Phân bổ câu hỏi, Giao bài cho học sinh, Server-authoritative Timer, Autosave đáp án từng câu, Bảo mật đề thi (không lộ đáp án xuống frontend), Tự động chấm điểm.
- **Phase 6 — AI Tutor**: [TIẾP THEO] Phân tích câu sai sau khi nộp bài, Gemini giải thích nguyên nhân sai, nhắc lại khái niệm cốt lõi theo SGK, gợi ý tài liệu học tập.
- **Phase 7 — Dashboard & Analytics**: Báo cáo thống kê dành cho giáo viên và học sinh, phân tích độ khó câu hỏi, tỷ lệ lựa chọn các phương án.

---

## 2. KẾ HOẠCH CHI TIẾT PHASE 1 — FOUNDATION [HOÀN THÀNH]

```text
[x] Phân tích hiện trạng repository và môi trường thực tế
[x] Thiết lập cấu trúc dự án chuẩn: backend/ và frontend/
[x] Cấu hình cơ sở dữ liệu (PostgreSQL sẵn sàng qua Docker, SQLite fallback chạy độc lập cục bộ)
[x] Backend FastAPI hoàn chỉnh: Cấu hình, Database Engine, Model User, Schemas, Security (Bcrypt + JWT)
[x] Alembic migrations tạo bảng users
[x] API endpoints: Register, Login, Me, Seed demo data, Quản lý Users (Admin)
[x] Frontend Next.js 15: Giao diện hiện đại, Auth Context, Trang Chủ, Login, Register, Admin Dashboard, Student Dashboard
[x] Bộ kiểm thử tự động (Unit & Integration tests) cho Backend (16/16 pass)
[x] Docker Compose cấu hình trọn gói
[x] Kiểm tra lint, build và tạo báo cáo Phase 1 Report
```

---

## 3. KẾ HOẠCH CHI TIẾT PHASE 2 — DOCUMENT KNOWLEDGE [HOÀN THÀNH]

### 3.1. Mục tiêu & Thực hiện
```text
[x] Mô hình dữ liệu Document, DocumentChunk, KnowledgeNode (SQLAlchemy + Alembic)
[x] Migration Alembic: 2ff49b90f2c8_create_documents_and_knowledge_tables
[x] Parser đa định dạng:
    [x] PyMuPDF (PDF): Trích xuất từng trang, giữ nguyên số trang và khối tiêu đề
    [x] python-docx (DOCX): Trích xuất đoạn văn, bảng biểu và cấp độ Heading
    [x] TXT: Đọc văn bản đa bảng mã tiếng Việt (UTF-8, UTF-8-sig, CP1258, Latin-1)
[x] StructureExtractor & Semantic Chunker:
    [x] Nhận diện cấu trúc chuẩn SGK Việt Nam (Chương, Bài, Chủ đề, Khái niệm, Mục tiêu cần đạt)
    [x] Phân đoạn văn bản ~1.000 ký tự có bảo toàn ngữ cảnh và liên kết câu logic
    [x] Xây dựng cây Knowledge Map 8 cấp độ chuẩn:
        Subject -> Grade -> Book -> Chapter -> Lesson -> Topic -> Concept -> Learning Objective
[x] Quản lý vòng đời trạng thái & Xử lý sự cố (Failure Handling):
    [x] Trạng thái: PENDING -> PROCESSING -> COMPLETED / FAILED
    [x] Ghi nhận chi tiết thông điệp lỗi nếu tệp lỗi hoặc định dạng hỏng
    [x] Cung cấp cơ chế Thử lại (Retry Processing) an toàn
[x] API Endpoints (/api/v1/documents):
    [x] POST /api/v1/documents/upload (Upload & trích xuất tự động)
    [x] GET /api/v1/documents/ (Lọc theo môn học, khối lớp, trạng thái)
    [x] GET /api/v1/documents/{id} (Chi tiết tài liệu & metadata)
    [x] GET /api/v1/documents/{id}/chunks (Danh sách phân đoạn, tìm kiếm, phân trang)
    [x] GET /api/v1/documents/{id}/knowledge-map (Cây tri thức 8 cấp độ)
    [x] GET /api/v1/documents/knowledge-map/overview (Bản đồ tri thức toàn hệ thống)
    [x] POST /api/v1/documents/{id}/retry (Thử lại xử lý)
    [x] DELETE /api/v1/documents/{id} (Xóa cascade DB & file hệ thống)
[x] Giao diện Người dùng (Frontend Next.js):
    [x] Trang Quản lý tài liệu (/documents): Kéo thả upload, bộ lọc, thẻ thống kê, cảnh báo lỗi, nút Thử lại
    [x] Trang Chi tiết & Phân đoạn (/documents/[id]): Thống kê tổng hợp, trình duyệt và tìm kiếm chunk
    [x] Trình duyệt Bản đồ Tri thức (/knowledge-map): Cây tương tác đa cấp, mở rộng/thu gọn, tìm kiếm theo khái niệm
    [x] Thanh điều hướng Navbar liên kết trực tiếp
[x] Kiểm thử tự động & Xác minh:
    [x] 29/29 tests backend Pytest pass (test_parsers, test_documents, test_auth, test_users)
    [x] Frontend Next.js production build pass (0 TypeScript errors, 10 static/dynamic routes)
```

### 3.2. Acceptance Criteria Phase 2
```text
[x] Upload PDF OK
[x] Upload DOCX OK
[x] Parse text OK
[x] Chunk document OK
[x] Extract chapter OK
[x] Extract lesson OK
[x] Extract topic OK
[x] Extract learning objective OK
[x] Save metadata OK
[x] UI xem được document OK
[x] UI xem được Knowledge Map OK
[x] Tests pass (100% 29/29 backend tests, frontend build pass)
```

---

## 4. KẾ HOẠCH CHI TIẾT PHASE 3 — QUESTION BANK [HOÀN THÀNH]

### 4.1. Mục tiêu & Thực hiện
```text
[x] Mô hình dữ liệu Question và QuestionOption (SQLAlchemy + Alembic)
    [x] Question: content, question_type (MULTIPLE_CHOICE_SINGLE), difficulty (EASY/MEDIUM/HARD), status (DRAFT/REVIEW/APPROVED/REJECTED/ARCHIVED), source (MANUAL/WORD_IMPORT/AI_GENERATED), subject, grade (4-9), chapter, lesson, topic, learning_objective, explanation, foreign keys đến KnowledgeNode, Document, User.
    [x] QuestionOption: question_id, option_key (A/B/C/D), content, is_correct, explanation, order_index.
[x] Word Importer Service (app/services/word_importer.py):
    [x] Phân tích tệp Word (.docx) chuẩn đề thi Việt Nam
    [x] Trích xuất tiêu đề câu hỏi: Câu X / Bài X / Question X
    [x] Trích xuất phương án A, B, C, D (hỗ trợ cả dòng đơn và inline nhiều phương án)
    [x] Nhận diện đáp án đúng: dòng "Đáp án: [A-D]" hoặc chữ in đậm (bold run)
    [x] Trích xuất Lời giải / Giải thích
    [x] Validation nghiêm ngặt: Phát hiện lỗi thiếu phương án, thiếu đáp án đúng, câu rỗng mà không crash
    [x] Chế độ Preview (commit=False) và Import chính thức vào DB (commit=True)
[x] Question Service & CRUD Logic (app/services/question_service.py):
    [x] Tạo câu hỏi thủ công kèm 4 phương án
    [x] Lấy chi tiết & Tìm kiếm / Lọc đa tiêu chí (Subject, Grade, Difficulty, Status, Source, Search keyword)
    [x] Chỉnh sửa câu hỏi & các phương án lựa chọn
    [x] Xóa câu hỏi (cascade options)
    [x] Chuyển đổi trạng thái vòng đời (Approve, Reject, Draft, Review)
    [x] Xử lý duyệt hàng loạt (Batch Status Update)
[x] Phân quyền & Bảo mật (Access Control):
    [x] Giáo viên (TEACHER) & Admin: Toàn quyền CRUD, Import Word, Duyệt/Từ chối câu hỏi
    [x] Học sinh (STUDENT): Chỉ truy cập và đọc danh sách các câu hỏi ĐÃ DUYỆT (APPROVED), chặn truy cập các trạng thái khác (403 Forbidden)
[x] API Endpoints (/api/v1/questions):
    [x] GET /api/v1/questions/ (Danh sách, lọc, tìm kiếm, phân trang)
    [x] GET /api/v1/questions/stats (Thống kê tổng hợp số lượng theo status, difficulty, grade, subject)
    [x] POST /api/v1/questions/ (Tạo mới câu hỏi)
    [x] GET /api/v1/questions/{id} (Chi tiết câu hỏi)
    [x] PUT /api/v1/questions/{id} (Cập nhật câu hỏi & options)
    [x] DELETE /api/v1/questions/{id} (Xóa câu hỏi)
    [x] POST /api/v1/questions/{id}/status (Đổi trạng thái duyệt)
    [x] POST /api/v1/questions/batch-status (Duyệt/Từ chối hàng loạt)
    [x] POST /api/v1/questions/import-word (Tải lên & đọc tệp Word .docx)
[x] Giao diện Người dùng Frontend Next.js (/questions):
    [x] Thẻ thống kê (Tổng số, Đã duyệt, Chờ duyệt, Bản nháp/Từ chối)
    [x] Thanh lọc đa năng (Từ khóa, Môn học, Khối lớp 4-9, Độ khó, Trạng thái)
    [x] Thanh thao tác hàng loạt (Chọn tất cả, Duyệt tất cả, Từ chối tất cả)
    [x] Lưới thẻ câu hỏi: Hiển thị đầy đủ metadata, thẻ phân loại, 4 phương án với phông nền đáp án đúng nổi bật, hộp lời giải
    [x] Modal Tạo/Sửa câu hỏi: Form nhập liệu trực quan, chọn phương án đúng, kiểm tra ràng buộc client-side
    [x] Modal Import Word: Kéo thả file .docx, chọn môn học & khối lớp, chế độ xem trước lỗi và kết quả import
    [x] Tích hợp thanh điều hướng Navbar
[x] Dữ liệu mẫu & Seed script (seed_questions.py):
    [x] Nạp 9+ câu hỏi mẫu thực tế môn Toán, Tiếng Việt, Khoa học cho các khối lớp 4-9
[x] Kiểm thử tự động & Xác minh:
    [x] 42/42 backend tests Pytest pass (test_questions.py, test_word_importer.py, test_documents.py, test_auth.py, test_users.py, test_parsers.py)
    [x] Frontend Next.js typecheck pass (0 TypeScript errors)
    [x] Frontend Next.js build pass (`npm run build` thành công 11 static/dynamic routes)
```

### 4.2. Acceptance Criteria Phase 3
```text
[x] Create question OK
[x] Edit question OK
[x] Delete question OK
[x] Import Word OK
[x] Parse A/B/C/D OK
[x] Parse answer OK
[x] Parse explanation OK
[x] Approve question OK
[x] Reject question OK
[x] Only APPROVED questions can enter official exam / visible to student OK
[x] Tests pass (100% 42/42 backend tests, frontend build pass)
```

---

## 5. KẾ HOẠCH CHI TIẾT PHASE 4 — GEMINI AI [HOÀN THÀNH]

### 5.1. Mục tiêu & Thực hiện
```text
[x] AI Grounding Rule (Spec Section 11):
    [x] SGK làm chuẩn kiến thức, môn học, khối lớp 4–9, chương, bài học và mục tiêu cần đạt
    [x] Web context được phép bổ sung tình huống thực tế sinh động mà không làm vượt quá chương trình
[x] Gemini Question Generator Service (app/services/ai_question_service.py):
    [x] Tích hợp Google Gemini API với JSON Structured Output Mode (responseMimeType="application/json")
    [x] Phân bổ tỷ lệ độ khó theo yêu cầu (Easy %, Medium %, Hard %)
    [x] Đính kèm ngữ cảnh tài liệu SGK (Document Context) khi người dùng chọn tài liệu tham chiếu
    [x] Bộ sinh dự phòng thông minh (Smart Fallback Generator) hoạt động khi offline hoặc chưa có API Key
[x] Backend Question Validator (Backend Invariants):
    [x] Kiểm tra chính xác 4 phương án (A, B, C, D)
    [x] Kiểm tra duy nhất 1 đáp án đúng (is_correct = True)
    [x] Kiểm tra trùng lặp nội dung giữa các phương án
    [x] Kiểm tra câu hỏi, lời giải và phương án không được rỗng
    [x] Kiểm tra độ khó thuộc EASY / MEDIUM / HARD
[x] API Endpoint (/api/v1/ai):
    [x] POST /api/v1/ai/questions/generate (Phân quyền Teacher / Admin)
[x] Giao diện Người dùng Frontend Next.js (components/AiQuestionModal.tsx):
    [x] Nút bấm "Tạo bằng AI (Gemini)" nổi bật tại trang /questions
    [x] Form cấu hình: Môn học, Khối lớp 4-9, Đính kèm SGK gốc, Số lượng (1-20), Slider phân bổ độ khó, Công tắc Web Context
    [x] Hiệu ứng sinh câu hỏi AI sống động
    [x] Giao diện Duyệt trực quan: Hiển thị chi tiết từng câu do AI sinh, thẻ AI Grounding / Web Context, lời giải, nút Duyệt ngay từng câu vào Ngân hàng CSDL
[x] Kiểm thử tự động & Xác minh:
    [x] 49/49 backend tests Pytest pass (bổ sung test_ai_questions.py kiểm thử validator, fallback generator và API permission)
    [x] Frontend Next.js typecheck pass (0 TypeScript errors)
    [x] Frontend Next.js production build pass (`npm run build` thành công 11 static/dynamic routes)
```

### 5.2. Acceptance Criteria Phase 4
```text
[x] Gemini API Integration OK
[x] AI Grounding Rule (SGK primary, Web context secondary) OK
[x] Prompt Engineering GDPT 2018 Lớp 4-9 OK
[x] Backend Strict Validation (4 options, 1 correct, non-empty) OK
[x] AI Question Generation Endpoint OK
[x] Teacher Review & Direct Approval UI OK
[x] Tests pass (100% 49/49 backend tests, frontend build pass)
```

---

## 6. KẾ HOẠCH CHI TIẾT PHASE 5 — EXAM ENGINE [HOÀN THÀNH]

### 6.1. Mục tiêu & Thực hiện
```text
[x] Mô hình dữ liệu Đề thi & Lượt làm bài (SQLAlchemy + Alembic):
    [x] Exam: title, description, subject, grade, duration_minutes, total_questions, total_points, passing_score, shuffle_questions, shuffle_options, start_time, end_time, status (DRAFT/PUBLISHED/CLOSED/ARCHIVED), created_by_id.
    [x] ExamQuestion: exam_id, question_id, order_index, points.
    [x] ExamAssignment: exam_id, student_id, grade, assigned_at.
    [x] ExamAttempt: exam_id, student_id, started_at, deadline_at, submitted_at, status (IN_PROGRESS/SUBMITTED/TIMED_OUT), score, percentage, correct_count, total_count, passing_score, is_passed.
    [x] AttemptAnswer: attempt_id, question_id, selected_option_key, is_correct, points_earned, answered_at.
[x] Quản lý Thời gian Server-Authoritative (Server-Authoritative Timer):
    [x] Đếm ngược thời gian dựa trên `deadline_at` được tạo trên Server.
    [x] Chuẩn hóa UTC đếm ngược bằng `_ensure_utc` loại bỏ xung đột offset-naive và offset-aware datetimes.
    [x] Tự động nộp bài khi hết giờ (TIMED_OUT) khi student gửi answer hoặc submit sau deadline.
[x] Bảo mật Đề thi (Security Payload Masking):
    [x] Khi học sinh gọi `start_exam_attempt` hoặc `get_attempt_room`, payload `StudentExamTakeResponse` CHE TOÀN BỘ `is_correct` và `explanation`.
    [x] Đáp án đúng chỉ được tiết lộ duy nhất ở API `get_attempt_result` sau khi lượt làm bài đã hoàn thành (SUBMITTED / TIMED_OUT).
[x] Chức năng Autosave Tức thì:
    [x] API `autosave_answer` cho phép lưu câu trả lời của từng câu hỏi ngay khi học sinh tick chọn.
    [x] Giao diện tự động lưu với trạng thái visual feedback (Đang lưu -> Đã lưu).
[x] API Endpoints (/api/v1/exams):
    [x] POST /api/v1/exams/ (Tạo đề thi mới & gán danh sách câu hỏi)
    [x] GET /api/v1/exams/ (Danh sách đề thi theo môn học, lớp, trạng thái)
    [x] GET /api/v1/exams/{id} (Chi tiết đề thi)
    [x] POST /api/v1/exams/{id}/publish (Xuất bản đề thi)
    [x] POST /api/v1/exams/{id}/start (Bắt đầu / tiếp tục lượt thi cho học sinh)
    [x] GET /api/v1/exams/attempts/{attempt_id} (Phòng thi & thời gian đếm ngược)
    [x] POST /api/v1/exams/attempts/{attempt_id}/answers (Autosave câu trả lời)
    [x] POST /api/v1/exams/attempts/{attempt_id}/submit (Nộp bài thi & chấm điểm tự động)
    [x] GET /api/v1/exams/attempts/{attempt_id}/result (Xem chi tiết kết quả & lời giải)
[x] Giao diện Người dùng (Frontend Next.js):
    [x] Trang Quản lý Đề thi cho Giáo viên (/exams): Danh sách đề thi, trạng thái xuất bản, thông số kỳ thi.
    [x] Wizard Tạo Đề Thi cho Giáo viên (/exams/create): Chọn môn/lớp, thời gian, điểm số, bộ lọc và chọn câu hỏi từ Ngân hàng câu hỏi.
    [x] Trang Danh sách Bài thi cho Học sinh (/student/exams): Thẻ đề thi theo môn/lớp, nút Bắt đầu làm bài.
    [x] Trang Phòng thi Trực tuyến cho Học sinh (/student/exams/[id]/take): Đồng hồ đếm ngược Server, lưới điều hướng câu hỏi, autosave, đánh dấu xem lại, modal xác nhận nộp bài.
    [x] Trang Kết quả Thi cho Học sinh (/student/exams/[id]/result): Bảng điểm 10.0, phần trăm, badge ĐẠT / KHÔNG ĐẠT, xem chi tiết từng câu sai/đúng và Lời giải chi tiết.
[x] Kiểm thử tự động & Xác minh:
    [x] 53/53 backend pytest tests pass 100% (bao gồm 14 tests mới trong `test_exams.py` kiểm thử Server-authoritative timer, security payload masking, autosave, auto-grading, pass/fail threshold).
    [x] Frontend Next.js typecheck pass (0 TypeScript errors).
```

### 6.2. Acceptance Criteria Phase 5
```text
[x] Exam Creation Wizard OK
[x] Question Assignment OK
[x] Publish Exam OK
[x] Student Start Attempt OK
[x] Security Payload Masking (hide answer key during exam) OK
[x] Server-Authoritative Timer OK
[x] Instant Autosave Answer OK
[x] Flag Question for Review OK
[x] Auto-submit on Expiry OK
[x] Auto-grading & Score Calculation (10.0 scale) OK
[x] Detailed Answer Review & Explanation OK
[x] All Tests Pass (100% 53/53 backend pytest tests, 0 TS frontend errors) OK
```
