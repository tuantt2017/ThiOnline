# Phase 6 Report — AI Tutor — Explanation & Homework Guidance

## Implemented

- **Kiến trúc AI Tutor Grounding & Phân tích Đột phá**:
  - `AiTutorService`: Tự động gom nhóm các câu hỏi làm sai theo chủ đề (`topic`) sau khi học sinh nộp bài thi.
  - Phân tích sâu với Gemini AI dựa trên nguồn tri thức SGK (`Knowledge Node` & `Document Chunks`) đã tải lên.
  - Phản hồi cấu trúc chuẩn 4 tiêu chí bắt buộc theo đặc tả:
    1. `why_wrong`: Phân tích nguyên nhân vì sao chọn đáp án đó là chưa chính xác.
    2. `correct_concept`: Giải thích bản chất khái niệm tri thức đúng theo chuẩn SGK.
    3. `study_hint`: Gợi ý phương pháp ôn tập & luyện tập tương tự.
    4. `source_reference`: Trích dẫn chi tiết tên tài liệu SGK, chương, bài, trang tham khảo.
  - Giới hạn phân quyền an toàn: AI Tutor chỉ hoạt động sau khi bài thi đã ở trạng thái `SUBMITTED` (bị từ chối HTTP 400 nếu đang làm bài).
  - Tích hợp `Fallback Generator` thông minh tạo phản hồi mẫu chuẩn SGK khi Gemini API quá tải hoặc không khả dụng.
- **RESTful API AI Tutor (`/api/v1/exams`)**:
  - `POST /api/v1/exams/attempts/{attempt_id}/ai-tutor`: Yêu cầu trợ lý AI Tutor phân tích kết quả bài thi đã nộp.
- **Giao diện Người dùng (Frontend Next.js)**:
  - Thẻ phân tích AI Tutor Gemini (`/student/exams/[id]/result`): Hiển thị trợ lý AI Tutor phân tích từng câu sai với thiết kế hiện đại, độ tương phản cao, phân màu trực quan cho từng mục `why_wrong`, `correct_concept`, `study_hint`, `source_reference`.

---

## Files Changed

- `backend/app/schemas/ai.py`
- `backend/app/services/ai_tutor_service.py`
- `backend/app/api/v1/exams.py`
- `backend/tests/test_ai_tutor.py`
- `frontend/src/types/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/student/exams/[id]/result/page.tsx`
- `docs/phase-reports/phase-6.md`

---

## Tests

- `tests/test_ai_tutor.py`: Test quy trình AI Tutor (kiểm tra bài thi `IN_PROGRESS` bị chặn, bài thi `SUBMITTED` trả về phản hồi 4 phần chuẩn SGK).

---

## Test Result

**PASS**

---

## Known Issues

- Không.

---

## Next Phase

**Phase 7 — Dashboard & Analytics Engine**
