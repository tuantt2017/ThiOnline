# Phase 3 Report — Question Bank

## Implemented

- **Mô hình Dữ liệu Câu hỏi & Lựa chọn**:
  - `Question`: Nội dung câu hỏi, môn học, khối lớp, độ khó (`EASY`, `MEDIUM`, `HARD`), trạng thái vòng đời (`DRAFT`, `REVIEW`, `APPROVED`, `REJECTED`, `ARCHIVED`), giải thích chi tiết, nguồn tri thức SGK, nguồn ngữ cảnh Web.
  - `QuestionOption`: Các lựa chọn (A, B, C, D) kèm cờ `is_correct`, thứ tự hiển thị và giải thích riêng nếu có.
  - Phân quyền kiểm duyệt: Chỉ câu hỏi ở trạng thái `APPROVED` mới được phép đưa vào đề thi chính thức.
- **Bộ phân tích Import file Word (.docx)**:
  - `WordImporter`: Trích xuất danh sách câu hỏi từ tài liệu Word hỗ trợ các định dạng phổ biến ("Câu 1. ...", "A. ...", "B. ...", "C. ...", "Đáp án: ...", "Giải thích: ...").
  - Báo lỗi rõ ràng với vị trí dòng/câu hỏi nếu định dạng không hợp lệ, không bỏ qua ngầm.
- **RESTful APIs Ngân hàng câu hỏi (`/api/v1/questions`)**:
  - `POST /api/v1/questions/`: Tạo câu hỏi thủ công.
  - `GET /api/v1/questions/`: Lấy danh sách câu hỏi có lọc theo môn, lớp, độ khó, trạng thái.
  - `GET /api/v1/questions/{id}`: Xem chi tiết câu hỏi và đáp án.
  - `PUT /api/v1/questions/{id}`: Cập nhật câu hỏi.
  - `DELETE /api/v1/questions/{id}`: Xóa câu hỏi.
  - `POST /api/v1/questions/{id}/status`: Đổi trạng thái kiểm duyệt (DRAFT -> REVIEW -> APPROVED / REJECTED).
  - `POST /api/v1/questions/import-word`: Import hàng loạt câu hỏi từ file Word.
- **Giao diện Người dùng (Frontend Next.js)**:
  - Màn hình Quản lý Ngân hàng câu hỏi (`/questions`): Danh sách, bộ lọc, tạo mới, chỉnh sửa, xem chi tiết, đổi trạng thái duyệt.
  - Màn hình Import Word (`/questions/import`): Tải lên file Word, xem trước kết quả parse và xác nhận lưu.

---

## Files Changed

- `backend/app/models/question.py`
- `backend/app/schemas/question.py`
- `backend/app/services/word_importer.py`
- `backend/app/api/v1/questions.py`
- `backend/tests/test_questions.py`
- `backend/tests/test_word_importer.py`
- `frontend/src/app/questions/page.tsx`
- `frontend/src/app/questions/import/page.tsx`
- `docs/phase-reports/phase-3.md`

---

## Tests

- `tests/test_questions.py`: 8 tests CRUD, RBAC, approval pipeline.
- `tests/test_word_importer.py`: 4 tests parse Word format, valid answer extraction, error handling.

---

## Test Result

**PASS**

---

## Known Issues

- Không.

---

## Next Phase

**Phase 4 — Gemini AI Question Generation Engine**
