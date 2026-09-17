# Phase 5 Report — Exam Engine & Student Exam Taking

## Implemented

- **Mô hình Dữ liệu Đề thi & Lượt làm bài**:
  - `Exam`: Đề thi, thời gian làm bài (phút), điểm tối đa, cấu hình trộn câu hỏi/đáp án, môn học, khối lớp, trạng thái (`DRAFT`, `PUBLISHED`, `ARCHIVED`).
  - `ExamQuestion`: Liên kết giữa đề thi và câu hỏi đã duyệt (`APPROVED`).
  - `ExamAssignment`: Phân công bài thi cho khối lớp (`target_grade`) hoặc từng học sinh (`student_id`).
  - `ExamAttempt`: Lượt làm bài của học sinh, thời điểm bắt đầu (`started_at`), hạn nộp bài (`deadline_at` server-authoritative), thời điểm nộp (`submitted_at`), trạng thái (`IN_PROGRESS`, `SUBMITTED`, `EXPIRED`), tổng điểm (`score`, `percentage`).
  - `AttemptAnswer`: Lưu vết từng đáp án được chọn kèm tự động lưu (Autosave).
- **Server-Authoritative Timer & Autosave & Security**:
  - `deadline_at` tính hoàn toàn bằng server time (`started_at + duration`).
  - Phụ tải payload bài thi bảo mật: Che giấu hoàn toàn `is_correct`, `explanation`, `score` khỏi payload client trả về cho học sinh trong quá trình thi.
  - Tự động chấm điểm (Auto-grading) dựa trên cấu hình điểm từng câu hỏi.
- **RESTful APIs Đề thi & Thi trực tuyến (`/api/v1/exams`)**:
  - `POST /api/v1/exams/`: Tạo đề thi.
  - `GET /api/v1/exams/`: Lấy danh sách đề thi.
  - `POST /api/v1/exams/{id}/publish`: Xuất bản đề thi.
  - `POST /api/v1/exams/{id}/assign`: Gán đề thi cho lớp/học sinh.
  - `POST /api/v1/exams/{id}/start`: Học sinh bắt đầu bài thi.
  - `POST /api/v1/exams/attempts/{attempt_id}/answers`: Tự động lưu đáp án.
  - `POST /api/v1/exams/attempts/{attempt_id}/submit`: Nộp bài & tính điểm.
  - `GET /api/v1/exams/attempts/{attempt_id}`: Xem chi tiết lượt thi & kết quả.
- **Giao diện Người dùng (Frontend Next.js)**:
  - Trang Quản lý Đề thi Giáo viên (`/exams`): Tạo đề, chọn câu hỏi từ ngân hàng, xuất bản, gán cho khối lớp.
  - Trang Danh sách Bài thi Học sinh (`/student/exams`): Xem danh sách đề thi theo đúng khối lớp của học sinh, trạng thái bài làm ("Chưa làm", "Đang làm", "Đã nộp").
  - Màn hình Thi trực tuyến Học sinh (`/student/exams/[id]/take`): Đồng hồ đếm ngược server-authoritative, tự động lưu câu trả lời, cảnh báo hết giờ và nộp bài an toàn.
  - Trang Kết quả & Đáp án (`/student/exams/[id]/result`): Xem điểm số, số câu đúng/sai, chi tiết giải thích cho từng câu hỏi sau khi nộp.

---

## Files Changed

- `backend/app/models/exam.py`
- `backend/app/schemas/exam.py`
- `backend/app/services/exam_service.py`
- `backend/app/api/v1/exams.py`
- `backend/tests/test_exams.py`
- `frontend/src/app/exams/page.tsx`
- `frontend/src/app/exams/create/page.tsx`
- `frontend/src/app/student/exams/page.tsx`
- `frontend/src/app/student/exams/[id]/take/page.tsx`
- `frontend/src/app/student/exams/[id]/result/page.tsx`
- `docs/phase-reports/phase-5.md`

---

## Tests

- `tests/test_exams.py`: 5 integration tests bao phủ tạo đề, bảo mật payload, autosave, chấm điểm tự động và xem báo cáo.

---

## Test Result

**PASS**

---

## Known Issues

- Không.

---

## Next Phase

**Phase 6 — AI Tutor — Explanation & Homework Guidance**
