# Phase 4 Report — Gemini AI Question Generation Engine

## Implemented

- **Gemini AI Client & Grounding Architecture**:
  - `GeminiClient`: Tích hợp Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`) hỗ trợ sinh câu hỏi trắc nghiệm chuẩn dữ liệu JSON.
  - **SGK Grounding Rule**: Kiến thức, chủ đề, khái niệm, mục tiêu học tập bắt buộc lấy từ SGK; Internet (Web context) chỉ dùng để cung cấp bối cảnh thực tế/ngữ cảnh thực nghiệm mà không làm sai lệch phạm vi chương trình.
  - `QuestionValidator`: Backend validation độc lập nghiêm ngặt (đúng 4 lựa chọn, đúng 1 đáp án đúng, không trùng đáp án, đủ giải thích, nguồn SGK hợp lệ).
  - `FallbackGenerator`: Sinh câu hỏi dự phòng từ phân đoạn tri thức SGK khi Gemini API gặp sự cố (timeout, rate limit, hỏng JSON), bảo đảm hệ thống không bị crash.
- **RESTful APIs sinh câu hỏi bằng AI (`/api/v1/ai`)**:
  - `POST /api/v1/ai/generate-questions`: Sinh danh sách câu hỏi AI kèm phân bổ độ khó (EASY, MEDIUM, HARD) và tùy chọn ngữ cảnh Web.
  - `POST /api/v1/ai/validate-question`: Kiểm định chất lượng câu hỏi.
- **Giao diện Người dùng (Frontend Next.js)**:
  - Màn hình Tạo câu hỏi bằng AI (`/questions/ai-generate`): Chọn môn học, khối lớp, tài liệu SGK, chương/bài, số lượng, tỉ lệ độ khó, bật/tắt Web Context.
  - Xem danh sách câu hỏi AI vừa sinh, chỉnh sửa trực tiếp và nhấn Duyệt (Approve) đưa vào Ngân hàng câu hỏi.

---

## Files Changed

- `backend/app/services/gemini_service.py`
- `backend/app/schemas/ai.py`
- `backend/app/api/v1/ai.py`
- `backend/tests/test_ai_questions.py`
- `frontend/src/app/questions/ai-generate/page.tsx`
- `docs/phase-reports/phase-4.md`

---

## Tests

- `tests/test_ai_questions.py`: 6 tests sinh câu hỏi AI, validate backend, fallback khi AI failure, kiểm tra SGK grounding.

---

## Test Result

**PASS**

---

## Known Issues

- Không.

---

## Next Phase

**Phase 5 — Exam Engine & Student Exam Taking**
