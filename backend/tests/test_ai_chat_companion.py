import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk, DocumentStatus, DocumentType
from app.models.user import User


def test_ai_chat_companion_success(client: TestClient, db: Session, student_user: User, student_headers: dict):
    # Setup test document and chunk in DB
    doc = Document(
        title="Sách Giáo Khoa Toán Lớp 5 (Tập 1)",
        filename="toan5.pdf",
        file_path="/tmp/toan5.pdf",
        file_type=DocumentType.PDF,
        file_size=1024,
        subject="Toán",
        grade=5,
        status=DocumentStatus.COMPLETED,
        uploaded_by_id=student_user.id,
    )
    db.add(doc)
    db.flush()

    chunk = DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content="Quy tắc số thập phân: Để cộng hai số thập phân, ta viết số hạng này dưới số hạng kia sao cho các chữ số ở cùng một hàng đặt thẳng cột với nhau.",
        char_count=150,
        page_number=45,
        chapter="Chương 2: Số Thập Phân",
        lesson="Bài 21: Cộng hai số thập phân",
        topic="Khái niệm và quy tắc cộng",
    )
    db.add(chunk)
    db.commit()

    payload = {
        "message": "Em chưa hiểu quy tắc cộng hai số thập phân, nhờ AI giải thích?",
        "subject": "Toán",
        "grade": 5,
        "conversation_history": []
    }

    response = client.post("/api/v1/ai/chat", json=payload, headers=student_headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert "reply" in data
    assert data["subject"] == "Toán"
    assert data["grade"] == 5
    assert len(data["citations"]) > 0
    assert len(data["suggested_followups"]) > 0

    first_citation = data["citations"][0]
    assert "document_title" in first_citation
    assert "chapter" in first_citation
    assert "lesson" in first_citation


def test_ai_chat_companion_unauthenticated_fails(client: TestClient):
    payload = {
        "message": "Xin chào AI",
        "subject": "Toán",
        "grade": 5
    }
    response = client.post("/api/v1/ai/chat", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
