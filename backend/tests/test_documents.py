import os
import io
import pytest
from app.models.document import DocumentStatus, DocumentType


SAMPLE_DOC_TEXT = """
CHƯƠNG 2: PHƯƠNG TRÌNH VÀ HỆ PHƯƠNG TRÌNH

BÀI 1: PHƯƠNG TRÌNH BẬC NHẤT HAI ẨN

I. Khái niệm phương trình bậc nhất hai ẩn
Khái niệm: Phương trình dạng ax + by = c (với a và b không đồng thời bằng 0) gọi là phương trình bậc nhất hai ẩn.
Mục tiêu: Học sinh nhận biết được phương trình bậc nhất hai ẩn và nghiệm của nó.

II. Biểu diễn tập nghiệm
Định lí: Tập nghiệm của phương trình ax + by = c được biểu diễn bằng đường thẳng trong mặt phẳng tọa độ Oxy.
Ghi nhớ: Đường thẳng này có phương trình tổng quát ax + by - c = 0.
"""


def test_upload_document_teacher_success(client, teacher_headers):
    file_content = SAMPLE_DOC_TEXT.encode("utf-8")
    files = {
        "file": ("toan_10.txt", io.BytesIO(file_content), "text/plain"),
    }
    data = {
        "title": "SGK Toán 10 - Chương 2",
        "subject": "Toán học",
        "grade": "10",
        "book_series": "Chân trời sáng tạo",
    }

    res = client.post(
        "/api/v1/documents/upload",
        files=files,
        data=data,
        headers=teacher_headers,
    )
    assert res.status_code == 201
    json_data = res.json()
    assert json_data["id"] is not None
    assert json_data["title"] == "SGK Toán 10 - Chương 2"
    assert json_data["status"] in [DocumentStatus.PENDING, DocumentStatus.COMPLETED]
    # Background task finishes processing in TestClient
    res_get = client.get(f"/api/v1/documents/{json_data['id']}", headers=teacher_headers)
    assert res_get.status_code == 200
    doc_data = res_get.json()
    assert doc_data["status"] == DocumentStatus.COMPLETED
    assert doc_data["chunk_count"] > 0
    assert doc_data["extracted_metadata"] is not None
    assert doc_data["extracted_metadata"]["total_chapters"] >= 1


def test_upload_document_student_forbidden(client, student_headers):
    file_content = b"Simple document text"
    files = {
        "file": ("doc.txt", io.BytesIO(file_content), "text/plain"),
    }
    data = {
        "title": "Tài liệu học sinh",
        "subject": "Toán",
        "grade": "10",
    }

    res = client.post(
        "/api/v1/documents/upload",
        files=files,
        data=data,
        headers=student_headers,
    )
    assert res.status_code == 403
    assert "TEACHER or ADMIN" in res.json()["detail"]


def test_list_and_filter_documents(client, teacher_headers):
    # Upload first doc
    client.post(
        "/api/v1/documents/upload",
        files={"file": ("toan.txt", io.BytesIO(SAMPLE_DOC_TEXT.encode("utf-8")), "text/plain")},
        data={"title": "Toán Học Lớp 10", "subject": "Toán học", "grade": "10"},
        headers=teacher_headers,
    )

    # Upload second doc
    client.post(
        "/api/v1/documents/upload",
        files={"file": ("ly.txt", io.BytesIO(SAMPLE_DOC_TEXT.encode("utf-8")), "text/plain")},
        data={"title": "Vật lí Lớp 11", "subject": "Vật lí", "grade": "11"},
        headers=teacher_headers,
    )

    # List all
    res = client.get("/api/v1/documents/", headers=teacher_headers)
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) >= 2

    # Filter by subject
    res_toan = client.get("/api/v1/documents/?subject=Toán", headers=teacher_headers)
    assert res_toan.status_code == 200
    assert all("Toán" in d["subject"] for d in res_toan.json())

    # Filter by grade
    res_grade11 = client.get("/api/v1/documents/?grade=11", headers=teacher_headers)
    assert res_grade11.status_code == 200
    assert all(d["grade"] == 11 for d in res_grade11.json())


def test_get_document_chunks_and_search(client, teacher_headers):
    res_upload = client.post(
        "/api/v1/documents/upload",
        files={"file": ("toan_chunks.txt", io.BytesIO(SAMPLE_DOC_TEXT.encode("utf-8")), "text/plain")},
        data={"title": "Toán Chunks Test", "subject": "Toán", "grade": "10"},
        headers=teacher_headers,
    )
    doc_id = res_upload.json()["id"]

    # Get chunks
    res_chunks = client.get(f"/api/v1/documents/{doc_id}/chunks", headers=teacher_headers)
    assert res_chunks.status_code == 200
    chunk_data = res_chunks.json()
    assert chunk_data["total"] > 0
    assert len(chunk_data["items"]) > 0

    first = chunk_data["items"][0]
    assert first["document_id"] == doc_id
    assert first["char_count"] > 0

    # Search in chunks
    res_search = client.get(f"/api/v1/documents/{doc_id}/chunks?search=phương+trình", headers=teacher_headers)
    assert res_search.status_code == 200
    assert res_search.json()["total"] > 0


def test_get_document_knowledge_map(client, teacher_headers):
    res_upload = client.post(
        "/api/v1/documents/upload",
        files={"file": ("toan_km.txt", io.BytesIO(SAMPLE_DOC_TEXT.encode("utf-8")), "text/plain")},
        data={"title": "Toán KM Test", "subject": "Toán học", "grade": "10", "book_series": "Cánh Diều"},
        headers=teacher_headers,
    )
    doc_id = res_upload.json()["id"]

    res_km = client.get(f"/api/v1/documents/{doc_id}/knowledge-map", headers=teacher_headers)
    assert res_km.status_code == 200
    km_data = res_km.json()
    assert km_data["document_id"] == doc_id
    assert len(km_data["tree"]) > 0

    # Verify root is SUBJECT
    root = km_data["tree"][0]
    assert root["node_type"] == "SUBJECT"
    assert root["title"] == "Toán học"

    # Child is GRADE
    grade_node = root["children"][0]
    assert grade_node["node_type"] == "GRADE"
    assert "10" in grade_node["title"]

    # Child is BOOK
    book_node = grade_node["children"][0]
    assert book_node["node_type"] == "BOOK"
    assert "Cánh Diều" in book_node["title"]

    # Child is CHAPTER
    chapter_node = book_node["children"][0]
    assert chapter_node["node_type"] == "CHAPTER"
    assert "Chương 2" in chapter_node["title"]


def test_document_overview_knowledge_map(client, teacher_headers):
    res = client.get("/api/v1/documents/knowledge-map/overview", headers=teacher_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_retry_failed_document_flow(client, teacher_headers, db):
    # Upload document
    res_upload = client.post(
        "/api/v1/documents/upload",
        files={"file": ("toan_retry.txt", io.BytesIO(SAMPLE_DOC_TEXT.encode("utf-8")), "text/plain")},
        data={"title": "Toán Retry Test", "subject": "Toán", "grade": "10"},
        headers=teacher_headers,
    )
    doc_id = res_upload.json()["id"]

    # Manually simulate a failure state
    from app.models.document import Document
    doc = db.query(Document).filter(Document.id == doc_id).first()
    doc.status = DocumentStatus.FAILED
    doc.error_message = "Mô phỏng sự cố mạng trong quá trình xử lý"
    db.commit()

    # Verify status is FAILED
    res_get = client.get(f"/api/v1/documents/{doc_id}", headers=teacher_headers)
    assert res_get.json()["status"] == DocumentStatus.FAILED
    assert "Mô phỏng sự cố" in res_get.json()["error_message"]

    # Call Retry endpoint
    res_retry = client.post(f"/api/v1/documents/{doc_id}/retry", headers=teacher_headers)
    assert res_retry.status_code == 200
    assert res_retry.json()["status"] in [DocumentStatus.PENDING, DocumentStatus.COMPLETED]
    # Background task completes processing in TestClient
    res_get_after = client.get(f"/api/v1/documents/{doc_id}", headers=teacher_headers)
    assert res_get_after.json()["status"] == DocumentStatus.COMPLETED
    assert res_get_after.json()["error_message"] is None


def test_delete_document_cascade(client, teacher_headers):
    res_upload = client.post(
        "/api/v1/documents/upload",
        files={"file": ("toan_del.txt", io.BytesIO(SAMPLE_DOC_TEXT.encode("utf-8")), "text/plain")},
        data={"title": "Toán Delete Test", "subject": "Toán", "grade": "10"},
        headers=teacher_headers,
    )
    doc_id = res_upload.json()["id"]

    # Delete
    res_del = client.delete(f"/api/v1/documents/{doc_id}", headers=teacher_headers)
    assert res_del.status_code == 200

    # Verify 404
    res_get = client.get(f"/api/v1/documents/{doc_id}", headers=teacher_headers)
    assert res_get.status_code == 404
