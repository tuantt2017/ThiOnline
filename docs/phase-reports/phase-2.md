# Phase 2 Report — Document Knowledge

## Implemented

- **Mô hình Dữ liệu & Hệ thống Migrations**:
  - Thiết kế và triển khai 3 thực thể cốt lõi trong `backend/app/models/document.py`:
    - `Document`: Quản lý tài liệu SGK, thông tin môn học, khối lớp, bộ sách, trạng thái xử lý (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), thông điệp lỗi, số trang, số chunk và metadata tổng hợp.
    - `DocumentChunk`: Quản lý từng đoạn văn bản đã phân đoạn (~1.000 ký tự) gắn chặt với vị trí số trang, chương, bài, chủ đề, khái niệm, mục tiêu học tập.
    - `KnowledgeNode`: Lưu trữ cây phân cấp tri thức 8 cấp độ có quan hệ cha-con (`parent_id`) và thứ tự sắp xếp (`order_index`).
  - Tạo và chạy migration Alembic `2ff49b90f2c8_create_documents_and_knowledge_tables` trên database.
- **Pipeline Phân tích cú pháp Đa định dạng (Parsers)**:
  - `PDFParser`: Sử dụng thư viện `pymupdf` trích xuất nội dung từng trang, phát hiện tiêu đề khối và giữ nguyên số trang thực tế.
  - `DOCXParser`: Sử dụng `python-docx` trích xuất văn bản, bảng biểu và cấu trúc phân cấp Heading.
  - `TXTParser`: Bộ giải mã văn bản tiếng Việt đa bảng mã (`utf-8`, `utf-8-sig`, `cp1258`, `latin-1`).
  - Bộ kiểm soát ngoại lệ: Phát hiện tệp rỗng, tệp hỏng, tệp có mật khẩu và xử lý an toàn không gây crash máy chủ.
- **Trích xuất Cấu trúc & Phân đoạn Ngữ nghĩa (StructureExtractor & Chunking)**:
  - Bộ nhận diện regex mẫu SGK Việt Nam: Chương, Bài, Chủ đề (I, II, 1, 2, ...), Khái niệm/Định nghĩa, và Mục tiêu cần đạt / Yêu cầu cần đạt.
  - Bộ phân đoạn thông minh bảo toàn ranh giới câu (Sentence-boundary aware) với độ dài chuẩn ~1.000 ký tự và sliding overlap 100 ký tự.
  - Tự động sinh cây Knowledge Map 8 cấp độ theo đúng đặc tả kỹ thuật:
    $$\text{Subject} \rightarrow \text{Grade} \rightarrow \text{Book} \rightarrow \text{Chapter} \rightarrow \text{Lesson} \rightarrow \text{Topic} \rightarrow \text{Concept} \rightarrow \text{Learning Objective}$$
- **Quản lý Vòng đời Trạng thái & Phục hồi Lỗi (Failure Handling & Retry)**:
  - Theo dõi trạng thái tệp: `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED` / `FAILED`.
  - Bắt lỗi chi tiết, ghi nhận `error_message` vào cơ sở dữ liệu.
  - Cung cấp API `POST /api/v1/documents/{id}/retry` giúp Giáo viên kích hoạt xử lý lại tài liệu khi gặp sự cố mà không cần tải lên lại từ đầu.
- **Bộ API Endpoints chuẩn RESTful (`/api/v1/documents`)**:
  - `POST /api/v1/documents/upload`: Tải lên tài liệu kèm phân quyền `TEACHER` hoặc `ADMIN`.
  - `GET /api/v1/documents/`: Lấy danh sách tài liệu, hỗ trợ lọc theo môn học, khối lớp, trạng thái.
  - `GET /api/v1/documents/{id}`: Xem chi tiết tài liệu kèm số liệu thống kê.
  - `GET /api/v1/documents/{id}/chunks`: Xem danh sách phân đoạn (có phân trang, lọc theo chương, tìm kiếm toàn văn).
  - `GET /api/v1/documents/{id}/knowledge-map`: Lấy cây Knowledge Map 8 cấp độ dạng lồng nhau (nested tree).
  - `GET /api/v1/documents/knowledge-map/overview`: Lấy bản đồ tri thức tổng hợp toàn bộ hệ thống.
  - `POST /api/v1/documents/{id}/retry`: Thử lại tài liệu bị lỗi.
  - `DELETE /api/v1/documents/{id}`: Xóa tài liệu cùng cascade sạch sẽ dữ liệu liên quan trong DB và file vật lý.
- **Giao diện Người dùng (Frontend Next.js)**:
  - **Trang Quản lý Tài liệu (`/documents`)**:
    - Khu vực tải lên hỗ trợ kéo thả tệp với kiểm tra định dạng và dung lượng (tối đa 50MB).
    - Bộ lọc đa tiêu chí (Môn học, Khối lớp, Trạng thái, Từ khóa).
    - Thẻ tài liệu hiện đại hiển thị huy hiệu trạng thái sống động (`COMPLETED`, `PROCESSING`, `FAILED`).
    - Khối cảnh báo lỗi rõ ràng kèm nút "Thử lại (Retry)" khi tài liệu bị lỗi.
  - **Trang Chi tiết Tài liệu & Phân đoạn (`/documents/[id]`)**:
    - Thống kê toàn diện: Tổng số trang, số chunk, số chương, bài học, khái niệm, mục tiêu học tập.
    - Trình duyệt danh sách chunk kèm tìm kiếm từ khóa, số trang và nhãn ngữ cảnh.
  - **Trình duyệt Bản đồ Tri thức Tương tác (`/knowledge-map`)**:
    - Trực quan hóa cây tri thức 8 cấp độ bằng các màu sắc và đường dẫn trực quan.
    - Cho phép Mở rộng / Thu gọn linh hoạt ở từng nút hoặc toàn bộ cây (Expand All / Collapse All).
    - Hỗ trợ chọn tài liệu hoặc xem qua tham số URL (`?doc=id`).
    - Bộ lọc tìm kiếm làm nổi bật (highlight) các khái niệm và mục tiêu cần đạt.
  - **Cập nhật Navbar**:
    - Tích hợp menu truy cập nhanh "Tài liệu SGK" và "Bản đồ Tri thức".

---

## Files Changed

- `docs/IMPLEMENTATION_PLAN.md`
- `docs/phase-reports/phase-2.md`
- **Backend**:
  - `backend/app/models/document.py` (Mô hình Document, DocumentChunk, KnowledgeNode)
  - `backend/app/models/__init__.py` (Xuất các model mới)
  - `backend/alembic/versions/2ff49b90f2c8_create_documents_and_knowledge_tables.py` (Migration Alembic)
  - `backend/app/services/parser.py` (PDFParser, DOCXParser, TXTParser)
  - `backend/app/services/extractor.py` (StructureExtractor & Chunker)
  - `backend/app/services/document_service.py` (Điều phối DocumentService)
  - `backend/app/schemas/document.py` (Pydantic schemas)
  - `backend/app/api/v1/documents.py` (Document & Knowledge Map Router)
  - `backend/app/api/v1/router.py` (Đăng ký router)
  - `backend/tests/conftest.py` (Bổ sung fixture teacher_user, teacher_headers)
  - `backend/tests/test_parsers.py` (Unit tests cho parsers và trích xuất tri thức)
  - `backend/tests/test_documents.py` (Integration tests cho toàn bộ API documents)
- **Frontend**:
  - `frontend/src/types/index.ts` (Bổ sung types Document, DocumentChunk, KnowledgeNode, ...)
  - `frontend/src/lib/api.ts` (Bổ sung các phương thức gọi API documents)
  - `frontend/src/components/Navbar.tsx` (Menu điều hướng mới)
  - `frontend/src/app/documents/page.tsx` (Trang quản lý tài liệu)
  - `frontend/src/app/documents/[id]/page.tsx` (Trang chi tiết tài liệu và chunks)
  - `frontend/src/app/knowledge-map/page.tsx` (Trang Bản đồ Tri thức tương tác)

---

## Tests

- Chạy bộ kiểm thử tự động Pytest (29 tests):
  - `tests/test_auth.py` (11 tests xác thực, đăng ký, đăng nhập, seed) — PASS
  - `tests/test_users.py` (5 tests phân quyền admin, user management) — PASS
  - `tests/test_parsers.py` (5 tests parser PDF, DOCX, TXT, kiểm tra lỗi và trích xuất 8 cấp độ Knowledge Map) — PASS
  - `tests/test_documents.py` (8 tests API upload, RBAC 403 học sinh, danh sách, lọc, chunks, knowledge map, retry khi lỗi, xóa cascade) — PASS
- Chạy kiểm tra TypeScript và Production Build Frontend:
  - `npm run build` — PASS (0 TypeScript errors, 10 static/dynamic routes biên dịch thành công).

---

## Test Result

**PASS (100% 29/29 backend tests pass, frontend build pass)**

---

## Known Issues

- Không có vấn đề tồn đọng nào.

---

## Architecture Decisions

- Sử dụng cấu trúc phân đoạn văn bản thông minh (Sentence-boundary aware chunking) thay vì ngắt đoạn cố định theo số ký tự để tránh việc cắt đứt các công thức toán học hoặc định nghĩa khái niệm giữa chừng.
- Lưu trữ cấu trúc Knowledge Map dưới dạng thực thể quan hệ `KnowledgeNode` có `parent_id` và `order_index` trong cơ sở dữ liệu, cho phép truy vấn đệ quy nhanh chóng, đồng thời hỗ trợ xuất cây JSON phân tầng phục vụ trực quan hoá trên giao diện và làm Grounding Source cho AI ở Phase 4 & Phase 6.

---

## Next Phase

**Phase 3 — Question Bank** (Quản lý ngân hàng câu hỏi, vòng đời câu hỏi DRAFT/REVIEW/APPROVED/REJECTED, bộ phân tích cú pháp Import đề từ file Word .docx theo format chuẩn, và phân quyền kiểm duyệt câu hỏi).
