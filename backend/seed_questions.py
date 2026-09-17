from app.core.database import SessionLocal
from app.models.question import (
    Question,
    QuestionOption,
    QuestionType,
    QuestionDifficulty,
    QuestionStatus,
    QuestionSource,
)

db = SessionLocal()
existing_count = db.query(Question).count()

if existing_count == 0:
    samples = [
        {
            "content": "Tìm số tự nhiên x biết: 125 + x = 300",
            "subject": "Toán",
            "grade": 4,
            "diff": QuestionDifficulty.EASY,
            "status": QuestionStatus.APPROVED,
            "chapter": "Chương 1: Số tự nhiên",
            "lesson": "Bài 5: Tìm x",
            "expl": "x = 300 - 125 = 175. Chọn B.",
            "opts": [
                ("A", "x = 165", False),
                ("B", "x = 175", True),
                ("C", "x = 185", False),
                ("D", "x = 425", False),
            ],
        },
        {
            "content": "Trong câu: 'Những đóa hoa cúc nở rực rỡ dưới nắng mai', từ 'rực rỡ' thuộc từ loại nào?",
            "subject": "Tiếng Việt",
            "grade": 4,
            "diff": QuestionDifficulty.MEDIUM,
            "status": QuestionStatus.REVIEW,
            "chapter": "Chủ đề: Từ và câu",
            "lesson": "Bài: Tính từ",
            "expl": "'Rực rỡ' là tính từ chỉ màu sắc, vẻ tươi sáng nổi bật.",
            "opts": [
                ("A", "Danh từ", False),
                ("B", "Động từ", False),
                ("C", "Tính từ", True),
                ("D", "Đại từ", False),
            ],
        },
        {
            "content": "Diện tích của hình chữ nhật có chiều dài 12 cm và chiều rộng 7 cm là:",
            "subject": "Toán",
            "grade": 5,
            "diff": QuestionDifficulty.EASY,
            "status": QuestionStatus.APPROVED,
            "chapter": "Chương: Hình học",
            "lesson": "Bài: Diện tích hình chữ nhật",
            "expl": "S = a x b = 12 x 7 = 84 cm².",
            "opts": [
                ("A", "84 cm²", True),
                ("B", "38 cm²", False),
                ("C", "19 cm²", False),
                ("D", "94 cm²", False),
            ],
        },
        {
            "content": "Cặp quan hệ từ trong câu: 'Tuy trời mưa to nhưng Nam vẫn đến lớp đúng giờ' biểu thị mối quan hệ gì?",
            "subject": "Tiếng Việt",
            "grade": 5,
            "diff": QuestionDifficulty.MEDIUM,
            "status": QuestionStatus.APPROVED,
            "chapter": "Ngữ pháp",
            "lesson": "Bài: Cặp quan hệ từ",
            "expl": "Cặp 'Tuy... nhưng...' biểu thị quan hệ tương phản đối lập.",
            "opts": [
                ("A", "Nguyên nhân - kết quả", False),
                ("B", "Tương phản", True),
                ("C", "Điều kiện - kết quả", False),
                ("D", "Tăng tiến", False),
            ],
        },
        {
            "content": "Tập hợp các ước tự nhiên của số 12 là:",
            "subject": "Toán",
            "grade": 6,
            "diff": QuestionDifficulty.MEDIUM,
            "status": QuestionStatus.APPROVED,
            "chapter": "Chương 1: Số tự nhiên",
            "lesson": "Ước và bội",
            "expl": "Các ước tự nhiên của 12 là 1, 2, 3, 4, 6, 12.",
            "opts": [
                ("A", "{1; 2; 3; 4; 6; 12}", True),
                ("B", "{0; 1; 2; 3; 4; 6; 12}", False),
                ("C", "{2; 3; 4; 6}", False),
                ("D", "{1; 2; 4; 6; 12}", False),
            ],
        },
        {
            "content": "Đơn vị đo khối lượng trong hệ đo lường quốc tế (SI) là gì?",
            "subject": "Khoa học",
            "grade": 6,
            "diff": QuestionDifficulty.EASY,
            "status": QuestionStatus.REVIEW,
            "chapter": "Chương 1: Mở đầu",
            "lesson": "Đo lường",
            "expl": "Trong hệ SI, đơn vị cơ bản đo khối lượng là kilôgam (kg).",
            "opts": [
                ("A", "Gam (g)", False),
                ("B", "Kilôgam (kg)", True),
                ("C", "Tấn (t)", False),
                ("D", "Miligam (mg)", False),
            ],
        },
        {
            "content": "Số nào sau đây là số vô tỉ?",
            "subject": "Toán",
            "grade": 7,
            "diff": QuestionDifficulty.HARD,
            "status": QuestionStatus.REVIEW,
            "chapter": "Chương: Số thực",
            "lesson": "Số vô tỉ",
            "expl": "√2 = 1.4142135... là số thập phân vô hạn không tuần hoàn.",
            "opts": [
                ("A", "0,5", False),
                ("B", "2/3", False),
                ("C", "√2", True),
                ("D", "√4", False),
            ],
        },
        {
            "content": "Khai triển của hằng đẳng thức (a + b)² là:",
            "subject": "Toán",
            "grade": 8,
            "diff": QuestionDifficulty.MEDIUM,
            "status": QuestionStatus.APPROVED,
            "chapter": "Chương: Hằng đẳng thức",
            "lesson": "Những hằng đẳng thức đáng nhớ",
            "expl": "(a + b)² = a² + 2ab + b².",
            "opts": [
                ("A", "a² + b²", False),
                ("B", "a² + 2ab + b²", True),
                ("C", "a² - 2ab + b²", False),
                ("D", "a² + ab + b²", False),
            ],
        },
        {
            "content": "Nghiệm của hệ phương trình: { 2x + y = 5; x - y = 1 } là:",
            "subject": "Toán",
            "grade": 9,
            "diff": QuestionDifficulty.HARD,
            "status": QuestionStatus.APPROVED,
            "chapter": "Hệ phương trình bậc nhất hai ẩn",
            "lesson": "Giải hệ phương trình bằng phương pháp cộng đại số",
            "expl": "Cộng 2 vế được 3x = 6 => x = 2, suy ra y = 1. Chọn A.",
            "opts": [
                ("A", "(x = 2; y = 1)", True),
                ("B", "(x = 1; y = 2)", False),
                ("C", "(x = 3; y = 2)", False),
                ("D", "(x = 2; y = 3)", False),
            ],
        },
    ]

    for s in samples:
        q = Question(
            content=s["content"],
            question_type=QuestionType.MULTIPLE_CHOICE_SINGLE,
            difficulty=s["diff"],
            status=s["status"],
            source=QuestionSource.MANUAL,
            subject=s["subject"],
            grade=s["grade"],
            chapter=s.get("chapter"),
            lesson=s.get("lesson"),
            explanation=s.get("expl"),
            created_by_id=3,
        )
        db.add(q)
        db.flush()
        for idx, (k, txt, corr) in enumerate(s["opts"]):
            db.add(
                QuestionOption(
                    question_id=q.id,
                    option_key=k,
                    content=txt,
                    is_correct=corr,
                    order_index=idx,
                )
            )

    db.commit()
    print(f"Successfully seeded {len(samples)} realistic questions for grades 4-9!")
else:
    print(f"Questions table already has {existing_count} records.")

db.close()
