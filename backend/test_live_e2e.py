import urllib.request
import json

def post(url, data, token=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def get(url, token=None):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

if __name__ == "__main__":
    # 1. Login teacher
    t_login = post("http://127.0.0.1:8000/api/v1/auth/login", {"email": "teacher@example.com", "password": "Teacher@123"})
    t_token = t_login["access_token"]
    print("[1] Teacher login: OK")

    # 2. Create question
    new_q = post("http://127.0.0.1:8000/api/v1/questions/", {
        "content": "E2E Live Test: Số nguyên tố chẵn duy nhất là số nào?",
        "subject": "Toán",
        "grade": 6,
        "difficulty": "EASY",
        "status": "REVIEW",
        "explanation": "Số 2 là số nguyên tố chẵn duy nhất.",
        "options": [
            {"option_key": "A", "content": "0", "is_correct": False, "order_index": 0},
            {"option_key": "B", "content": "2", "is_correct": True, "order_index": 1},
            {"option_key": "C", "content": "4", "is_correct": False, "order_index": 2},
            {"option_key": "D", "content": "6", "is_correct": False, "order_index": 3}
        ]
    }, t_token)
    q_id = new_q["id"]
    print(f"[2] Created Question ID: {q_id}, Status: {new_q['status']}")

    # 3. Teacher approves question
    approved = post(f"http://127.0.0.1:8000/api/v1/questions/{q_id}/status", {"status": "APPROVED"}, t_token)
    print(f"[3] Approved Question Status: {approved['status']}")

    # 4. Student login and verify visibility
    s_login = post("http://127.0.0.1:8000/api/v1/auth/login", {"email": "student@example.com", "password": "Student@123"})
    s_token = s_login["access_token"]
    s_view = get(f"http://127.0.0.1:8000/api/v1/questions/{q_id}", s_token)
    print(f"[4] Student viewed approved question ID {s_view['id']}: OK")

    # 5. Clean up
    req_del = urllib.request.Request(f"http://127.0.0.1:8000/api/v1/questions/{q_id}", headers={"Authorization": f"Bearer {t_token}"})
    req_del.get_method = lambda: "DELETE"
    with urllib.request.urlopen(req_del) as resp:
        pass
    print(f"[5] Cleaned up Question ID: {q_id}: OK")
    print("=== ALL LIVE API CHECKS PASSED ===")

