import json
import random
import uuid
import logging
import re
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.game_progress import UserGameProgress
from app.schemas.word_scramble import (
    WordScrambleQuestionResponse,
    WordScrambleVerifyResponse,
)
from app.services.reward_service import RewardService
from app.services.trial_guard_service import TrialGuardService
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)

# In-Memory Cache Registry for active game sessions
GAME_SESSIONS: Dict[str, Dict[str, Any]] = {}

# In-Memory User Recent Words Registry (prevents repeating words per user)
USER_RECENT_WORDS: Dict[int, List[str]] = {}

# In-Memory User Stage & Question Progress Registry (persists stage across sessions)
USER_STAGE_PROGRESS: Dict[int, Dict[str, Dict[str, Any]]] = {}

ENGLISH_BLACKLIST_WORDS = {
    "ENVIRONMENT", "BEAUTIFUL", "COMMUNITY", "TECHNOLOGY", "FRIENDSHIP",
    "FAMILY", "SCHOOL", "DOCTOR", "TEACHER", "PLAYGROUND", "STUDENT",
    "CLASSMATE", "FOOTBALL", "BREAKFAST", "LIBRARY", "SUMMER", "CLASSROOM",
    "IMPORTANT", "HOLIDAY", "PROTECT", "TOGETHER", "COUNTRYSIDE", "GARDENING",
    "EQUIPMENT", "COMPUTER", "TRADITIONAL", "VOLUNTEER", "CELEBRATION",
    "FESTIVAL", "DELICIOUS", "EXPERIENCE", "EDUCATION", "ATMOSPHERE",
    "GENERATION", "POLLUTION", "RECYCLING", "INTELLIGENCE", "INDEPENDENCE",
    "VOCABULARY", "OPPORTUNITY", "ACHIEVEMENT", "EXPLORATION", "PERFORMANCE",
}

# Expanded & Clean Curated SGK Curriculum Word Bank (GDPT Lớp 4 - 9)
VIETNAMESE_SGK_WORDS: List[Dict[str, Any]] = [
    # --- DẠNG 1: TỪ LÁY HAY & TỪ GỢI TẢ/GỢI HÌNH/CẢM XÚC (Lớp 4 - 9) ---
    {"word": "LUNG LINH", "grade": 4, "hint": "Ánh sáng phản chiếu chập chờn, rạng rỡ và vô cùng đẹp mắt.", "lesson": "SGK Tiếng Việt 4 - Mở rộng vốn từ 'Gợi tả'"},
    {"word": "RỰC RỠ", "grade": 4, "hint": "Màu sắc tươi sáng, lộng lẫy và nổi bật thu hút mọi ánh nhìn.", "lesson": "SGK Tiếng Việt 4 - Bài tập đọc 'Sắc màu quê hương'"},
    {"word": "BÁT NGÁT", "grade": 4, "hint": "Cánh đồng hay không gian rộng lớn bao la kéo dài tới tận chân trời.", "lesson": "SGK Tiếng Việt 4 - Cánh đồng quê hương"},
    {"word": "RÓC RÁCH", "grade": 4, "hint": "Âm thanh vui tai của dòng nước nhỏ chảy qua kẽ đá trong rừng.", "lesson": "SGK Tiếng Việt 4 - Bài 'Tiếng suối'"},
    {"word": "XÔN XAO", "grade": 4, "hint": "Âm thanh nhộn nhịp hoặc cảm xúc xao xuyến, vui vẻ của tập thể.", "lesson": "SGK Tiếng Việt 4 - Bài đọc mở rộng"},
    {"word": "THƯỚT THA", "grade": 4, "hint": "Dáng vẻ mềm mại, dịu dàng của tà áo dài hoặc bước đi uyển chuyển.", "lesson": "SGK Tiếng Việt 4 - Bài 'Áo dài Việt Nam'"},
    {"word": "MỘC MẠC", "grade": 4, "hint": "Giản dị, chân thật, mang nét đẹp tự nhiên không màu mè tô vẽ.", "lesson": "SGK Tiếng Việt 4 - Luyện từ và câu"},
    {"word": "CẦN MẪN", "grade": 4, "hint": "Siêng năng, chịu khó miệt mài làm việc một cách bền bỉ.", "lesson": "SGK Tiếng Việt 4 - Đức tính tốt đẹp"},
    {"word": "HOẠT BÁT", "grade": 4, "hint": "Nhanh nhẹn, vui vẻ, linh hoạt trong giao tiếp và hành động.", "lesson": "SGK Tiếng Việt 4 - Mở rộng vốn từ 'Con người'"},
    {"word": "ĐẦM ẤM", "grade": 4, "hint": "Cảm giác ấm áp, hân hoan và hạnh phúc trong tình yêu thương gia đình.", "lesson": "SGK Tiếng Việt 4 - Chủ điểm Gia đình"},
    {"word": "DỊU DÀNG", "grade": 4, "hint": "Thái độ ân cần, nhẹ nhàng và gây ấn tượng tốt cho người đối diện.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "ÔN TỒN", "grade": 4, "hint": "Lời nói và thái độ từ tốn, lịch sự, nhã nhặn khi ứng xử.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "LẤP LÁNH", "grade": 4, "hint": "Ánh sáng phát ra nhấp nháy liên tục rực rỡ như những giọt sương.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "THÁO VÁT", "grade": 4, "hint": "Nhanh trí, linh hoạt, biết cách xoay xở giải quyết mọi việc khéo léo.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "BÂN G KHUÂN G", "grade": 5, "hint": "Cảm xúc man mát buồn, vương vấn kỷ niệm trong tâm hồn.", "lesson": "SGK Tiếng Việt 5 - Mùa thu quê hương"},
    {"word": "THA THIẾT", "grade": 5, "hint": "Tình cảm chân thành, nồng nàn và tràn đầy tâm huyết dành cho quê hương.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "RÀO RẠT", "grade": 5, "hint": "Âm thanh hoặc cảm xúc dâng trào mạnh mẽ, liên tục như sóng biển.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "RỘN RÃ", "grade": 5, "hint": "Âm thanh vui tươi, vang dội nhộn nhịp trong các lễ hội.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "RÌ RÀO", "grade": 5, "hint": "Âm thanh êm dịu của tiếng gió thổi qua kẽ lá râm mát.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "LONG LANH", "grade": 5, "hint": "Vẻ trong trẻo, phản chiếu ánh sáng lấp lánh của giọt sương mai.", "lesson": "SGK Tiếng Việt 5"},

    # --- DẠNG 2: THIÊN NHIÊN, VŨ TRỤ & ĐẤT NƯỚC (Lớp 4 - 7) ---
    {"word": "BÌNH MINH", "grade": 4, "hint": "Khoảnh khắc mặt trời bắt đầu mọc lên chào ngày mới tươi sáng.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "HOÀNG HÔN", "grade": 4, "hint": "Khoảnh khắc mặt trời lặn dần vào ranh giới cuối buổi chiều.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "PHÙ SA", "grade": 4, "hint": "Đất màu mỡ do dòng sông bồi đắp cho đồng ruộng tươi tốt.", "lesson": "SGK Tiếng Việt 4 - Bài 'Cửu Long giang'"},
    {"word": "GIANG SƠN", "grade": 5, "hint": "Sông núi đất nước bao la hùng vĩ ngàn năm văn hiến.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "THIÊN VĂN", "grade": 5, "hint": "Ngành khoa học nghiên cứu các vì sao, hành tinh và vũ trụ.", "lesson": "SGK Tiếng Việt 5 - Khám phá tự nhiên"},
    {"word": "TINH TÚ", "grade": 5, "hint": "Các vì sao lấp lánh lung linh trên bầu trời đêm huyền diệu.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "ĐẠI DƯƠNG", "grade": 5, "hint": "Vùng biển rộng lớn vô tận bao phủ đại bộ phận trái đất.", "lesson": "SGK Tiếng Việt 5 - Hành tinh xanh"},
    {"word": "THẢO NGUYÊN", "grade": 5, "hint": "Cánh đồng cỏ tự nhiên bao la ngút ngàn tầm mắt.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "SÔNG NÚI", "grade": 5, "hint": "Hình ảnh ẩn dụ tượng trưng cho non sông thiêng liêng của Tổ quốc.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "HẢI ĐẢO", "grade": 5, "hint": "Vùng đất nổi lên giữa biển cả kiên cường của đất nước.", "lesson": "SGK Tiếng Việt 5 - Biển đảo quê hương"},
    {"word": "SINH THÁI", "grade": 6, "hint": "Môi trường sống tự nhiên và sự cân bằng giữa các loài sinh vật.", "lesson": "SGK Ngữ Văn 6 - Văn bản môi trường"},

    # --- DẠNG 3: VĂN HỌC, NGHỆ THUẬT & TÂM HỒN (Lớp 6 - 9) ---
    {"word": "KHÁT VỌNG", "grade": 6, "hint": "Ước mơ mãnh liệt hướng tới những điều cao đẹp trong tương lai.", "lesson": "SGK Ngữ Văn 6 - Văn học và tâm hồn"},
    {"word": "HOÀI NIỆM", "grade": 6, "hint": "Cảm xúc thương nhớ vương vấn về những kỷ niệm đẹp đã qua.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "CẢM HỨNG", "grade": 6, "hint": "Trạng thái tâm hồn thăng hoa thúc đẩy sáng tạo nghệ thuật.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "THI CA", "grade": 6, "hint": "Nghệ thuật thơ ca giàu cảm xúc, nhạc điệu và hình ảnh.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "TRI ÂM", "grade": 6, "hint": "Người bạn thấu hiểu sâu sắc tâm tư và tình cảm của mình.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "NHÂN VĂN", "grade": 7, "hint": "Giá trị cao đẹp hướng về tình yêu thương con người và sự sẻ chia.", "lesson": "SGK Ngữ Văn 7 - Giá trị nhân văn"},
    {"word": "PHONG THÁI", "grade": 7, "hint": "Dáng vẻ tự tin, ung dung và lịch thiệp trong cách ứng xử.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "BẢN LĨNH", "grade": 7, "hint": "Sự vững vàng, dũng cảm đối mặt với khó khăn thử thách.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "TRƯỜNG TỒN", "grade": 7, "hint": "Sức sống bền vững mãi mãi cùng lịch sử thời gian.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "UY NGHI", "grade": 7, "hint": "Dáng vẻ trang nghiêm, lẫm liệt khiến mọi người kính nể.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "TRÁNG LỆ", "grade": 7, "hint": "Vẻ đẹp lộng lẫy, nguy nga và hùng vĩ đáng tự hào.", "lesson": "SGK Ngữ Văn 7"},

    # --- DẠNG 4: KHOA HỌC, KHÁM PHÁ & TRÍ TUỆ (Lớp 7 - 9) ---
    {"word": "PHÁT MINH", "grade": 7, "hint": "Sáng tạo ra thiết bị hoặc giải pháp kỹ thuật mới có giá trị.", "lesson": "SGK Ngữ Văn 7 - Đọc hiểu khoa học"},
    {"word": "THÁM HIỂM", "grade": 7, "hint": "Hành trình đi đến vùng đất mới lạ để nghiên cứu và phát hiện.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "SÁNG KIẾN", "grade": 8, "hint": "Ý tưởng cải tiến công việc mang lại hiệu quả cao hơn.", "lesson": "SGK Ngữ Văn 8"},
    {"word": "GIẢI MÃ", "grade": 8, "hint": "Tìm ra đáp án hoặc bí mật ẩn giấu sau các mã số, câu đố.", "lesson": "SGK Ngữ Văn 8"},
    {"word": "LOGIC", "grade": 8, "hint": "Tư duy chặt chẽ, có nguyên lý và lập luận khoa học.", "lesson": "SGK Tin học & Ngữ Văn 8"},
    {"word": "NGUYÊN LÝ", "grade": 8, "hint": "Quy luật nền tảng cơ bản làm cơ sở cho các ngành khoa học.", "lesson": "SGK Ngữ Văn 8"},
    {"word": "PHÁT KIẾN", "grade": 8, "hint": "Tìm ra điều mới mẻ mang tính đột phá cho tri thức nhân loại.", "lesson": "SGK Ngữ Văn 8"},
    {"word": "MÔ PHỎNG", "grade": 8, "hint": "Tái tạo lại hình ảnh hoặc hoạt động dựa trên mô hình thực tế.", "lesson": "SGK Tin học 8"},

    # --- DẠNG 5: ĐẠO ĐỨC, LỐI SỐNG & PHẨM CHẤT (Lớp 4 - 9) ---
    {"word": "YÊU THƯƠNG", "grade": 4, "hint": "Tình cảm gắn bó, quan tâm sâu sắc giữa con người với con người.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "ĐOÀN KẾT", "grade": 4, "hint": "Sự kết hợp tập thể thành một khối thống nhất vì mục tiêu chung.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "TRUNG THỰC", "grade": 4, "hint": "Tôn trọng sự thật, không dối trá, thành thật với bản thân.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "CHĂM CHỈ", "grade": 4, "hint": "Chịu khó, siêng năng làm việc và học tập liên tục.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "KHIÊM TỐN", "grade": 4, "hint": "Phẩm chất tốt đẹp, không tự kiêu tự đại, luôn kính trọng người khác.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "DŨNG CẢM", "grade": 4, "hint": "Không sợ nguy hiểm, sẵn sàng bảo vệ lẽ phải.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "KIÊN TRÌ", "grade": 4, "hint": "Nhẫn nại, không nản lòng trước mọi thử thách để đạt mục tiêu.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "KỶ LUẬT", "grade": 4, "hint": "Ý thức tuân thủ quy định chung của tập thể và nhà trường.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "HIẾU THẢO", "grade": 4, "hint": "Lòng biết ơn và sự chăm sóc kính trọng cha mẹ, ông bà.", "lesson": "SGK Tiếng Việt 4"},
    {"word": "BAO DUNG", "grade": 5, "hint": "Lòng rộng lượng sẵn sàng bỏ qua lỗi lầm của người khác.", "lesson": "SGK Tiếng Việt 5 - Đạo đức lối sống"},
    {"word": "VỊ THA", "grade": 5, "hint": "Tấm lòng vì người khác, sống hướng thiện không ích kỷ.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "ĐỒNG CẢM", "grade": 5, "hint": "Sự thấu hiểu và chia sẻ cảm xúc chân thành với người khác.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "SẺ CHIA", "grade": 5, "hint": "Hành động san sẻ niềm vui, nỗi buồn hoặc hỗ trợ bạn bè.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "KIÊN CƯỜNG", "grade": 6, "hint": "Vững vàng, không chịu lùi bước trước khó khăn gian khổ.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "TRUNG HẬU", "grade": 6, "hint": "Chân thành, tốt bụng và trước sau như một trong tình cảm.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "KHIÊM NHƯỜNG", "grade": 6, "hint": "Nhún nhường, coi trọng người khác không khoe khoang cá nhân.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "TỰ LẬP", "grade": 6, "hint": "Khả năng tự mình hoàn thành công việc không dựa dẫm người khác.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "HOAN HỶ", "grade": 6, "hint": "Vui vẻ, hân hoan đón nhận những điều may mắn tốt đẹp.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "TRI ÂN", "grade": 7, "hint": "Tỏ lòng biết ơn sâu sắc tới thầy cô và những người giúp đỡ.", "lesson": "SGK Ngữ Văn 7"},

    # --- DẠNG 6: CỤM TỪ, THÀNH NGỮ, TỤC NGỮ HAY (Chặng 6-15 / Lớp 5 - 9) ---
    {"word": "BẢO VỆ MÔI TRƯỜNG", "grade": 5, "hint": "Hành động giữ gìn không khí, nguồn nước và cây xanh sạch đẹp.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "TÔN SƯ TRỌNG ĐẠO", "grade": 5, "hint": "Thành ngữ dạy học sinh kính trọng thầy cô và coi trọng đạo học.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "HỌC ĐI ĐÔI VỚI HÀNH", "grade": 5, "hint": "Quy tắc học tập: vừa tiếp thu lý thuyết vừa áp dụng thực hành.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "GIANG SƠN CẨM VÓC", "grade": 5, "hint": "Hình ảnh ẩn dụ vẻ đẹp tươi đẹp, hùng vĩ của đất nước Việt Nam.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "UỐNG NƯỚC NHỚ NGUỒN", "grade": 5, "hint": "Thành ngữ thể hiện lòng biết ơn sâu sắc đối với thế hệ đi trước.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "ĂN QUẢ NHỚ KẺ TRỒNG CÂY", "grade": 5, "hint": "Thành ngữ ghi nhớ công ơn người tạo ra thành quả cho mình hưởng.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "LÁ LÀNH ĐÙM LÁ RÁCH", "grade": 5, "hint": "Tục ngữ khuyên nhủ con người biết cưu mang giúp đỡ người khó khăn hơn.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "MỘT CÂY LÀM CHẲNG NÊN NON", "grade": 5, "hint": "Câu tục ngữ nhắc nhở sức mạnh vô song của tinh thần đoàn kết.", "lesson": "SGK Tiếng Việt 5"},
    {"word": "HỌC HỌC NỮA HỌC MÃI", "grade": 6, "hint": "Lời khuyên học tập suốt đời nổi tiếng của Lênin.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "TIÊN HỌC LỄ HẬU HỌC VĂN", "grade": 6, "hint": "Đạo lý học đường: Học lễ nghĩa trước rồi mới học tri thức văn hóa.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "CÓ CÔNG MÀI SẮT CÓ NGÀY NÊN KIM", "grade": 6, "hint": "Tục ngữ dạy bài học kiên trì nhẫn nại vượt qua mọi gian khó.", "lesson": "SGK Ngữ Văn 6"},
    {"word": "THẤT BẠI LÀ MẸ THÀNH CÔNG", "grade": 7, "hint": "Bài học rút ra kinh nghiệm quý báu từ những lần vấp ngã.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "ĐI MỘT NGÀY ĐÀNG HỌC MỘT SÀNG KHÔN", "grade": 7, "hint": "Tục ngữ khuyên mở rộng vốn sống và trải nghiệm thực tế.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "BẦU ƠI THƯƠNG LẤY BÍ CÙNG", "grade": 7, "hint": "Lời ca dao tình nghĩa đùm bọc giữa đồng bào cùng một đất nước.", "lesson": "SGK Ngữ Văn 7"},
    {"word": "HỌC THẦY KHÔNG BẰNG HỌC BẠN", "grade": 8, "hint": "Lời khuyên tích cực giao lưu học hỏi lẫn nhau giữa bạn bè.", "lesson": "SGK Ngữ Văn 8"},
    {"word": "THẮNG KHÔNG GIÈM THẤT BẠI KHÔNG NẢN", "grade": 8, "hint": "Tinh thần thể thao và học tập kiên cường, khiêm tốn.", "lesson": "SGK Ngữ Văn 8"},
    {"word": "GẦN MỰC THÌ ĐEN GẦN ĐÈN THÌ SÁNG", "grade": 8, "hint": "Lời khuyên chọn lựa bạn tốt và môi trường sống lành mạnh.", "lesson": "SGK Ngữ Văn 8"},
    {"word": "ĐẠI ĐOÀN KẾT DÂN TỘC", "grade": 9, "hint": "Sức mạnh bệ phóng giúp đất nước vượt qua khó khăn vươn xa.", "lesson": "SGK Ngữ Văn 9"},
    {"word": "KHÁT VỌNG CỐNG HIẾN", "grade": 9, "hint": "Mong muốn đem hết tài năng và sức lực phụng sự cho quê hương đất nước.", "lesson": "SGK Ngữ Văn 9"},
]

ENGLISH_SGK_WORDS: List[Dict[str, Any]] = [
    # Grade 4
    {"word": "FAMILY", "grade": 4, "hint": "A group of parents and their children living together in a home.", "lesson": "English Grade 4 - Unit 2: All About My Family"},
    {"word": "SCHOOL", "grade": 4, "hint": "A place where children go to be educated and learn new things.", "lesson": "English Grade 4 - Unit 1: Welcome to School"},
    {"word": "DOCTOR", "grade": 4, "hint": "A qualified person who treats sick or injured people.", "lesson": "English Grade 4 - Unit 5: Jobs and Professions"},
    {"word": "TEACHER", "grade": 4, "hint": "A person who helps students to acquire knowledge and competence.", "lesson": "English Grade 4 - Unit 5: People at Work"},
    {"word": "PLAYGROUND", "grade": 4, "hint": "An outdoor area provided for children to play in at school.", "lesson": "English Grade 4 - Unit 3: School Activities"},
    {"word": "STUDENT", "grade": 4, "hint": "A person who is studying at a school or college.", "lesson": "English Grade 4 - Unit 1: My Friends and I"},
    {"word": "CLASSMATE", "grade": 4, "hint": "A member of the same class in a school.", "lesson": "English Grade 4 - Unit 1: School Life"},
    {"word": "FOOTBALL", "grade": 4, "hint": "A popular game played with a spherical ball between two teams.", "lesson": "English Grade 4 - Unit 4: Sports and Games"},
    {"word": "BREAKFAST", "grade": 4, "hint": "The first meal of the day, usually eaten in the morning.", "lesson": "English Grade 4 - Unit 6: Daily Routines"},
    {"word": "LIBRARY", "grade": 4, "hint": "A building or room containing collections of books for reading.", "lesson": "English Grade 4 - Unit 3: My School Building"},
    {"word": "WEATHER", "grade": 4, "hint": "The state of the atmosphere at a place and time regarding heat, rain, etc.", "lesson": "English Grade 4 - Unit 8: Weather Today"},
    {"word": "HOSPITAL", "grade": 4, "hint": "An institution providing medical and surgical treatment to sick people.", "lesson": "English Grade 4 - Unit 5: Places in Town"},
    {"word": "ANIMALS", "grade": 4, "hint": "Living creatures such as dogs, cats, lions, and elephants.", "lesson": "English Grade 4 - Unit 7: At the Zoo"},
    {"word": "GARDEN", "grade": 4, "hint": "A piece of ground adjoining a house used for growing flowers or fruit.", "lesson": "English Grade 4 - Unit 2: My Lovely Home"},

    # Grade 5
    {"word": "SUMMER", "grade": 5, "hint": "The warmest season of the year, between spring and autumn.", "lesson": "English Grade 5 - Unit 3: My Summer Holiday"},
    {"word": "COMMUNITY", "grade": 5, "hint": "A group of people living in the same place sharing common interests.", "lesson": "English Grade 5 - Unit 7: Helping Our Community"},
    {"word": "ENVIRONMENT", "grade": 5, "hint": "The natural world including land, water, air, plants, and animals.", "lesson": "English Grade 5 - Unit 9: Protecting Green Earth"},
    {"word": "CLASSROOM", "grade": 5, "hint": "A room in a school where lessons take place.", "lesson": "English Grade 5 - Unit 2: School Facilities"},
    {"word": "IMPORTANT", "grade": 5, "hint": "Of great significance or value; having high priority.", "lesson": "English Grade 5 - Unit 6: Good Habits"},
    {"word": "HOLIDAY", "grade": 5, "hint": "An extended period of leisure and recreation away from home.", "lesson": "English Grade 5 - Unit 3: Special Holidays"},
    {"word": "PROTECT", "grade": 5, "hint": "Keep safe from harm or injury; preserve environment.", "lesson": "English Grade 5 - Unit 9: Save the Animals"},
    {"word": "TOGETHER", "grade": 5, "hint": "With or in proximity to another person or group.", "lesson": "English Grade 5 - Unit 7: Working Together"},
    {"word": "COUNTRYSIDE", "grade": 5, "hint": "The land and scenery of a rural area outside towns and cities.", "lesson": "English Grade 5 - Unit 4: My Hometown"},
    {"word": "PRACTICE MAKES PERFECT", "grade": 5, "hint": "A famous proverb encouraging continuous effort and learning.", "lesson": "English Grade 5 - Unit 10: Life Skills"},
    {"word": "KNOWLEDGE IS POWER", "grade": 5, "hint": "A proverb emphasizing that education empowers people.", "lesson": "English Grade 5 - Unit 10: Reading Books"},

    # Grade 6
    {"word": "TECHNOLOGY", "grade": 6, "hint": "Machinery and equipment developed from scientific knowledge.", "lesson": "English Grade 6 - Unit 10: Our Houses in the Future"},
    {"word": "BEAUTIFUL", "grade": 6, "hint": "Pleasing the senses or mind aesthetically.", "lesson": "English Grade 6 - Unit 4: My Neighbourhood"},
    {"word": "FRIENDSHIP", "grade": 6, "hint": "The emotion or relationship between friends.", "lesson": "English Grade 6 - Unit 3: My Friends"},
    {"word": "GARDENING", "grade": 6, "hint": "The activity of tending and cultivating a garden.", "lesson": "English Grade 6 - Unit 1: My Hobbies"},
    {"word": "EQUIPMENT", "grade": 6, "hint": "The necessary items for a particular purpose or activity.", "lesson": "English Grade 6 - Unit 8: Sports and Games"},
    {"word": "COMPUTER", "grade": 6, "hint": "An electronic device for storing and processing data.", "lesson": "English Grade 6 - Unit 10: Modern Appliances"},
    {"word": "LEARNING NEVER STOPS", "grade": 6, "hint": "A motto encouraging lifelong study and self-improvement.", "lesson": "English Grade 6 - Unit 1: School Habits"},

    # Grade 7
    {"word": "TRADITIONAL", "grade": 7, "hint": "Existing in or as part of a tradition; long-established.", "lesson": "English Grade 7 - Unit 5: Food and Drink"},
    {"word": "VOLUNTEER", "grade": 7, "hint": "A person who freely offers to take part in an enterprise.", "lesson": "English Grade 7 - Unit 3: Community Service"},
    {"word": "CELEBRATION", "grade": 7, "hint": "The action of marking one's pleasure at an important occasion.", "lesson": "English Grade 7 - Unit 9: Festivals Around the World"},
    {"word": "FESTIVAL", "grade": 7, "hint": "A day or period of celebration, typically a cultural one.", "lesson": "English Grade 7 - Unit 9: World Festivals"},
    {"word": "DELICIOUS", "grade": 7, "hint": "Highly pleasant to the taste or smell.", "lesson": "English Grade 7 - Unit 5: Vietnamese Food"},
    {"word": "EXPERIENCE", "grade": 7, "hint": "Practical contact with and observation of facts or events.", "lesson": "English Grade 7 - Unit 4: Music and Arts"},
    {"word": "SAVE THE EARTH TODAY", "grade": 7, "hint": "A slogan urging everyone to protect nature and environment.", "lesson": "English Grade 7 - Unit 7: Green Community"},

    # Grade 8
    {"word": "EDUCATION", "grade": 8, "hint": "The process of receiving or giving systematic instruction.", "lesson": "English Grade 8 - Unit 8: Shopping and Learning"},
    {"word": "ATMOSPHERE", "grade": 8, "hint": "The envelope of gases surrounding the earth or another planet.", "lesson": "English Grade 8 - Unit 11: Science and Technology"},
    {"word": "GENERATION", "grade": 8, "hint": "All of the people born and living at about the same time.", "lesson": "English Grade 8 - Unit 4: Custom and Tradition"},
    {"word": "POLLUTION", "grade": 8, "hint": "The presence in or introduction into the environment of harmful substances.", "lesson": "English Grade 8 - Unit 7: Environmental Protection"},
    {"word": "RECYCLING", "grade": 8, "hint": "Convert waste into reusable material to protect the earth.", "lesson": "English Grade 8 - Unit 7: Green Lifestyle"},
    {"word": "PROTECT GREEN ENVIRONMENT", "grade": 8, "hint": "An action phrase about preserving trees and clean air.", "lesson": "English Grade 8 - Unit 7: Environmental Science"},

    # Grade 9
    {"word": "INTELLIGENCE", "grade": 9, "hint": "The ability to acquire and apply knowledge and skills.", "lesson": "English Grade 9 - Unit 11: Electronic Devices"},
    {"word": "INDEPENDENCE", "grade": 9, "hint": "The fact or state of being independent and self-governing.", "lesson": "English Grade 9 - Unit 6: Vietnam Then and Now"},
    {"word": "VOCABULARY", "grade": 9, "hint": "A body of words used in a particular language or study.", "lesson": "English Grade 9 - Unit 9: English in the World"},
    {"word": "OPPORTUNITY", "grade": 9, "hint": "A set of circumstances that makes it possible to do something.", "lesson": "English Grade 9 - Unit 12: My Future Career"},
    {"word": "ACHIEVEMENT", "grade": 9, "hint": "A thing done successfully with effort, skill, or courage.", "lesson": "English Grade 9 - Unit 9: Life Skills"},
    {"word": "PRESERVE NATURAL RESOURCES", "grade": 9, "hint": "A phrase encouraging sustainable development for future generations.", "lesson": "English Grade 9 - Unit 8: Planet Earth"},
]


class WordScrambleService:
    @classmethod
    def _is_valid_english_word(cls, word: str) -> bool:
        """Checks if word is strictly English ASCII letters and spaces, without Vietnamese accents."""
        w = word.strip().upper()
        if not w:
            return False
        if not re.match(r"^[A-Z\s\-]+$", w):
            return False
        vietnamese_accents = re.compile(r"[ĂÂĐÊÔƠƯÁÀẢẠÃẮẰẲẶẴẤẦẨẬẪẾỀỂỆỄỐỒỔỘỖỚỜỞỢỠỨỪỬỰỮÍÌỈỊĨÝỲỶỊỸ]")
        if vietnamese_accents.search(w):
            return False
        return True

    @classmethod
    def _is_valid_vietnamese_word(cls, word: str) -> bool:
        """Checks if word is valid Vietnamese and NOT an English vocabulary word."""
        w = word.strip().upper()
        if not w:
            return False
        clean_words = w.split()
        for cw in clean_words:
            if cw in ENGLISH_BLACKLIST_WORDS:
                return False
        if len(clean_words) == 1 and re.match(r"^[A-Z]+$", w) and w in ENGLISH_BLACKLIST_WORDS:
            return False
        return True

    @staticmethod
    def _generate_pre_filled_hints(target_items: List[str], scrambled_items: List[str]) -> List[Dict[str, Any]]:
        """
        Generates 1-2 pre-filled hint tiles for ~35-40% of questions.
        """
        count = len(target_items)
        if count < 3:
            return []

        if random.random() > 0.40:
            return []

        num_hints = 1 if count <= 5 else random.choice([1, 2])

        candidate_target_indices = list(range(count))
        chosen_t_indices = []

        # 70% chance to include the 1st letter/word as a hint
        if random.random() < 0.70 and 0 in candidate_target_indices:
            chosen_t_indices.append(0)
            candidate_target_indices.remove(0)

        while len(chosen_t_indices) < num_hints and candidate_target_indices:
            t_idx = random.choice(candidate_target_indices)
            chosen_t_indices.append(t_idx)
            candidate_target_indices.remove(t_idx)

        chosen_t_indices.sort()

        used_s_indices = set()
        hints = []

        for t_idx in chosen_t_indices:
            val = target_items[t_idx]
            matching_s_indices = [
                i for i, item in enumerate(scrambled_items)
                if item == val and i not in used_s_indices
            ]
            if matching_s_indices:
                s_idx = matching_s_indices[0]
                used_s_indices.add(s_idx)
                hints.append({
                    "target_index": t_idx,
                    "scrambled_index": s_idx,
                    "letter": val,
                })

        return hints

    @classmethod
    def _scramble_items(cls, word: str) -> Dict[str, Any]:
        """
        Scrambles items based on word count:
        - 1-2 words: Mode 'word' (scrambles individual letters).
        - 3+ words: Mode 'sentence' (scrambles whole word tokens).
        Also generates pre-filled hint tiles for ~40% of questions.
        """
        clean_word = word.strip().upper()
        words = clean_word.split()

        if len(words) >= 3:
            # Sentence / Phrase Scramble mode: scramble whole word tokens
            target_items = words
            shuffled = target_items.copy()
            if len(shuffled) > 1:
                for _ in range(12):
                    random.shuffle(shuffled)
                    if shuffled != target_items:
                        break

            hints = cls._generate_pre_filled_hints(target_items, shuffled)

            return {
                "mode": "sentence",
                "items": shuffled,
                "count": len(words),
                "pre_filled_hints": hints,
            }
        else:
            # Word Scramble mode: scramble individual letters
            target_items = [c for c in clean_word if c != " "]
            shuffled = target_items.copy()
            if len(shuffled) > 1:
                for _ in range(12):
                    random.shuffle(shuffled)
                    if "".join(shuffled) != "".join(target_items):
                        break

            hints = cls._generate_pre_filled_hints(target_items, shuffled)

            return {
                "mode": "word",
                "items": shuffled,
                "count": len(target_items),
                "pre_filled_hints": hints,
            }

    @classmethod
    def _generate_word_with_gemini(
        cls, subject: str, grade: int, stage: int = 1, recent_words: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Calls Google Gemini AI to dynamically generate a fresh SGK word/phrase item
        tailored to Chặng (Stage 1-15) difficulty.
        """
        if not GeminiKnowledgeService.is_gemini_configured():
            return None

        api_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
        if not api_key:
            return None

        is_english = "anh" in subject.lower() or "english" in subject.lower()
        sub_name = "Tiếng Anh" if is_english else "Tiếng Việt"
        recent_str = ", ".join(recent_words[-40:]) if recent_words else "Không có"

        if stage <= 5:
            req_type = "từ ghép hoặc từ vựng ngắn TỐI ĐA 2 TIẾNG (Ví dụ: 'TRUNG THỰC', 'YÊU THƯƠNG', 'TEACHER', 'FAMILY')"
        elif stage <= 10:
            req_type = "từ ghép 2 tiếng hoặc cụm từ 3 tiếng (Ví dụ: 'BẢO VỆ MÔI TRƯỜNG', 'COMMUNITY', 'TÔN SƯ TRỌNG ĐẠO')"
        else:
            req_type = "câu thành ngữ, tục ngữ dài hoặc câu nói hay SGK 3-5 tiếng (Ví dụ: 'UỐNG NƯỚC NHỚ NGUỒN', 'ĂN QUẢ NHỚ KẺ TRỒNG CÂY', 'PROTECT THE ENVIRONMENT')"

        if is_english:
            english_categories = [
                "VOCABULARY & WORDS (e.g. ADVENTURE, WONDERFUL, EXPLORATION, KNOWLEDGE, CREATIVITY, IMAGINATION, UNIVERSE, CHALLENGE, PERSEVERANCE)",
                "NATURE & ENVIRONMENT (e.g. RAINFOREST, ATMOSPHERE, ECOSYSTEM, SUNLIGHT, WILDLIFE, LANDSCAPE, THUNDERSTORM, CONSERVATION)",
                "SCIENCE & TECHNOLOGY (e.g. ARTIFICIAL INTELLIGENCE, EXPERIMENT, ASTRONOMY, INNOVATION, DISCOVERY, ROBOTICS, ASTRONAUT)",
                "CULTURE, ARTS & SPORTS (e.g. CELEBRATION, INSTRUMENT, MASTERPIECE, CHAMPIONSHIP, TRADITION, HARMONY, ARCHITECTURE)",
                "LIFE SKILLS & PERSONALITY (e.g. INDEPENDENCE, PERSEVERANCE, HONESTY, GENEROSITY, COMPASSION, RESPONSIBILITY)",
                "ENGLISH PROVERBS & IDIOMS (e.g. PRACTICE MAKES PERFECT, KNOWLEDGE IS POWER, WHERE THERE IS A WILL, ACTIONS SPEAK LOUDER)",
            ]
            chosen_eng_cat = random.choice(english_categories)

            prompt = f"""Bạn là một từ điển Tiếng Anh AI thông minh biên soạn từ vựng SGK & Tiếng Anh chuẩn Quốc tế Lớp {grade} cho Chặng {stage}/15.
Hãy tìm kiếm trong kho từ điển Tiếng Anh 01 từ/cụm từ hay, độc đáo thuộc chủ đề: {chosen_eng_cat}.
Yêu cầu cấp độ: {req_type}.

ĐẶC BIỆT LƯU Ý: Đa dạng hóa vốn từ vựng phong phú, không lặp lại từ đơn điệu.

YÊU CẦU BẮT BUỘC:
1. Trường `word` BẮT BUỘC phải là TIẾNG ANH viết IN HOA, chỉ gồm các ký tự chữ cái A-Z và khoảng trắng (nếu là cụm từ).
2. KHÔNG ĐƯỢC chứa ký tự Tiếng Việt hoặc dấu câu phức tạp trong trường `word`.
3. Trường `hint` giải thích nghĩa từ/cụm từ bằng Tiếng Việt hoặc Tiếng Anh ngắn gọn 1 câu dễ hiểu cho học sinh Lớp {grade}.
4. TUYỆT ĐỐI KHÔNG TRÙNG VỚI CÁC TỪ SAU: {recent_str}.

YÊU CẦU ĐẦU RA JSON CHÍNH XÁC:
{{
  "word": "ENGLISH_WORD_OR_PHRASE",
  "hint": "Gợi ý nghĩa từ/cụm từ...",
  "lesson": "English Grade {grade} - Unit / Topic"
}}
"""
        else:
            categories = [
                "TỪ LÁY HAY & GỢI TẢ GỢI HÌNH (Ví dụ: LUNG LINH, RỰC RỠ, RÓC RÁCH, XÔN XAO, THƯỚT THA, BÂNG KHUÂN G, MỘC MẠC, CẦN MẪN, HOẠT BÁT, LẤP LÁNH, ĐẦM ẤM, RÀO RẠT, LONG LANH, THA THIẾT, XANH XAO, NỒNG NÀN)",
                "THIÊN NHIÊN, VŨ TRỤ & ĐẤT NƯỚC (Ví dụ: HOÀNG HÔN, BÌNH MINH, PHÙ SA, GIANG SƠN, THIÊN VĂN, TINH TÚ, ĐẠI DƯƠNG, THẢO NGUYÊN, SINH THÁI, SÔNG NÚI, SƯƠNG MÙ, BÃO TÁP, BẢO TỒN)",
                "VĂN HỌC, NGHỆ THUẬT & TÂM HỒN (Ví dụ: KHÁT VỌNG, HOÀI NIỆM, CẢM HỨNG, THI CA, TRI ÂM, NHÂN VĂN, BẢN LĨNH, TRƯỜNG TỒN, UY NGHI, TRÁNG LỆ, NGHỆ THUẬT, TÂM HUYẾT)",
                "KHOA HỌC, KHÁM PHÁ & TRÍ TUỆ (Ví dụ: SÁNG KIẾN, PHÁT MINH, THÁM HIỂM, GIẢI MÃ, NGUYÊN LÝ, LOGIC, PHÁT KIẾN, MÔ PHỎNG, ĐỘT PHÁ, TRI THỨC)",
                "ĐẠO ĐỨC, KỸ NĂNG SỐNG & LỐI SỐNG (Ví dụ: BAO DUNG, VỊ THA, ĐỒNG CẢM, SẺ CHIA, KIÊN CƯỜNG, TRUNG HẬU, KHIÊM NHƯỜNG, TỰ LẬP, TRI ÂN, DŨNG CẢM, KỶ LUẬT)",
                "THÀNH NGỮ TỤC NGỮ HAY (Ví dụ: UỐNG NƯỚC NHỚ NGUỒN, ĂN QUẢ NHỚ KẺ TRỒNG CÂY, HỌC THẦY KHÔNG BẰNG HỌC BẠN, ĐI MỘT NGÀY ĐÀNG HỌC MỘT SÀNG KHÔN, THẮNG KHÔNG GIÈM THẤT BẠI KHÔNG NẢN, BẦU ƠI THƯƠNG LẤY BÍ CÙNG, TIÊN HỌC LỄ HẬU HỌC VĂN)",
            ]
            chosen_cat = random.choice(categories)

            prompt = f"""Bạn là một chuyên gia ngôn ngữ học & từ điển Tiếng Việt biên soạn từ vựng SGK Tiếng Việt Lớp {grade} (GDPT 2018) cho Chặng {stage}/15.
Hãy tìm kiếm trong kho từ điển Tiếng Việt 01 từ/cụm từ hay, giàu hình ảnh/cảm xúc thuộc chủ đề: {chosen_cat}.
Yêu cầu cấp độ: {req_type}.

ĐẶC BIỆT LƯU Ý: Đa dạng hóa vốn từ vựng phong phú, ưu tiên từ láy hay, từ giàu hình ảnh/cảm xúc/thiên nhiên/khoa học/văn học/thành ngữ. TUYỆT ĐỐI KHÔNG sinh lại các từ quen thuộc quá đơn điệu.

YÊU CẦU BẮT BUỘC:
1. Trường `word` BẮT BUỘC phải là từ ghép/từ láy/thành ngữ TIẾNG VIỆT có nghĩa (viết IN HOA, có dấu đầy đủ).
2. TUYỆT ĐỐI KHÔNG sinh từ Tiếng Anh.
3. Trường `hint` giải thích nghĩa bằng Tiếng Việt ngắn gọn 1 câu gợi ý hay, dễ hiểu cho học sinh Lớp {grade}.
4. TUYỆT ĐỐI KHÔNG TRÙNG VỚI CÁC TỪ SAU: {recent_str}.

YÊU CẦU ĐẦU RA JSON CHÍNH XÁC:
{{
  "word": "TỪ_HOẶC_CÂU_TIẾNG_VIỆT_IN_HOA",
  "hint": "Định nghĩa/gợi ý ngắn gọn 1 câu...",
  "lesson": "SGK Tiếng Việt / Ngữ Văn {grade} - Tên bài học/Chủ điểm"
}}
"""

        models_to_try = [
            settings.GEMINI_MODEL,
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.5-flash",
        ]
        models_to_try = list(dict.fromkeys([m.strip() for m in models_to_try if m and m.strip()]))

        try:
            with httpx.Client(timeout=7.0) as client:
                for model_name in models_to_try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 1.0,
                            "responseMimeType": "application/json",
                        },
                    }
                    try:
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                text_content = candidates[0]["content"]["parts"][0]["text"]
                                cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip())
                                cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                                parsed = json.loads(cleaned)

                                word_val = str(parsed.get("word", "")).strip().upper()
                                hint_val = str(parsed.get("hint", "")).strip()
                                lesson_val = str(parsed.get("lesson", "")).strip()

                                if word_val and hint_val:
                                    if is_english and not cls._is_valid_english_word(word_val):
                                        continue
                                    if not is_english and not cls._is_valid_vietnamese_word(word_val):
                                        continue
                                    if recent_words and word_val in recent_words:
                                        continue

                                    item = {
                                        "word": word_val,
                                        "grade": grade,
                                        "hint": hint_val,
                                        "lesson": lesson_val or f"SGK {sub_name} Lớp {grade}",
                                    }
                                    target_bank = ENGLISH_SGK_WORDS if is_english else VIETNAMESE_SGK_WORDS
                                    if not any(x["word"] == word_val for x in target_bank):
                                        target_bank.append(item)
                                    return item
                    except Exception as exc:
                        logger.warning(f"Mô hình AI Gemini {model_name} khi tạo từ vựng gặp lỗi: {exc}")
        except Exception as main_exc:
            logger.warning(f"Lỗi kết nối Gemini AI: {main_exc}")

        return None


    @classmethod
    def get_next_question(
        cls,
        db: Session,
        student: User,
        subject: str = "Tiếng Việt",
        grade: Optional[int] = None,
        stage: int = 1,
        question_index: int = 1,
    ) -> WordScrambleQuestionResponse:
        """
        Generates a word scramble game session tailored to student grade, subject & stage (Chặng 1-15, Câu 1-10/Chặng).
        Automatically classifies mode:
        - 1-2 words: 'word' mode (scrambles letters).
        - 3+ words: 'sentence' mode (scrambles whole words).
        """
        TrialGuardService.check_and_increment_trial_usage(db, student, "game_vua_tu_vung")

        applied_grade = grade or student.grade or 5
        target_subject = "Tiếng Anh" if "anh" in subject.lower() or "english" in subject.lower() else "Tiếng Việt"
        current_stage = max(1, min(15, stage))
        curr_q_index = max(1, min(10, question_index))

        # Auto-resume from DB progress if stage=1 and question_index=1
        if stage == 1 and question_index == 1:
            saved_p = cls.get_user_progress(db=db, student=student, subject=target_subject, grade=applied_grade)
            if saved_p and (saved_p.get("stage", 1) > 1 or saved_p.get("question_index", 1) > 1):
                current_stage = max(1, min(15, saved_p.get("stage", 1)))
                curr_q_index = max(1, min(10, saved_p.get("question_index", 1)))

        user_id = student.id
        recent_words = USER_RECENT_WORDS.get(user_id, [])

        # Try generating a fresh word with Gemini AI tailored to Stage
        selected_item = cls._generate_word_with_gemini(target_subject, applied_grade, stage=current_stage, recent_words=recent_words)

        # Fallback to expanded clean curated bank
        if not selected_item:
            source_bank = ENGLISH_SGK_WORDS if target_subject == "Tiếng Anh" else VIETNAMESE_SGK_WORDS

            # Filter by stage requirements
            if current_stage <= 5:
                stage_pool = [x for x in source_bank if len(x["word"].split()) <= 2]
            elif current_stage >= 11:
                stage_pool = [x for x in source_bank if len(x["word"].split()) >= 3]
            else:
                stage_pool = source_bank

            if not stage_pool:
                stage_pool = source_bank

            filtered = [item for item in stage_pool if item["grade"] == applied_grade and item["word"] not in recent_words]
            if not filtered:
                filtered = [item for item in stage_pool if item["word"] not in recent_words]
            if not filtered:
                last_10 = recent_words[-10:] if len(recent_words) >= 10 else recent_words
                filtered = [item for item in stage_pool if item["word"] not in last_10]
            if not filtered:
                filtered = stage_pool

            selected_item = random.choice(filtered)

        target_word = selected_item["word"].upper()

        # Update user recent words memory (up to 300 words history)
        if user_id not in USER_RECENT_WORDS:
            USER_RECENT_WORDS[user_id] = []
        if target_word not in USER_RECENT_WORDS[user_id]:
            USER_RECENT_WORDS[user_id].append(target_word)
        if len(USER_RECENT_WORDS[user_id]) > 300:
            USER_RECENT_WORDS[user_id] = USER_RECENT_WORDS[user_id][-300:]

        scrambled_data = cls._scramble_items(target_word)
        game_id = f"wsg_{uuid.uuid4().hex[:12]}"

        # Save session data
        GAME_SESSIONS[game_id] = {
            "game_id": game_id,
            "user_id": student.id,
            "target_word": target_word,
            "subject": target_subject,
            "grade": applied_grade,
            "stage": current_stage,
            "question_index": curr_q_index,
            "mode": scrambled_data["mode"],
            "hint_meaning": selected_item["hint"],
            "hint_sgk_lesson": selected_item["lesson"],
        }

        first_item = target_word.split()[0] if scrambled_data["mode"] == "sentence" else target_word.replace(" ", "")[0]

        return WordScrambleQuestionResponse(
            game_id=game_id,
            subject=target_subject,
            grade=applied_grade,
            mode=scrambled_data["mode"],
            stage=current_stage,
            total_stages=15,
            question_index=curr_q_index,
            total_questions_per_stage=10,
            scrambled_letters=scrambled_data["items"],
            letter_count=scrambled_data["count"],
            hint_meaning=selected_item["hint"],
            hint_sgk_lesson=selected_item["lesson"],
            first_letter_hint=first_item,
            english_audio_prompt=target_word if target_subject == "Tiếng Anh" else None,
            reward_diamonds=1,
            pre_filled_hints=scrambled_data.get("pre_filled_hints", []),
            target_word=target_word,
        )

    @classmethod
    def verify_answer(
        cls,
        db: Session,
        student: User,
        game_id: str,
        user_answer: str,
        streak_count: int = 0,
    ) -> WordScrambleVerifyResponse:
        """
        Verifies student's built word, updates streak, and awards diamonds on 10-consecutive streak milestones.
        """
        session = GAME_SESSIONS.get(game_id)
        if not session:
            clean_ans = user_answer.strip().upper()
            return WordScrambleVerifyResponse(
                is_correct=False,
                target_word=clean_ans,
                user_answer=clean_ans,
                explanation="Phiên trò chơi đã hết hạn. Vui lòng bấm 'Từ Tiếp Theo' để bắt đầu câu mới.",
                current_streak=0,
                earned_diamonds=0,
                new_diamond_balance=student.diamond_balance or 0,
            )

        target = session["target_word"].strip().upper()
        target_subject = session.get("subject", "Môn học")
        norm_target = target.replace(" ", "")
        norm_user = user_answer.strip().upper().replace(" ", "")

        is_correct = norm_user == norm_target

        earned_diamonds = 0
        new_balance = student.diamond_balance or 0
        new_streak = streak_count + 1 if is_correct else 0

        # RULE UPDATE: Award 1 Diamond only on every 7 consecutive correct streak milestone per subject
        # DAILY CAP: Maximum 2 diamonds per day from Word Scramble game
        if is_correct and new_streak > 0 and new_streak % 7 == 0:
            reward_res = RewardService.award_word_scramble_diamonds(
                db,
                student.id,
                reference_id=f"streak_{target_subject}_{new_streak}",
                max_daily_diamonds=2,
            )
            earned_diamonds = reward_res.get("awarded", 0)
            new_balance = reward_res.get("new_balance", new_balance)

        # Auto-update persistent stage & question progress on answer
        if is_correct:
            curr_stage = session.get("stage", 1)
            curr_q_index = session.get("question_index", 1)

            if curr_q_index < 10:
                next_stage = curr_stage
                next_q_index = curr_q_index + 1
            else:
                next_stage = min(15, curr_stage + 1)
                next_q_index = 1

            cls.save_user_progress(
                db=db,
                student=student,
                subject=target_subject,
                grade=session.get("grade", 5),
                stage=next_stage,
                question_index=next_q_index,
                streak=new_streak,
            )
        else:
            cls.save_user_progress(
                db=db,
                student=student,
                subject=target_subject,
                grade=session.get("grade", 5),
                stage=session.get("stage", 1),
                question_index=session.get("question_index", 1),
                streak=0,
            )

        explanation = (
            f"🎉 Chính xác! Từ ghép chuẩn SGK: '{target}'. "
            f"Ghi nhớ: {session['hint_meaning']} ({session['hint_sgk_lesson']})."
            if is_correct
            else f"❌ Chưa chính xác! Đáp án đúng là '{target}'. "
            f"Nghĩa từ: {session['hint_meaning']}."
        )

        if is_correct and new_streak > 0 and new_streak % 7 == 0 and earned_diamonds == 0:
            explanation += " (ℹ️ Bạn đã đạt hạn mức nhận tối đa 2 💎 Kim Cương/ngày từ trò chơi Vua Từ Vựng. Hãy quay lại thử sức vào ngày mai nhé!)"

        return WordScrambleVerifyResponse(
            is_correct=is_correct,
            target_word=target,
            user_answer=user_answer.strip().upper(),
            explanation=explanation,
            current_streak=new_streak,
            earned_diamonds=earned_diamonds,
            new_diamond_balance=new_balance,
        )

    @classmethod
    def get_user_progress(
        cls,
        db: Optional[Session] = None,
        student: Optional[User] = None,
        subject: str = "Tiếng Việt",
        grade: int = 5,
    ) -> Dict[str, Any]:
        """Retrieves persistent game progress for student by subject & grade from Database."""
        target_subject = "Tiếng Anh" if "anh" in subject.lower() or "english" in subject.lower() else "Tiếng Việt"
        user_id = student.id if student else None

        if db and user_id:
            try:
                prog = (
                    db.query(UserGameProgress)
                    .filter(
                        UserGameProgress.user_id == user_id,
                        UserGameProgress.game_type == "word_scramble",
                        UserGameProgress.subject == target_subject,
                        UserGameProgress.grade == grade,
                    )
                    .first()
                )
                if prog:
                    saved_data = {
                        "subject": target_subject,
                        "grade": grade,
                        "stage": prog.stage,
                        "question_index": prog.question_index,
                        "streak": prog.streak,
                    }
                    if user_id not in USER_STAGE_PROGRESS:
                        USER_STAGE_PROGRESS[user_id] = {}
                    USER_STAGE_PROGRESS[user_id][target_subject] = saved_data
                    return saved_data
            except Exception as exc:
                logger.warning(f"Lỗi khi truy vấn UserGameProgress từ Database: {exc}")

        # Fallback to in-memory registry if DB record not found or DB not provided
        user_dict = USER_STAGE_PROGRESS.get(user_id, {}) if user_id else {}
        sub_progress = user_dict.get(target_subject)
        if not sub_progress:
            sub_progress = {
                "subject": target_subject,
                "grade": grade,
                "stage": 1,
                "question_index": 1,
                "streak": 0,
            }
        return sub_progress

    @classmethod
    def save_user_progress(
        cls,
        db: Optional[Session] = None,
        student: Optional[User] = None,
        subject: str = "Tiếng Việt",
        grade: int = 5,
        stage: int = 1,
        question_index: int = 1,
        streak: int = 0,
    ) -> Dict[str, Any]:
        """Saves persistent game progress for student by subject & grade to Database."""
        target_subject = "Tiếng Anh" if "anh" in subject.lower() or "english" in subject.lower() else "Tiếng Việt"
        user_id = student.id if student else None

        bounded_stage = max(1, min(15, stage))
        bounded_q_idx = max(1, min(10, question_index))

        saved_data = {
            "subject": target_subject,
            "grade": grade,
            "stage": bounded_stage,
            "question_index": bounded_q_idx,
            "streak": max(0, streak),
        }

        # 1. Update in-memory cache
        if user_id:
            if user_id not in USER_STAGE_PROGRESS:
                USER_STAGE_PROGRESS[user_id] = {}
            USER_STAGE_PROGRESS[user_id][target_subject] = saved_data

        # 2. Persist to Database
        if db and user_id:
            try:
                prog = (
                    db.query(UserGameProgress)
                    .filter(
                        UserGameProgress.user_id == user_id,
                        UserGameProgress.game_type == "word_scramble",
                        UserGameProgress.subject == target_subject,
                        UserGameProgress.grade == grade,
                    )
                    .first()
                )
                if prog:
                    prog.stage = bounded_stage
                    prog.question_index = bounded_q_idx
                    prog.streak = max(0, streak)
                else:
                    prog = UserGameProgress(
                        user_id=user_id,
                        game_type="word_scramble",
                        subject=target_subject,
                        grade=grade,
                        stage=bounded_stage,
                        question_index=bounded_q_idx,
                        streak=max(0, streak),
                    )
                    db.add(prog)

                db.commit()
            except Exception as exc:
                db.rollback()
                logger.warning(f"Lỗi khi lưu UserGameProgress vào Database: {exc}")

        return saved_data
