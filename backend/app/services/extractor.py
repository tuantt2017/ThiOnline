import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set
from app.models.document import KnowledgeNodeType
from app.services.parser import ParsedDocument, ParsedPage


@dataclass
class ExtractedChunk:
    chunk_index: int
    content: str
    char_count: int
    page_number: Optional[int]
    chapter: Optional[str]
    lesson: Optional[str]
    topic: Optional[str]
    concept: Optional[str]
    learning_objective: Optional[str]
    chunk_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExtractedNode:
    node_type: KnowledgeNodeType
    title: str
    description: Optional[str] = None
    order_index: int = 0
    properties: Dict[str, Any] = field(default_factory=dict)
    children: List["ExtractedNode"] = field(default_factory=list)


@dataclass
class ExtractionResult:
    chunks: List[ExtractedChunk]
    root_nodes: List[ExtractedNode]
    summary_metadata: Dict[str, Any]


RE_CHAPTER = re.compile(
    r"^(?:CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|CHAPTER|Chapter|THEME|Theme|MODULE|Module|BOOK\s*MAP|Book\s*map)\s*(\d+|(?:[IVXLCDM]+(?![a-z])))?\s*[:.-–]?\s*(.*?)$",
    re.IGNORECASE,
)
RE_LESSON = re.compile(
    r"^(?:Tuần\s+\d+\s*[-–:]\s*)?(?:BÀI|Bài|TIẾT|Tiết|TUẦN|Tuần|LESSON|Lesson|UNIT|Unit|REVIEW|Review|STARTER|Starter)\s*(\d+|(?:[IVXLCDM]+(?![a-z])))?\s*[:.-–]?\s*(.*?)$",
    re.IGNORECASE,
)

RE_TOPIC = re.compile(
    r"^(?:[I|V|X|L|C|D|M]+\.|\d+\.|\bUnit\s+\d+|\bLesson\s+\d+|\bReview\s+\d+|\bListening|\bSpeaking|\bReading|\bWriting|\bLanguage Focus|\bKhám phá|\bHoạt động|\bLuyện tập|\bVận dụng|\bTrọng tâm|\bKiến thức)\s*(.*?)$",
    re.IGNORECASE,
)
RE_CONCEPT_KEYWORD = re.compile(
    r"(?:Định nghĩa|Khái niệm|Định lí|Ghi nhớ|Tính chất|Công thức|Quy tắc|Chú ý|Vocabulary|Structures|Structure|Grammar|Phonics|Pronunciation|Sentence Patterns|Target Words|Key Terms|Words)[:.]?\s*([^.\n]+)",
    re.IGNORECASE,
)
RE_OBJECTIVE_KEYWORD = re.compile(
    r"(?:Mục tiêu|Sau bài học này|Yêu cầu cần đạt|Học sinh có thể|Kiến thức cần nắm|Em học được|Competences|Competence|Learning Objectives|Objectives|Can do|Students will be able to|Goal)[:.]?\s*([^.\n]+)",
    re.IGNORECASE,
)
# Vietnamese sentence definition patterns like "X là ...", "X được gọi là ..."
RE_DEFINITION_SENTENCE = re.compile(
    r"([A-ZÀ-Ỹa-zà-ỹ0-9\s]{3,35})\s+(?:là|được gọi là|gọi là|có nghĩa là)\s+([^.\n]{10,120})",
    re.UNICODE,
)
# English sentence pattern matcher for structures like "Where are you from? - I'm from..."
RE_ENGLISH_STRUCTURE = re.compile(
    r"^(?:Where|What|When|Why|Who|How|Can|Do|Does|Is|Are|Were|Was|Have|Has|I|He|She|They|We|There)\b.*?[?.]",
    re.IGNORECASE,
)


class StructureExtractor:
    TARGET_CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 100

    def __init__(self, subject: str, grade: int, book_series: Optional[str] = None, title: Optional[str] = None):
        self.subject = subject.strip()
        self.grade = grade
        self.book_series = (book_series or "Sách Giáo Khoa chuẩn GDPT").strip()
        self.doc_title = (title or f"{self.subject} Lớp {self.grade}").strip()

    def extract(self, parsed_doc: ParsedDocument) -> ExtractionResult:
        """Extract semantic chunks and 8-level Knowledge Map with real pedagogical content."""
        chunks: List[ExtractedChunk] = []

        # Context state across pages
        current_chapter: Optional[str] = None
        current_lesson: Optional[str] = None
        current_topic: Optional[str] = None

        # Hierarchy dictionary: chapter -> lesson -> topic -> {concepts, objectives, pages, summaries}
        hierarchy: Dict[str, Dict[str, Any]] = {}
        chunk_counter = 0

        # Scan all pages
        for page_idx, page in enumerate(parsed_doc.pages):
            page_text = page.text
            if not page_text.strip():
                continue

            lines = [l.strip() for l in page_text.splitlines() if l.strip()]
            page_concepts: Set[str] = set()
            page_objectives: Set[str] = set()

            # Multi-line header lookahead scanner
            i = 0
            while i < len(lines):
                line = lines[i]
                next_line = lines[i + 1] if i + 1 < len(lines) else ""

                # 1. Check Chapter / Theme marker
                m_chap = RE_CHAPTER.match(line)
                if m_chap:
                    # Flush previous lesson if active
                    if current_lesson:
                        self._register_lesson_in_hierarchy(
                            hierarchy, current_chapter, current_lesson, current_topic,
                            page.page_number, page_concepts, page_objectives
                        )
                        page_concepts = set()
                        page_objectives = set()

                    chap_num, chap_name = m_chap.groups()
                    chap_num_str = chap_num if chap_num else ""
                    chap_name = chap_name.strip() if chap_name else ""
                    # Check if chapter name is on next line
                    if not chap_name and next_line and len(next_line) < 80 and not RE_LESSON.match(next_line):
                        chap_name = next_line
                        i += 1
                    # Clean trailing page markers
                    chap_name = re.sub(r"\s+Pages?\s+\d+.*$", "", chap_name, flags=re.IGNORECASE).strip()
                    chap_prefix = "Chương"
                    if any(w in line.lower() for w in ["chủ đề", "theme", "book map", "bookmap"]):
                        chap_prefix = "Chủ đề"
                    elif "phần" in line.lower():
                        chap_prefix = "Phần"

                    if chap_num_str:
                        current_chapter = f"{chap_prefix} {chap_num_str}: {chap_name}".strip(": ")
                    else:
                        current_chapter = f"{chap_prefix}: {chap_name}".strip(": ") if chap_name else f"{chap_prefix} trọng tâm"
                    current_lesson = None
                    current_topic = None
                    i += 1
                    continue

                # 1b. Check if line is an uppercase English Theme banner (e.g. "ME AND MY FRIENDS", "ME AND MY SCHOOL")
                if len(line) > 5 and len(line) < 60 and line.isupper() and not any(c in line for c in [".", "?", "!", ",", ":"]) and not line.startswith(("PAGE", "CHAPTER", "CHƯƠNG", "BÀI", "LESSON", "UNIT", "REVIEW")):
                    if current_lesson:
                        self._register_lesson_in_hierarchy(
                            hierarchy, current_chapter, current_lesson, current_topic,
                            page.page_number, page_concepts, page_objectives
                        )
                        page_concepts = set()
                        page_objectives = set()

                    current_chapter = f"Chủ đề: {line}"
                    current_lesson = None
                    current_topic = None
                    i += 1
                    continue

                # 2. Check Lesson / Unit marker
                m_les = RE_LESSON.match(line)
                if m_les:
                    # Flush previous lesson on same page if any
                    if current_lesson:
                        self._register_lesson_in_hierarchy(
                            hierarchy, current_chapter, current_lesson, current_topic,
                            page.page_number, page_concepts, page_objectives
                        )
                        page_concepts = set()
                        page_objectives = set()

                    les_num, les_name = m_les.groups()
                    les_num_str = les_num if les_num else ""
                    les_name = les_name.strip() if les_name else ""
                    # Check if lesson name is on next line
                    if not les_name and next_line and len(next_line) < 90 and not RE_TOPIC.match(next_line):
                        les_name = next_line
                        i += 1
                    # Clean trailing page numbers (e.g., "Page 10", "Pages 40 & 42")
                    les_name = re.sub(r"\s+Pages?\s+\d+.*$", "", les_name, flags=re.IGNORECASE).strip()
                    unit_prefix = "Unit" if "unit" in line.lower() else ("Review" if "review" in line.lower() else "Bài")
                    if les_num_str:
                        current_lesson = f"{unit_prefix} {les_num_str}: {les_name}".strip(": ")
                    else:
                        current_lesson = f"{unit_prefix}: {les_name}".strip(": ") if les_name else line
                    current_topic = None
                    i += 1
                    continue

                # 3. Check Topic / Section marker
                m_top = RE_TOPIC.match(line)
                if m_top and len(line) < 120:
                    current_topic = line.strip()
                    i += 1
                    continue

                # 4. Check Concept keywords
                m_con = RE_CONCEPT_KEYWORD.search(line)
                if m_con:
                    concept_val = m_con.group(1).strip()
                    if 3 < len(concept_val) < 120:
                        page_concepts.add(concept_val)

                # 5. Check Definition patterns
                m_def = RE_DEFINITION_SENTENCE.search(line)
                if m_def:
                    term, definition = m_def.groups()
                    term = term.strip()
                    if 3 < len(term) < 40 and not any(w in term.lower() for w in ["điều này", "đây", "nó", "chúng"]):
                        page_concepts.add(f"{term}: {definition[:80]}")

                # 6. Check Learning Objective keywords or English competence statements
                m_obj = RE_OBJECTIVE_KEYWORD.search(line)
                if m_obj:
                    obj_val = m_obj.group(1).strip()
                    if 5 < len(obj_val) < 150:
                        page_objectives.add(obj_val)
                elif line.lower().startswith(("asking and", "talking about", "asking for", "using ", "describing ")):
                    page_objectives.add(line.strip())

                # 7. Check English Sentence Structure patterns
                if RE_ENGLISH_STRUCTURE.match(line) and 10 < len(line) < 120:
                    page_concepts.add(f"Cấu trúc: {line.strip()}")

                # 8. Check English Vocabulary Lists (separated by commas)
                if "," in line and len(line.split(",")) >= 3 and len(line) < 200:
                    page_concepts.add(f"Từ vựng: {line.strip()}")

                i += 1

            # Register final lesson of page into hierarchy
            effective_chapter = current_chapter or f"Chương 1: Kiến thức trọng tâm {self.subject} Lớp {self.grade}"
            effective_lesson = current_lesson or f"Bài 1: Tổng quan nội dung học tập"
            effective_topic = current_topic or f"Trọng tâm kiến thức {effective_lesson}"

            self._register_lesson_in_hierarchy(
                hierarchy, effective_chapter, effective_lesson, effective_topic,
                page.page_number, page_concepts, page_objectives
            )

            # Slicing into semantic chunks
            page_chunks = self._chunk_text(
                text=page_text,
                page_number=page.page_number,
                chapter=effective_chapter,
                lesson=effective_lesson,
                topic=effective_topic,
                concept=list(page_concepts)[0] if page_concepts else None,
                learning_objective=list(page_objectives)[0] if page_objectives else None,
                start_index=chunk_counter,
            )
            chunks.extend(page_chunks)
            chunk_counter += len(page_chunks)

        # Build 8-level Knowledge Map Tree
        book_node = ExtractedNode(
            node_type=KnowledgeNodeType.BOOK,
            title=self.book_series,
            description=f"Bộ sách {self.book_series}",
            order_index=1,
            properties={"doc_title": self.doc_title},
        )

        grade_node = ExtractedNode(
            node_type=KnowledgeNodeType.GRADE,
            title=f"Lớp {self.grade}",
            description=f"Khối lớp {self.grade}",
            order_index=self.grade,
            children=[book_node],
        )

        subject_node = ExtractedNode(
            node_type=KnowledgeNodeType.SUBJECT,
            title=self.subject,
            description=f"Môn học {self.subject}",
            order_index=1,
            children=[grade_node],
        )

        chap_idx = 0
        total_concepts = 0
        total_objectives = 0

        for chap_title, chap_data in hierarchy.items():
            chap_idx += 1
            chap_node = ExtractedNode(
                node_type=KnowledgeNodeType.CHAPTER,
                title=chap_title,
                order_index=chap_idx,
            )
            book_node.children.append(chap_node)

            les_idx = 0
            for les_title, les_data in chap_data["lessons"].items():
                les_idx += 1
                les_node = ExtractedNode(
                    node_type=KnowledgeNodeType.LESSON,
                    title=les_title,
                    order_index=les_idx,
                )
                chap_node.children.append(les_node)

                top_idx = 0
                for top_title, top_data in les_data["topics"].items():
                    top_idx += 1
                    top_node = ExtractedNode(
                        node_type=KnowledgeNodeType.TOPIC,
                        title=top_title,
                        order_index=top_idx,
                        properties={"pages": sorted(list(top_data["pages"]))},
                    )
                    les_node.children.append(top_node)

                    # Real concepts under topic
                    con_idx = 0
                    concepts_list = list(top_data["concepts"])
                    clean_top = re.sub(r"^(?:Unit\s+\d+[:.]?|Lesson\s+\d+[:.]?|Bài\s+\d+[:.]?|\d+[:.]?|[IVXLCDM]+[:.])\s*", "", top_title, flags=re.IGNORECASE).strip()
                    if not concepts_list:
                        concepts_list = [
                            f"Định nghĩa và tính chất của {clean_top}",
                            f"Phương pháp giải và quy tắc áp dụng cho {clean_top}",
                        ]

                    for con_title in concepts_list[:5]:  # limit top 5 per topic
                        con_idx += 1
                        total_concepts += 1
                        con_node = ExtractedNode(
                            node_type=KnowledgeNodeType.CONCEPT,
                            title=con_title,
                            order_index=con_idx,
                        )
                        top_node.children.append(con_node)

                        # Real pedagogical learning objectives
                        obj_idx = 0
                        objectives_list = list(top_data["objectives"])
                        if not objectives_list:
                            objectives_list = [
                                f"Học sinh nắm vững khái niệm và vận dụng {clean_top} vào bài tập"
                            ]

                        for obj_title in objectives_list[:4]:  # limit top 4 per concept
                            obj_idx += 1
                            total_objectives += 1
                            obj_node = ExtractedNode(
                                node_type=KnowledgeNodeType.LEARNING_OBJECTIVE,
                                title=obj_title,
                                order_index=obj_idx,
                            )
                            con_node.children.append(obj_node)

        summary_metadata = {
            "ai_extracted": False,
            "total_pages": parsed_doc.total_pages,
            "total_chars": parsed_doc.total_chars,
            "total_chunks": len(chunks),
            "total_chapters": len(hierarchy),
            "total_lessons": sum(len(c["lessons"]) for c in hierarchy.values()),
            "total_topics": sum(
                sum(len(l["topics"]) for l in c["lessons"].values())
                for c in hierarchy.values()
            ),
            "total_concepts": total_concepts,
            "total_learning_objectives": total_objectives,
        }

        return ExtractionResult(
            chunks=chunks,
            root_nodes=[subject_node],
            summary_metadata=summary_metadata,
        )

    def _register_lesson_in_hierarchy(self, hierarchy, chapter, lesson, topic, page_num, concepts, objectives):
        eff_chap = chapter or f"Chương 1: Kiến thức trọng tâm {self.subject} Lớp {self.grade}"
        eff_les = lesson or f"Bài 1: Tổng quan nội dung học tập"
        eff_top = topic or f"Trọng tâm kiến thức {eff_les}"

        if eff_chap not in hierarchy:
            hierarchy[eff_chap] = {"title": eff_chap, "lessons": {}}
        if eff_les not in hierarchy[eff_chap]["lessons"]:
            hierarchy[eff_chap]["lessons"][eff_les] = {"title": eff_les, "topics": {}}

        les_entry = hierarchy[eff_chap]["lessons"][eff_les]
        if eff_top not in les_entry["topics"]:
            les_entry["topics"][eff_top] = {
                "title": eff_top,
                "concepts": set(),
                "objectives": set(),
                "pages": set(),
            }
        top_entry = les_entry["topics"][eff_top]
        top_entry["pages"].add(page_num)
        for c in concepts:
            top_entry["concepts"].add(c)
        for o in objectives:
            top_entry["objectives"].add(o)

    def _chunk_text(
        self,
        text: str,
        page_number: int,
        chapter: Optional[str],
        lesson: Optional[str],
        topic: Optional[str],
        concept: Optional[str],
        learning_objective: Optional[str],
        start_index: int,
    ) -> List[ExtractedChunk]:
        """Split text into chunks of target size with overlap while preserving sentence boundaries."""
        clean_text = re.sub(r"\s+", " ", text).strip()
        if not clean_text:
            return []

        chunks: List[ExtractedChunk] = []
        text_len = len(clean_text)

        if text_len <= self.TARGET_CHUNK_SIZE:
            chunks.append(
                ExtractedChunk(
                    chunk_index=start_index,
                    content=clean_text,
                    char_count=text_len,
                    page_number=page_number,
                    chapter=chapter,
                    lesson=lesson,
                    topic=topic,
                    concept=concept,
                    learning_objective=learning_objective,
                    chunk_metadata={"page": page_number},
                )
            )
            return chunks

        # Sentence-boundary aware splitting
        step = self.TARGET_CHUNK_SIZE - self.CHUNK_OVERLAP
        start = 0
        idx = start_index

        while start < text_len:
            end = min(start + self.TARGET_CHUNK_SIZE, text_len)

            if end < text_len:
                cut_candidate = clean_text.rfind(". ", start, end)
                if cut_candidate == -1:
                    cut_candidate = clean_text.rfind("? ", start, end)
                if cut_candidate == -1:
                    cut_candidate = clean_text.rfind("; ", start, end)
                if cut_candidate == -1:
                    cut_candidate = clean_text.rfind(" ", start, end)

                if cut_candidate > start + (self.TARGET_CHUNK_SIZE // 2):
                    end = cut_candidate + 1

            chunk_str = clean_text[start:end].strip()
            if chunk_str:
                chunks.append(
                    ExtractedChunk(
                        chunk_index=idx,
                        content=chunk_str,
                        char_count=len(chunk_str),
                        page_number=page_number,
                        chapter=chapter,
                        lesson=lesson,
                        topic=topic,
                        concept=concept,
                        learning_objective=learning_objective,
                        chunk_metadata={"page": page_number},
                    )
                )
                idx += 1

            if end >= text_len:
                break
            start = end - self.CHUNK_OVERLAP

        return chunks
