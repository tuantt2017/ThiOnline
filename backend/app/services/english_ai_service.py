import json
import logging
import re
import difflib
from datetime import datetime
from typing import Dict, List, Any, Optional, Set

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.english_learning import (
    EnglishRoadmapResponse,
    EnglishUnitDetailResponse,
    ExerciseOption,
    MultimodalExercise,
    PronunciationEvalRequest,
    PronunciationEvalResponse,
    SpeakingPrompt,
    TopicUnitSummary,
    VocabFlashcard,
    WordScoreDetail,
)
from app.services.gemini_service import GeminiKnowledgeService

logger = logging.getLogger(__name__)

# Global in-memory store for AI-generated custom units
CUSTOM_UNITS_STORE: Dict[int, EnglishUnitDetailResponse] = {}
# Global in-memory store for completed units (unit_id -> score)
COMPLETED_UNITS_STORE: Dict[int, float] = {2: 92.0}

# 31 Engaging Rotating Daily Curriculum Themes (One for every day of the month)
DAILY_THEMES = [
    {"en": "Animals & Pets", "vi": "Động vật hoang dã & Thú cưng"},
    {"en": "Delicious Food & Drinks", "vi": "Món ăn & Đồ uống yêu thích"},
    {"en": "School Life & Classroom", "vi": "Trường học & Đồ dùng học tập"},
    {"en": "My Lovely Home & Rooms", "vi": "Ngôi nhà & Đồ nội thất"},
    {"en": "Weather & Four Seasons", "vi": "Thời tiết & Bốn mùa trong năm"},
    {"en": "Family & Relatives", "vi": "Gia đình & Người thân yêu"},
    {"en": "Sports & Outdoor Activities", "vi": "Thể thao & Trò chơi vận động"},
    {"en": "Jobs & Dream Careers", "vi": "Nghề nghiệp trong tương lai"},
    {"en": "Clothes & Daily Outfits", "vi": "Trang phục & Quần áo"},
    {"en": "Fresh Fruits & Vegetables", "vi": "Trái cây & Rau củ quả tươi"},
    {"en": "City Life & Transportation", "vi": "Thành phố & Phương tiện giao thông"},
    {"en": "Beach & Summer Vacation", "vi": "Kỳ nghỉ bãi biển & Mùa hè"},
    {"en": "Feelings & Emotions", "vi": "Cảm xúc & Tâm trạng con người"},
    {"en": "Body Parts & Healthy Habits", "vi": "Các bộ phận cơ thể & Sức khỏe"},
    {"en": "Hobbies & Leisure Time", "vi": "Sở thích & Thời gian rảnh rỗi"},
    {"en": "Nature & Green Forest", "vi": "Thiên nhiên & Rừng xanh kỳ thú"},
    {"en": "Space & Solar System", "vi": "Vũ trụ & Các hành tinh"},
    {"en": "Birthday Party & Celebrations", "vi": "Tiệc sinh nhật & Lễ hội"},
    {"en": "Music & Musical Instruments", "vi": "Âm nhạc & Các loại nhạc cụ"},
    {"en": "A Day at the Zoo", "vi": "Chuyến dạo chơi Vườn bách thú"},
    {"en": "Life on the Farm", "vi": "Nông trại miền quê & Động vật nuôi"},
    {"en": "Supermarket & Shopping Time", "vi": "Đi siêu thị & Mua sắm"},
    {"en": "Daily Routines & Time", "vi": "Thói quen sinh hoạt & Thời gian"},
    {"en": "Ocean Wonders & Marine Life", "vi": "Đại dương & Sinh vật biển"},
    {"en": "Playground & Fun Park", "vi": "Công viên & Trò chơi giải trí"},
    {"en": "Kitchen & Cooking Fun", "vi": "Nhà bếp & Nấu ăn gia đình"},
    {"en": "Toys & Fun Games", "vi": "Đồ chơi & Trò chơi tuổi thơ"},
    {"en": "Fun Science & Experiments", "vi": "Khoa học vui & Thí nghiệm kỳ thú"},
    {"en": "Camping & Picnic Adventure", "vi": "Cắm trại & Thám hiểm thiên nhiên"},
    {"en": "Countries & World Cultures", "vi": "Các quốc gia & Du lịch thế giới"},
    {"en": "Flowers & Beautiful Garden", "vi": "Khu vườn hoa & Cây cối xanh tươi"},
]

# Curated High-Quality Unsplash Image Mapping per Vocabulary Word (300+ Essential Words)
VOCAB_IMAGE_DATABASE: Dict[str, str] = {
    # Animals & Pets
    "dog": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&auto=format&fit=crop",
    "puppy": "https://images.unsplash.com/photo-1591160674255-ed8b80b57e74?w=500&auto=format&fit=crop",
    "cat": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop",
    "kitten": "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=500&auto=format&fit=crop",
    "bird": "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=500&auto=format&fit=crop",
    "parrot": "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=500&auto=format&fit=crop",
    "duck": "https://images.unsplash.com/photo-1555861496-0666c8981751?w=500&auto=format&fit=crop",
    "chicken": "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=500&auto=format&fit=crop",
    "rooster": "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=500&auto=format&fit=crop",
    "elephant": "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=500&auto=format&fit=crop",
    "tiger": "https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=500&auto=format&fit=crop",
    "lion": "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=500&auto=format&fit=crop",
    "bear": "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=500&auto=format&fit=crop",
    "panda": "https://images.unsplash.com/photo-1527118732049-c88155f2107c?w=500&auto=format&fit=crop",
    "monkey": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=500&auto=format&fit=crop",
    "giraffe": "https://images.unsplash.com/photo-1538099130811-745e64318258?w=500&auto=format&fit=crop",
    "zebra": "https://images.unsplash.com/photo-1501705388883-4ed8a543392c?w=500&auto=format&fit=crop",
    "rabbit": "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=500&auto=format&fit=crop",
    "deer": "https://images.unsplash.com/photo-1484406566174-9da000fda645?w=500&auto=format&fit=crop",
    "horse": "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=500&auto=format&fit=crop",
    "cow": "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=500&auto=format&fit=crop",
    "sheep": "https://images.unsplash.com/photo-1484557052118-f32bd25b45b5?w=500&auto=format&fit=crop",
    "pig": "https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=500&auto=format&fit=crop",
    "dolphin": "https://images.unsplash.com/photo-1570481662006-a3a1374699e8?w=500&auto=format&fit=crop",
    "whale": "https://images.unsplash.com/photo-1568430460464-02c1cd6a985b?w=500&auto=format&fit=crop",
    "shark": "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=500&auto=format&fit=crop",
    "fish": "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=500&auto=format&fit=crop",
    "turtle": "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=500&auto=format&fit=crop",
    "frog": "https://images.unsplash.com/photo-1563281577-a7be47e20db9?w=500&auto=format&fit=crop",
    "butterfly": "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500&auto=format&fit=crop",
    "bee": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&auto=format&fit=crop",
    "penguin": "https://images.unsplash.com/photo-1598439210625-5067c578f3f6?w=500&auto=format&fit=crop",
    "owl": "https://images.unsplash.com/photo-1574063413132-355dbfd83e25?w=500&auto=format&fit=crop",
    "crab": "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=500&auto=format&fit=crop",
    "octopus": "https://images.unsplash.com/photo-1545671913-b89ac1b4ac10?w=500&auto=format&fit=crop",
    "animal": "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=500&auto=format&fit=crop",
    "pet": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&auto=format&fit=crop",

    # Food & Drink & Fruits & Vegetables
    "apple": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop",
    "banana": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop",
    "orange": "https://images.unsplash.com/photo-1547514701-42782101795e?w=500&auto=format&fit=crop",
    "lemon": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&auto=format&fit=crop",
    "grape": "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=500&auto=format&fit=crop",
    "strawberry": "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=500&auto=format&fit=crop",
    "watermelon": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=500&auto=format&fit=crop",
    "pineapple": "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=500&auto=format&fit=crop",
    "mango": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&auto=format&fit=crop",
    "tomato": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop",
    "potato": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop",
    "carrot": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&auto=format&fit=crop",
    "corn": "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=500&auto=format&fit=crop",
    "bread": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop",
    "rice": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop",
    "noodle": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop",
    "pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop",
    "burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop",
    "sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop",
    "cake": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop",
    "cookie": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop",
    "chocolate": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=500&auto=format&fit=crop",
    "ice cream": "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500&auto=format&fit=crop",
    "cheese": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=500&auto=format&fit=crop",
    "egg": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop",
    "breakfast": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&auto=format&fit=crop",
    "lunch": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop",
    "dinner": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop",
    "milk": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop",
    "water": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop",
    "juice": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop",
    "tea": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop",
    "soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop",
    "food": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop",

    # School & Education
    "classroom": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop",
    "school": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop",
    "student": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=500&auto=format&fit=crop",
    "teacher": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=500&auto=format&fit=crop",
    "book": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&auto=format&fit=crop",
    "notebook": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop",
    "pen": "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop",
    "pencil": "https://images.unsplash.com/photo-1585336261026-8f57857a2079?w=500&auto=format&fit=crop",
    "eraser": "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=500&auto=format&fit=crop",
    "ruler": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop",
    "backpack": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop",
    "bag": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop",
    "desk": "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500&auto=format&fit=crop",
    "chair": "https://images.unsplash.com/photo-1503602642458-232111445657?w=500&auto=format&fit=crop",
    "board": "https://images.unsplash.com/photo-1572935748466-300431053e01?w=500&auto=format&fit=crop",
    "library": "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=500&auto=format&fit=crop",
    "computer": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop",
    "science": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop",
    "clock": "https://images.unsplash.com/photo-1508057198894-247b23fe5ade?w=500&auto=format&fit=crop",
    "map": "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=500&auto=format&fit=crop",

    # Home & Living
    "house": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&auto=format&fit=crop",
    "home": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&auto=format&fit=crop",
    "room": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop",
    "bedroom": "https://images.unsplash.com/photo-1540518614846-7ede433c457b?w=500&auto=format&fit=crop",
    "living room": "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=500&auto=format&fit=crop",
    "kitchen": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop",
    "bathroom": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&auto=format&fit=crop",
    "bed": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500&auto=format&fit=crop",
    "table": "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=500&auto=format&fit=crop",
    "sofa": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&auto=format&fit=crop",
    "door": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop",
    "window": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop",
    "television": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=500&auto=format&fit=crop",
    "fridge": "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=500&auto=format&fit=crop",
    "garden": "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500&auto=format&fit=crop",

    # Family & People
    "family": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
    "parents": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
    "father": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop",
    "mother": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop",
    "brother": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
    "sister": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
    "baby": "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=500&auto=format&fit=crop",
    "friend": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
    "friendly": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",

    # Clothes & Fashion
    "clothes": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=500&auto=format&fit=crop",
    "shirt": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop",
    "dress": "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop",
    "skirt": "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=500&auto=format&fit=crop",
    "pants": "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500&auto=format&fit=crop",
    "jacket": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop",
    "hat": "https://images.unsplash.com/photo-1534215754734-18e55d13e346?w=500&auto=format&fit=crop",
    "cap": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop",
    "shoes": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop",
    "boots": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop",
    "socks": "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=500&auto=format&fit=crop",
    "glasses": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&auto=format&fit=crop",
    "umbrella": "https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?w=500&auto=format&fit=crop",

    # Transportation & Travel
    "car": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=500&auto=format&fit=crop",
    "bus": "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=500&auto=format&fit=crop",
    "bicycle": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop",
    "bike": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop",
    "train": "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=500&auto=format&fit=crop",
    "plane": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&auto=format&fit=crop",
    "airplane": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&auto=format&fit=crop",
    "flight": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&auto=format&fit=crop",
    "boat": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&auto=format&fit=crop",
    "ship": "https://images.unsplash.com/photo-1505705694340-019e1e335916?w=500&auto=format&fit=crop",
    "airport": "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=500&auto=format&fit=crop",
    "passport": "https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&auto=format&fit=crop",
    "hotel": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop",
    "luggage": "https://images.unsplash.com/photo-1581553680321-4fffae59febd?w=500&auto=format&fit=crop",
    "beach": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop",

    # Nature & Weather
    "weather": "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=500&auto=format&fit=crop",
    "sunny": "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=500&auto=format&fit=crop",
    "sun": "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=500&auto=format&fit=crop",
    "rainy": "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=500&auto=format&fit=crop",
    "rain": "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=500&auto=format&fit=crop",
    "cloudy": "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=500&auto=format&fit=crop",
    "cloud": "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=500&auto=format&fit=crop",
    "snowy": "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=500&auto=format&fit=crop",
    "snow": "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=500&auto=format&fit=crop",
    "season": "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=500&auto=format&fit=crop",
    "forest": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&auto=format&fit=crop",
    "flower": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=500&auto=format&fit=crop",
    "rose": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop",
    "tree": "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=500&auto=format&fit=crop",
    "mountain": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop",
    "river": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&auto=format&fit=crop",
    "sea": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop",
    "ocean": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop",
    "lake": "https://images.unsplash.com/photo-1439853941329-a9f239bd9f1a?w=500&auto=format&fit=crop",
    "sky": "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=500&auto=format&fit=crop",
    "moon": "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=500&auto=format&fit=crop",
    "star": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop",
    "space": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop",
    "planet": "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=500&auto=format&fit=crop",

    # Jobs & Careers
    "doctor": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop",
    "nurse": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop",
    "dentist": "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=500&auto=format&fit=crop",
    "pilot": "https://images.unsplash.com/photo-1508672019048-805479760c2d?w=500&auto=format&fit=crop",
    "farmer": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=500&auto=format&fit=crop",
    "chef": "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=500&auto=format&fit=crop",
    "cook": "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=500&auto=format&fit=crop",
    "singer": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
    "artist": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500&auto=format&fit=crop",
    "driver": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=500&auto=format&fit=crop",

    # Sports & Hobbies
    "football": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop",
    "soccer": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop",
    "basketball": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&auto=format&fit=crop",
    "swimming": "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=500&auto=format&fit=crop",
    "running": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=500&auto=format&fit=crop",
    "music": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
    "guitar": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
    "piano": "https://images.unsplash.com/photo-1520523839898-50712140e691?w=500&auto=format&fit=crop",
    "drums": "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=500&auto=format&fit=crop",
    "toy": "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=500&auto=format&fit=crop",
    "game": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop",
    "robot": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop",

    # Health & Feelings
    "happy": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&auto=format&fit=crop",
    "sad": "https://images.unsplash.com/photo-1516585427167-9f4af9627e6c?w=500&auto=format&fit=crop",
    "tired": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop",
    "healthy": "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500&auto=format&fit=crop",
    "hospital": "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=500&auto=format&fit=crop",
    "exercise": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop",
}

# Guaranteed Distinct Curated Unsplash Images for Fallback (So no 2 words in a unit ever share an image)
DISTINCT_FALLBACK_IMAGES: List[str] = [
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=500&auto=format&fit=crop", # colorful crayons
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&auto=format&fit=crop", # book stack
    "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=500&auto=format&fit=crop", # open library
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=500&auto=format&fit=crop", # study desk
    "https://images.unsplash.com/photo-1491841573634-28140fc7ced7?w=500&auto=format&fit=crop", # creative learning
    "https://images.unsplash.com/photo-1588072432836-e10032774350?w=500&auto=format&fit=crop", # classroom learning
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&auto=format&fit=crop", # student reading
    "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=500&auto=format&fit=crop", # arts and craft
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500&auto=format&fit=crop", # team project
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&auto=format&fit=crop", # textbook
]

def get_accurate_vocab_image(
    word: str,
    topic: str = "",
    index: int = 0,
    used_urls: Optional[Set[str]] = None,
) -> str:
    """Helper to match vocabulary word with distinct, high-quality Unsplash picture."""
    if used_urls is None:
        used_urls = set()

    w_clean = re.sub(r"[^\w]", "", word.lower().strip())
    # Singularize common English plurals for accurate lookup
    if w_clean.endswith("ies") and len(w_clean) > 4:
        w_clean = w_clean[:-3] + "y"
    elif w_clean.endswith("es") and len(w_clean) > 3:
        w_clean = w_clean[:-2]
    elif w_clean.endswith("s") and len(w_clean) > 2 and not w_clean.endswith("ss"):
        w_clean = w_clean[:-1]

    # 1. Exact match in database
    if w_clean in VOCAB_IMAGE_DATABASE and VOCAB_IMAGE_DATABASE[w_clean] not in used_urls:
        url = VOCAB_IMAGE_DATABASE[w_clean]
        used_urls.add(url)
        return url

    # 2. Substring match
    for k, u in VOCAB_IMAGE_DATABASE.items():
        if (k in w_clean or w_clean in k) and u not in used_urls:
            used_urls.add(u)
            return u

    # 3. Pick unused distinct image from fallback pool
    for u in DISTINCT_FALLBACK_IMAGES:
        if u not in used_urls:
            used_urls.add(u)
            return u

    # 4. Modulo fallback if all pool exhausted
    fallback = DISTINCT_FALLBACK_IMAGES[index % len(DISTINCT_FALLBACK_IMAGES)]
    used_urls.add(fallback)
    return fallback


# Sample SGK GDPT 2018 Curriculum Units for Grade 4 - 9
ENGLISH_CURRICULUM_UNITS = [
    {
        "id": 1,
        "title": "Unit 1: My Family & Friends",
        "topic": "Family & Relationships",
        "grade": 5,
        "description": "Học từ vựng và câu về gia đình, bạn bè, nghề nghiệp và hoạt động hàng ngày.",
        "flashcards": [
            {
                "id": 101,
                "word": "family",
                "part_of_speech": "noun",
                "ipa": "/ˈfæm.əl.i/",
                "meaning": "gia đình",
                "image_url": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=500&auto=format&fit=crop",
                "audio_text": "family",
                "example_sentence": "I love spending weekends with my family.",
                "example_translation": "Tôi thích dành thời gian cuối tuần bên gia đình."
            },
            {
                "id": 102,
                "word": "teacher",
                "part_of_speech": "noun",
                "ipa": "/ˈtiː.tʃər/",
                "meaning": "giáo viên",
                "image_url": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=500&auto=format&fit=crop",
                "audio_text": "teacher",
                "example_sentence": "My English teacher is very kind and patient.",
                "example_translation": "Giáo viên Tiếng Anh của tôi rất tốt bụng và kiên nhẫn."
            },
            {
                "id": 103,
                "word": "doctor",
                "part_of_speech": "noun",
                "ipa": "/ˈdɒk.tər/",
                "meaning": "bác sĩ",
                "image_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop",
                "audio_text": "doctor",
                "example_sentence": "His mother is a doctor at the city hospital.",
                "example_translation": "Mẹ của anh ấy là bác sĩ ở bệnh viện thành phố."
            },
            {
                "id": 104,
                "word": "friendly",
                "part_of_speech": "adjective",
                "ipa": "/ˈfrend.li/",
                "meaning": "thân thiện",
                "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop",
                "audio_text": "friendly",
                "example_sentence": "Nam is a very friendly classmate.",
                "example_translation": "Nam là một người bạn cùng lớp rất thân thiện."
            }
        ],
        "exercises": [
            {
                "id": 201,
                "exercise_type": "MATCH_IMAGE",
                "prompt": "Từ vựng nào miêu tả nghề nghiệp 'bác sĩ' trong bức tranh?",
                "media_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop",
                "audio_text": "Choose the word for doctor",
                "options": [
                    {"option_key": "A", "content": "Teacher"},
                    {"option_key": "B", "content": "Doctor"},
                    {"option_key": "C", "content": "Engineer"},
                    {"option_key": "D", "content": "Driver"}
                ],
                "correct_answer": "B",
                "explanation": "'Doctor' có nghĩa là bác sĩ, phù hợp với bức tranh bệnh viện."
            },
            {
                "id": 202,
                "exercise_type": "LISTEN_SELECT",
                "prompt": "Nghe phát âm từ vựng và chọn từ Tiếng Anh chính xác:",
                "audio_text": "family",
                "options": [
                    {"option_key": "A", "content": "Family"},
                    {"option_key": "B", "content": "Famous"},
                    {"option_key": "C", "content": "Farmer"},
                    {"option_key": "D", "content": "Father"}
                ],
                "correct_answer": "A",
                "explanation": "Đoạn âm thanh vừa phát từ 'family' (/ˈfæm.əl.i/)."
            },
            {
                "id": 203,
                "exercise_type": "WORD_TYPING",
                "prompt": "✍️ Luyện gõ chính tả: Nghe phát âm hoặc nhìn nghĩa 'bác sĩ', hãy gõ chính xác từ Tiếng Anh:",
                "audio_text": "doctor",
                "options": [],
                "correct_answer": "doctor",
                "explanation": "Từ Tiếng Anh chính xác cho 'bác sĩ' là 'doctor' (d-o-c-t-o-r)."
            },
            {
                "id": 204,
                "exercise_type": "FILL_BLANK",
                "prompt": "📝 Điền từ còn thiếu vào câu: 'Nam is a very _____ classmate.' (Nghĩa: Nam là một bạn học rất thân thiện)",
                "audio_text": "friendly",
                "options": [],
                "correct_answer": "friendly",
                "explanation": "Từ còn thiếu là 'friendly' (f-r-i-e-n-d-l-y)."
            }
        ],
        "speaking_prompts": [
            {
                "id": 301,
                "target_text": "My family lives in a beautiful house.",
                "ipa": "/maɪ ˈfæm.əl.i lɪvz ɪn ə ˈbjuː.tɪ.fəl haʊs/",
                "meaning": "Gia đình tôi sống trong một ngôi nhà đẹp.",
                "tip": "Chú ý phát âm rõ âm đuôi /z/ trong từ 'lives' và /s/ trong từ 'house'."
            },
            {
                "id": 302,
                "target_text": "She is a kind teacher.",
                "ipa": "/ʃiː ɪz ə kaɪnd ˈtiː.tʃər/",
                "meaning": "Cô ấy là một giáo viên tốt bụng.",
                "tip": "Đọc nối âm nhẹ giữa 'is' và 'a'."
            }
        ]
    },
    {
        "id": 2,
        "title": "Unit 2: School Life & Subjects",
        "topic": "School & Education",
        "grade": 5,
        "description": "Từ vựng về các môn học, dụng cụ học tập và các hoạt động tại trường học.",
        "flashcards": [
            {
                "id": 105,
                "word": "classroom",
                "part_of_speech": "noun",
                "ipa": "/ˈklɑːs.ruːm/",
                "meaning": "lớp học",
                "image_url": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop",
                "audio_text": "classroom",
                "example_sentence": "Our classroom is bright and clean.",
                "example_translation": "Lớp học của chúng tôi rất sáng sủa và sạch sẽ."
            },
            {
                "id": 106,
                "word": "science",
                "part_of_speech": "noun",
                "ipa": "/ˈsaɪ.əns/",
                "meaning": "môn khoa học",
                "image_url": "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop",
                "audio_text": "science",
                "example_sentence": "We conduct fun experiments in science class.",
                "example_translation": "Chúng tôi làm các thí nghiệm thú vị trong giờ khoa học."
            }
        ],
        "exercises": [
            {
                "id": 204,
                "exercise_type": "LISTEN_SELECT",
                "prompt": "Nghe âm thanh và chọn môn học đúng:",
                "audio_text": "science",
                "options": [
                    {"option_key": "A", "content": "Math"},
                    {"option_key": "B", "content": "Science"},
                    {"option_key": "C", "content": "English"},
                    {"option_key": "D", "content": "History"}
                ],
                "correct_answer": "B",
                "explanation": "Đoạn phát âm là 'science' (/ˈsaɪ.əns/)."
            }
        ],
        "speaking_prompts": [
            {
                "id": 303,
                "target_text": "We study English every day.",
                "ipa": "/wiː ˈstʌd.i ˈɪŋ.ɡlɪʃ ˈev.ri deɪ/",
                "meaning": "Chúng tôi học Tiếng Anh mỗi ngày.",
                "tip": "Phát âm chuẩn âm /ʃ/ ở cuối từ 'English'."
            }
        ]
    }
]


class EnglishAIService:
    """Service to handle Multimodal English Learning Hub, interactive roadmap, & AI Speech Recognition Evaluation."""

    @classmethod
    def get_roadmap(cls, db: Session, student: User, subject: Optional[str] = None) -> EnglishRoadmapResponse:
        grade = student.grade if student.grade and 4 <= student.grade <= 9 else 5
        student_name = student.full_name or "Học sinh"

        units_summary: List[TopicUnitSummary] = []
        completed_count = 0

        for u in ENGLISH_CURRICULUM_UNITS:
            u_id = u["id"]
            is_comp = u_id in COMPLETED_UNITS_STORE
            if is_comp:
                completed_count += 1
            units_summary.append(
                TopicUnitSummary(
                    id=u_id,
                    title=u["title"],
                    topic=u["topic"],
                    vocab_count=len(u.get("flashcards", [])),
                    exercise_count=len(u.get("exercises", [])),
                    status="COMPLETED" if is_comp else "AVAILABLE",
                    score=COMPLETED_UNITS_STORE.get(u_id) if is_comp else None,
                )
            )

        # Include custom generated AI units from memory store
        for custom_unit in CUSTOM_UNITS_STORE.values():
            u_id = custom_unit.unit_id
            is_comp = u_id in COMPLETED_UNITS_STORE
            if is_comp:
                completed_count += 1
            units_summary.append(
                TopicUnitSummary(
                    id=u_id,
                    title=custom_unit.title,
                    topic=custom_unit.topic,
                    vocab_count=len(custom_unit.flashcards),
                    exercise_count=len(custom_unit.exercises),
                    status="COMPLETED" if is_comp else "AVAILABLE",
                    score=COMPLETED_UNITS_STORE.get(u_id) if is_comp else None,
                )
            )

        advice = (
            f"🎧 **AI Coach Tiếng Anh (8 Phút Hàng Ngày) cho {student_name}**:\n"
            f"Bạn đã hoàn thành {completed_count}/{len(units_summary)} bài học! "
            f"Hãy bấm nút '🚀 Bắt Đầu Học Ngay (8 Phút Mới)' để luyện tập bộ từ vựng & phát âm AI mới hôm nay nhé!"
        )

        return EnglishRoadmapResponse(
            grade=grade,
            student_name=student_name,
            overall_vocabulary_score=88.5,
            overall_listening_score=82.0,
            overall_speaking_score=78.0,
            overall_grammar_score=84.0,
            completed_units_count=completed_count,
            total_units_count=len(units_summary),
            units=units_summary,
            ai_daily_coaching_advice=advice,
        )

    @classmethod
    def complete_unit(cls, unit_id: int, score: float = 100.0) -> Dict[str, Any]:
        COMPLETED_UNITS_STORE[unit_id] = round(score, 1)
        logger.info(f"Đã chuyển trạng thái bài học Tiếng Anh {unit_id} thành COMPLETED ({score}%)")
        return {
            "message": f"Bài học {unit_id} đã chuyển trạng thái Đã hoàn thành ({score}%)",
            "unit_id": unit_id,
            "status": "COMPLETED",
            "score": score,
        }

    @classmethod
    def get_unit_detail(cls, unit_id: int) -> EnglishUnitDetailResponse:
        # Check custom generated units in memory store first
        if unit_id in CUSTOM_UNITS_STORE:
            return CUSTOM_UNITS_STORE[unit_id]

        unit = next((u for u in ENGLISH_CURRICULUM_UNITS if u["id"] == unit_id), None)
        if not unit:
            unit = ENGLISH_CURRICULUM_UNITS[0]

        flashcards = [VocabFlashcard(**f) for f in unit.get("flashcards", [])]
        exercises = []
        for ex in unit.get("exercises", []):
            opts = [ExerciseOption(**o) for o in ex.get("options", [])]
            exercises.append(
                MultimodalExercise(
                    id=ex["id"],
                    exercise_type=ex["exercise_type"],
                    prompt=ex["prompt"],
                    media_url=ex.get("media_url"),
                    audio_text=ex.get("audio_text"),
                    options=opts,
                    correct_answer=ex["correct_answer"],
                    explanation=ex["explanation"],
                )
            )

        return EnglishUnitDetailResponse(
            unit_id=unit["id"],
            title=unit["title"],
            topic=unit["topic"],
            grade=unit["grade"],
            description=unit["description"],
            flashcards=flashcards,
            exercises=exercises,
            speaking_prompts=unit.get("speaking_prompts", []),
        )

    @classmethod
    def evaluate_pronunciation(cls, req: PronunciationEvalRequest) -> PronunciationEvalResponse:
        target = req.target_text.strip()
        spoken = req.spoken_text.strip()

        def clean_word(w: str) -> str:
            w_sub = re.sub(r"[^\w\s']", "", w.lower()).strip()
            contractions = {
                "dont": "do not", "cant": "cannot", "isnt": "is not",
                "arent": "are not", "wont": "will not", "im": "i am",
                "hes": "he is", "shes": "she is", "its": "it is",
                "theyre": "they are", "youre": "you are", "weve": "we have",
            }
            return contractions.get(w_sub, w_sub)

        def get_words(text: str) -> List[str]:
            return [clean_word(w) for w in re.findall(r"\b[\w']+\b", text.lower()) if clean_word(w)]

        target_words = get_words(target)
        spoken_words = get_words(spoken)

        if not target_words:
            return PronunciationEvalResponse(
                target_text=target,
                spoken_text=spoken,
                score=100.0,
                accuracy_level="EXCELLENT",
                feedback="Phát âm rất xuất sắc!",
                word_details=[],
            )

        word_details: List[WordScoreDetail] = []
        correct_count = 0.0

        for tw in target_words:
            best_match_ratio = 0.0
            for sw in spoken_words:
                if tw == sw:
                    best_match_ratio = 1.0
                    break
                ratio = difflib.SequenceMatcher(None, tw, sw).ratio()
                if ratio > best_match_ratio:
                    best_match_ratio = ratio

            if best_match_ratio >= 0.8:
                is_correct = True
                confidence = round(best_match_ratio, 2)
                correct_count += 1.0
            elif best_match_ratio >= 0.6:
                is_correct = True
                confidence = round(best_match_ratio, 2)
                correct_count += 0.85
            else:
                is_correct = False
                confidence = round(best_match_ratio, 2)

            word_details.append(WordScoreDetail(word=tw, is_correct=is_correct, confidence=confidence))

        score = round((correct_count / len(target_words)) * 100.0, 1)
        score = min(100.0, score)

        if score >= 85.0:
            level = "EXCELLENT"
            feedback = f"🎉 Tuyệt vời! Bạn đã phát âm chính xác {score}% câu. Ngữ điệu rất tự nhiên!"
        elif score >= 60.0:
            level = "GOOD"
            feedback = f"👍 Khá tốt ({score}%). Chú ý nhấn đúng trọng âm và phát âm rõ các từ chưa chính xác nhé!"
        else:
            level = "NEED_PRACTICE"
            feedback = f"💪 Đạt {score}%. Hãy bấm nghe loa mẫu phát âm lại 2 lần và thử đọc lại từng từ chậm rãi nhé!"

        return PronunciationEvalResponse(
            target_text=target,
            spoken_text=spoken,
            score=score,
            accuracy_level=level,
            feedback=feedback,
            word_details=word_details,
        )

    @classmethod
    def _resolve_daily_curriculum_topic(cls, raw_topic: str) -> str:
        """Resolves generic daily practice requests to rich rotating calendar themes."""
        raw_clean = raw_topic.strip()
        t_low = raw_clean.lower()
        if (
            not raw_clean
            or "thử thách tiếng anh 8 phút" in t_low
            or "bài 8 phút" in t_low
            or "bài học 8 phút" in t_low
            or "general practice" in t_low
        ):
            day_of_year = datetime.now().timetuple().tm_yday
            theme_idx = (day_of_year + len(CUSTOM_UNITS_STORE)) % len(DAILY_THEMES)
            theme = DAILY_THEMES[theme_idx]
            return f"{theme['vi']} ({theme['en']})"
        return raw_clean

    @classmethod
    def generate_custom_unit(cls, req: Any) -> EnglishUnitDetailResponse:
        raw_topic = req.topic.strip() if req.topic else ""
        topic_title = cls._resolve_daily_curriculum_topic(raw_topic)
        grade = req.grade if 4 <= req.grade <= 9 else 5
        custom_id = 900 + len(CUSTOM_UNITS_STORE) + 1

        # Try Gemini AI Generation first
        ai_res = cls._generate_with_gemini(topic_title=topic_title, grade=grade, custom_id=custom_id)
        if not ai_res:
            ai_res = cls._generate_topic_aware_fallback(topic_title=topic_title, grade=grade, custom_id=custom_id)

        # Cache custom unit in memory store
        CUSTOM_UNITS_STORE[custom_id] = ai_res
        return ai_res

    @classmethod
    def _generate_with_gemini(cls, topic_title: str, grade: int, custom_id: int) -> Optional[EnglishUnitDetailResponse]:
        if not GeminiKnowledgeService.is_gemini_configured():
            return None

        api_key = settings.GEMINI_API_KEY.strip()
        grade_speaking_rule = (
            f"QUY TẮC BẮT BUỘC CHO LỚP {grade}:\n"
            f"- Học sinh Lớp {grade} (Tiểu học): Các câu mẫu luyện nói PHẢI NGẮN, ĐƠN GIẢN từ 3 đến 5 từ (ví dụ: 'I love my school.', 'This cat is cute.').\n"
            if grade <= 5 else
            f"- Học sinh Lớp {grade} (THCS): Các câu mẫu luyện nói từ 5 đến 8 từ tự nhiên, dễ hiểu."
        )

        prompt = f"""Bạn là chuyên gia thiết kế bài học Tiếng Anh AI chuẩn GDPT 2018 cho học sinh Lớp {grade} tại Việt Nam.
Hãy biên soạn 1 bài học Tiếng Anh Đa Phương Thức AI 8 Phút hoàn chỉnh cho chủ đề: "{topic_title}".

YÊU CẦU ĐẶC BIỆT:
1. Chọn đúng 6 từ vựng (flashcards) cụ thể, sinh động, chuẩn chương trình Tiểu học/THCS liên quan đến chủ đề "{topic_title}".
   - TUYỆT ĐỐI KHÔNG chọn các từ trừu tượng (như: Challenge, Goal, Success, Practice, Focus, Smart).
   - Hãy chọn các từ đồ vật, con vật, thức ăn, địa điểm, nghề nghiệp trực quan, dễ liên tưởng qua tranh ảnh.
2. Tạo đúng 8 bài tập trắc nghiệm & điền từ (exercises):
   - 2 bài MATCH_IMAGE (Nối từ với hình ảnh): Đáp án đúng phải là 1 trong các từ vựng vừa dạy.
   - 2 bài LISTEN_SELECT (Nghe chọn đáp án)
   - 2 bài WORD_TYPING (Gõ chính tả)
   - 2 bài FILL_BLANK (Điền từ còn thiếu vào câu)
3. Tạo đúng 4 câu Luyện nói (speaking_prompts).

{grade_speaking_rule}

Cấu trúc JSON bắt buộc:
{{
  "title": "Unit: {topic_title}",
  "topic": "{topic_title}",
  "description": "Bài học Tiếng Anh AI 8 phút tự sinh chủ đề {topic_title}.",
  "flashcards": [
    {{
      "word": "từ Tiếng Anh 1",
      "part_of_speech": "noun",
      "ipa": "/phát âm IPA/",
      "meaning": "Nghĩa Tiếng Việt",
      "audio_text": "từ phát âm",
      "example_sentence": "Ví dụ câu Tiếng Anh",
      "example_translation": "Dịch nghĩa ví dụ Tiếng Việt"
    }}
  ],
  "exercises": [
    {{
      "exercise_type": "MATCH_IMAGE",
      "prompt": "Từ vựng nào miêu tả đúng hình ảnh?",
      "audio_text": "Choose the word",
      "options": [
        {{"option_key": "A", "content": "Đáp án 1"}},
        {{"option_key": "B", "content": "Đáp án 2"}},
        {{"option_key": "C", "content": "Đáp án 3"}},
        {{"option_key": "D", "content": "Đáp án 4"}}
      ],
      "correct_answer": "A",
      "explanation": "Giải thích..."
    }}
  ],
  "speaking_prompts": [
    {{
      "target_text": "Câu nói Tiếng Anh 1.",
      "ipa": "/phát âm IPA/",
      "meaning": "Dịch nghĩa",
      "tip": "Mẹo nhấn âm"
    }}
  ]
}}

CHỈ TRẢ VỀ VĂN BẢN JSON HỢP LỆ."""

        models_to_try = [
            settings.GEMINI_MODEL,
            "gemini-2.5-flash",
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
            "gemini-flash-latest",
        ]
        models_to_try = list(dict.fromkeys([m.strip() for m in models_to_try if m and m.strip()]))

        with httpx.Client(timeout=30.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.85,
                        "responseMimeType": "application/json",
                    },
                }
                try:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            cleaned = re.sub(r"^```(?:json)?\s*", "", text_content.strip(), flags=re.IGNORECASE)
                            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                            ai_dict = None
                            try:
                                ai_dict = json.loads(cleaned)
                            except Exception:
                                match_obj = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
                                if match_obj:
                                    raw_json = match_obj.group(1).strip()
                                    try:
                                        ai_dict = json.loads(raw_json)
                                    except Exception:
                                        fixed_json = re.sub(r",\s*([\}\]])", r"", raw_json)
                                        try:
                                            ai_dict = json.loads(fixed_json)
                                        except Exception:
                                            ai_dict = None

                            if not isinstance(ai_dict, dict):
                                continue

                            raw_flashcards = ai_dict.get("flashcards", [])
                            flashcards = []
                            used_images: Set[str] = set()
                            word_image_map: Dict[str, str] = {}

                            for idx, f in enumerate(raw_flashcards):
                                word_val = f.get("word", f"word_{idx}")
                                accurate_img = get_accurate_vocab_image(
                                    word=word_val,
                                    topic=topic_title,
                                    index=idx,
                                    used_urls=used_images,
                                )
                                word_image_map[word_val.lower().strip()] = accurate_img
                                f["image_url"] = accurate_img
                                flashcards.append(VocabFlashcard(id=custom_id * 10 + idx, **f))

                            raw_exercises = ai_dict.get("exercises", [])
                            exercises = []
                            for idx, ex in enumerate(raw_exercises):
                                opts = [ExerciseOption(**o) for o in ex.get("options", [])]
                                ex_type = ex.get("exercise_type", "LISTEN_SELECT")
                                corr_ans = ex.get("correct_answer", "A")

                                # Post process media url for MATCH_IMAGE to align with the correct answer
                                media_url = ex.get("media_url")
                                if ex_type == "MATCH_IMAGE":
                                    matched_content = next((o.content for o in opts if o.option_key == corr_ans), "")
                                    w_key = matched_content.lower().strip()
                                    media_url = word_image_map.get(w_key) or get_accurate_vocab_image(
                                        word=matched_content or topic_title,
                                        topic=topic_title,
                                        index=idx,
                                        used_urls=used_images,
                                    )

                                exercises.append(
                                    MultimodalExercise(
                                        id=custom_id * 20 + idx,
                                        exercise_type=ex_type,
                                        prompt=ex.get("prompt", ""),
                                        media_url=media_url,
                                        audio_text=ex.get("audio_text"),
                                        options=opts,
                                        correct_answer=corr_ans,
                                        explanation=ex.get("explanation", ""),
                                    )
                                )

                            speaking_prompts = [
                                SpeakingPrompt(id=custom_id * 30 + idx, **sp)
                                for idx, sp in enumerate(ai_dict.get("speaking_prompts", []))
                            ]

                            return EnglishUnitDetailResponse(
                                unit_id=custom_id,
                                title=ai_dict.get("title", f"AI Unit: {topic_title}"),
                                topic=ai_dict.get("topic", topic_title),
                                grade=grade,
                                description=ai_dict.get("description", f"Bài học Tiếng Anh AI 8 Phút cho chủ đề {topic_title}"),
                                flashcards=flashcards,
                                exercises=exercises,
                                speaking_prompts=speaking_prompts,
                            )
                except Exception as e:
                    logger.warning(f"Lỗi khi gọi Gemini ({model_name}) tạo bài học Tiếng Anh: {e}")
        return None

    @classmethod
    def _generate_topic_aware_fallback(cls, topic_title: str, grade: int, custom_id: int) -> EnglishUnitDetailResponse:
        """31 Rich Rotating Daily Topics & Vocabulary Pools to prevent word and topic repetition."""
        t_lower = topic_title.lower()

        # 31 Comprehensive Vocabulary & Exercise Pools (One for each day of the month)
        TOPIC_POOLS = [
            # Day 1: Animals & Pets
            {
                "topic": "Động vật hoang dã & Thú cưng",
                "words": [
                    ("dog", "noun", "/dɒɡ/", "con chó", "The dog wags its tail happily.", "Chú chó vẫy đuôi vui mừng."),
                    ("cat", "noun", "/kæt/", "con mèo", "My cat likes sleeping in the sun.", "Con mèo của tôi thích ngủ dưới ánh nắng."),
                    ("elephant", "noun", "/ˈel.ɪ.fənt/", "con voi", "The elephant is the largest land animal.", "Con voi là loài động vật trên cạn to lớn nhất."),
                    ("tiger", "noun", "/ˈtaɪ.ɡər/", "con hổ", "The tiger runs very fast in the jungle.", "Con hổ chạy rất nhanh trong rừng nhiệt đới."),
                    ("rabbit", "noun", "/ˈræb.ɪt/", "con thỏ", "The white rabbit has long soft ears.", "Chú thỏ trắng có đôi tai dài mềm mại."),
                    ("dolphin", "noun", "/ˈdɒl.fɪn/", "cá heo", "Dolphins are smart and friendly.", "Cá heo rất thông minh và thân thiện."),
                ]
            },
            # Day 2: Delicious Food & Drinks
            {
                "topic": "Món ăn & Đồ uống yêu thích",
                "words": [
                    ("bread", "noun", "/bred/", "bánh mì", "We eat fresh bread for breakfast.", "Chúng tôi ăn bánh mì tươi vào bữa sáng."),
                    ("apple", "noun", "/ˈæp.əl/", "quả táo", "An apple a day keeps the doctor away.", "Mỗi ngày ăn một quả táo giúp cơ thể khỏe mạnh."),
                    ("pizza", "noun", "/ˈpiːt.sə/", "bánh pizza", "They ordered a cheese pizza for party.", "Họ đã đặt một chiếc bánh pizza phô mai cho bữa tiệc."),
                    ("milk", "noun", "/mɪlk/", "sữa tươi", "Drink warm milk before going to bed.", "Hãy uống sữa ấm trước khi đi ngủ."),
                    ("orange", "noun", "/ˈɒr.ɪndʒ/", "quả cam", "Oranges are rich in vitamin C.", "Quả cam chứa rất nhiều vitamin C."),
                    ("rice", "noun", "/raɪs/", "cơm / gạo", "Rice is a staple food in Vietnam.", "Cơm là món ăn chính tại Việt Nam."),
                ]
            },
            # Day 3: School Life & Classroom
            {
                "topic": "Trường học & Đồ dùng học tập",
                "words": [
                    ("classroom", "noun", "/ˈklɑːs.ruːm/", "lớp học", "Our classroom is bright and tidy.", "Lớp học của chúng tôi rất sáng sủa và ngăn nắp."),
                    ("teacher", "noun", "/ˈtiː.tʃər/", "thầy cô giáo", "The teacher guides students patiently.", "Cô giáo kiên nhẫn hướng dẫn học sinh."),
                    ("pencil", "noun", "/ˈpen.səl/", "bút chì", "Write your answer neatly with a pencil.", "Hãy viết câu trả lời ngay ngắn bằng bút chì."),
                    ("book", "noun", "/bʊk/", "quyển sách", "This English book has colorful pictures.", "Quyển sách Tiếng Anh này có hình ảnh rực rỡ."),
                    ("library", "noun", "/ˈlaɪ.brər.i/", "thư viện", "Students read books in the quiet library.", "Học sinh đọc sách trong thư viện yên tĩnh."),
                    ("student", "noun", "/ˈstjuː.dənt/", "học sinh", "Every student works hard for the exam.", "Mỗi học sinh đều chăm chỉ học cho kỳ thi."),
                ]
            },
            # Day 4: My Lovely Home & Rooms
            {
                "topic": "Ngôi nhà & Đồ nội thất",
                "words": [
                    ("house", "noun", "/haʊs/", "ngôi nhà", "Our house has a lovely garden in front.", "Ngôi nhà của chúng tôi có khu vườn xinh xắn phía trước."),
                    ("bedroom", "noun", "/ˈbed.ruːm/", "phòng ngủ", "My bedroom has a soft cozy bed.", "Phòng ngủ của tôi có chiếc giường êm ái ấm cúng."),
                    ("kitchen", "noun", "/ˈkɪtʃ.ɪn/", "nhà bếp", "Mother cooks tasty dishes in the kitchen.", "Mẹ nấu những món ăn ngon trong nhà bếp."),
                    ("living room", "noun", "/ˈlɪv.ɪŋ ˌruːm/", "phòng khách", "The family gathers in the living room.", "Cả gia đình quây quần trong phòng khách."),
                    ("table", "noun", "/ˈteɪ.bəl/", "cái bàn", "We put flower vases on the table.", "Chúng tôi đặt lọ hoa trên bàn."),
                    ("window", "noun", "/ˈwɪn.dəʊ/", "cửa sổ", "Open the window to let fresh air in.", "Hãy mở cửa sổ để đón không khí trong lành."),
                ]
            },
            # Day 5: Weather & Four Seasons
            {
                "topic": "Thời tiết & Bốn mùa trong năm",
                "words": [
                    ("weather", "noun", "/ˈweð.ər/", "thời tiết", "What is the weather like today?", "Thời tiết hôm nay thế nào?"),
                    ("sunny", "adjective", "/ˈsʌn.i/", "nắng đẹp", "It is warm and sunny this morning.", "Sáng nay trời ấm áp và đầy nắng."),
                    ("rainy", "adjective", "/ˈreɪ.ni/", "mưa", "Take an umbrella on rainy days.", "Hãy mang ô vào những ngày mưa."),
                    ("cloudy", "adjective", "/ˈklaʊ.di/", "nhiều mây", "The sky looks cool and cloudy.", "Bầu trời trông mát mẻ và nhiều mây."),
                    ("snowy", "adjective", "/ˈsnəʊ.i/", "có tuyết rơi", "Children build snowmen on snowy days.", "Trẻ em đắp người tuyết vào ngày có tuyết rơi."),
                    ("umbrella", "noun", "/ʌmˈbrel.ə/", "cây ô / dù", "She holds a bright yellow umbrella.", "Cô ấy cầm một cây ô màu vàng rực rỡ."),
                ]
            },
            # Day 6: Family & Relatives
            {
                "topic": "Gia đình & Người thân yêu",
                "words": [
                    ("family", "noun", "/ˈfæm.əl.i/", "gia đình", "My family loves spending time together.", "Gia đình tôi thích dành thời gian bên nhau."),
                    ("father", "noun", "/ˈfɑː.ðər/", "người bố", "My father teaches me how to ride a bike.", "Bố dạy tôi cách đi xe đạp."),
                    ("mother", "noun", "/ˈmʌð.ər/", "người mẹ", "My mother always cares for everyone.", "Mẹ luôn luôn chăm sóc chu đáo cho mọi người."),
                    ("brother", "noun", "/ˈbrʌð.ər/", "anh/em trai", "My brother is good at football.", "Anh trai tôi chơi bóng đá rất giỏi."),
                    ("sister", "noun", "/ˈsɪs.tər/", "chị/em gái", "My sister draws beautiful landscapes.", "Chị gái tôi vẽ tranh phong cảnh rất đẹp."),
                    ("parents", "noun", "/ˈpeə.rənts/", "bố mẹ", "I love and respect my parents dearly.", "Tôi vô cùng yêu thương và kính trọng bố mẹ."),
                ]
            },
            # Day 7: Sports & Outdoor Activities
            {
                "topic": "Thể thao & Trò chơi vận động",
                "words": [
                    ("football", "noun", "/ˈfʊt.bɔːl/", "bóng đá", "Boys play football in the schoolyard.", "Các bạn nam chơi bóng đá trong sân trường."),
                    ("basketball", "noun", "/ˈbɑː.skɪt.bɔːl/", "bóng rổ", "Basketball helps us grow taller.", "Môn bóng rổ giúp chúng ta phát triển chiều cao."),
                    ("swimming", "noun", "/ˈswɪm.ɪŋ/", "bơi lội", "Swimming is great exercise in summer.", "Bơi lội là bài tập rèn luyện tuyệt vời vào mùa hè."),
                    ("running", "noun", "/ˈrʌn.ɪŋ/", "chạy bộ", "Running every morning keeps us fit.", "Chạy bộ mỗi sáng giúp chúng ta khỏe khoắn."),
                    ("bicycle", "noun", "/ˈbaɪ.sɪ.kəl/", "xe đạp", "I ride my bicycle to school every day.", "Tôi đạp xe đạp đến trường mỗi ngày."),
                    ("exercise", "noun", "/ˈek.sə.saɪz/", "tập thể dục", "Daily exercise gives us energy.", "Tập thể dục hàng ngày mang lại cho ta nhiều năng lượng."),
                ]
            },
            # Day 8: Jobs & Dream Careers
            {
                "topic": "Nghề nghiệp trong tương lai",
                "words": [
                    ("doctor", "noun", "/ˈdɒk.tər/", "bác sĩ", "The doctor helps sick people get well.", "Bác sĩ giúp người bệnh hồi phục sức khỏe."),
                    ("nurse", "noun", "/nɜːs/", "y tá", "The nurse is kind and caring to patients.", "Cô y tá rất ân cần và chăm sóc bệnh nhân chu đáo."),
                    ("teacher", "noun", "/ˈtiː.tʃər/", "giáo viên", "A teacher inspires students to learn.", "Giáo viên truyền cảm hứng học tập cho học sinh."),
                    ("pilot", "noun", "/ˈpaɪ.lət/", "phi công", "The brave pilot flies planes across oceans.", "Người phi công dũng cảm lái máy bay qua các đại dương."),
                    ("farmer", "noun", "/ˈfɑː.mər/", "nông dân", "Farmers grow rice and fresh vegetables.", "Bác nông dân trồng lúa và rau củ tươi."),
                    ("chef", "noun", "/ʃef/", "đầu bếp", "The chef prepares delicious banquet dishes.", "Bếp trưởng chế biến những món tiệc thơm ngon."),
                ]
            },
            # Day 9: Clothes & Daily Outfits
            {
                "topic": "Trang phục & Quần áo",
                "words": [
                    ("shirt", "noun", "/ʃɜːt/", "áo sơ mi", "He wears a clean white shirt to school.", "Cậu ấy mặc chiếc áo sơ mi trắng tinh đến trường."),
                    ("dress", "noun", "/dres/", "chiếc váy liền", "She chose a lovely pink dress for party.", "Cô bé chọn một chiếc váy hồng xinh xắn cho bữa tiệc."),
                    ("jacket", "noun", "/ˈdʒæk.ɪt/", "áo khoác", "Put on a warm jacket because it is cold.", "Hãy mặc áo khoác ấm vì trời đang lạnh."),
                    ("shoes", "noun", "/ʃuːz/", "đôi giày", "He tied the laces of his running shoes.", "Cậu bé buộc dây đôi giày chạy của mình."),
                    ("hat", "noun", "/hæt/", "cái mũ", "Wear a wide hat to shield from sunlight.", "Đội mũ rộng vành để che ánh nắng mặt trời."),
                    ("pants", "noun", "/pænts/", "quần dài", "These dark blue pants fit him well.", "Chiếc quần dài màu xanh đậm này rất vừa vặn với cậu ấy."),
                ]
            },
            # Day 10: Fresh Fruits & Vegetables
            {
                "topic": "Trái cây & Rau củ quả tươi",
                "words": [
                    ("banana", "noun", "/bəˈnɑː.nə/", "quả chuối", "Monkeys love sweet yellow bananas.", "Những chú khỉ rất thích quả chuối vàng ngọt ngào."),
                    ("grape", "noun", "/ɡreɪp/", "quả nho", "Sweet purple grapes grow in bunches.", "Những chùm nho tím ngọt mọc thành từng chùm."),
                    ("watermelon", "noun", "/ˈwɔː.təˌmel.ən/", "dưa hấu", "Cold watermelon is perfect on hot days.", "Dưa hấu ướp lạnh là món tuyệt nhất trong ngày hè oi bức."),
                    ("strawberry", "noun", "/ˈstrɔː.bər.i/", "dâu tây", "Red strawberries are sweet and juicy.", "Những quả dâu tây đỏ mọng nước và ngọt thơm."),
                    ("tomato", "noun", "/təˈmɑː.təʊ/", "cà chua", "Fresh tomatoes make healthy salads.", "Cà chua tươi làm món salad rất tốt cho sức khỏe."),
                    ("carrot", "noun", "/ˈkær.ət/", "cà rốt", "Rabbits enjoy eating crunchy orange carrots.", "Những chú thỏ thích ăn cà rốt cam giòn ngọt."),
                ]
            },
            # Day 11: City Life & Transportation
            {
                "topic": "Thành phố & Phương tiện giao thông",
                "words": [
                    ("car", "noun", "/kɑːr/", "xe ô tô", "My father drives a blue electric car.", "Bố tôi lái một chiếc xe ô tô điện màu xanh."),
                    ("bus", "noun", "/bʌs/", "xe buýt", "Many people take the bus to work.", "Nhiều người đi làm bằng xe buýt công cộng."),
                    ("train", "noun", "/treɪn/", "tàu hỏa", "The modern train runs smoothly on tracks.", "Đoàn tàu hiện đại lướt êm ái trên đường ray."),
                    ("plane", "noun", "/pleɪn/", "máy bay", "The plane took off into the blue sky.", "Chiếc máy bay cất cánh bay vào bầu trời xanh."),
                    ("boat", "noun", "/bəʊt/", "thuyền", "The wooden boat sails across the river.", "Chiếc thuyền gỗ lướt qua dòng sông."),
                    ("airport", "noun", "/ˈeə.pɔːt/", "sân bay", "We arrived at the international airport early.", "Chúng tôi đến sân bay quốc tế sớm."),
                ]
            },
            # Day 12: Beach & Summer Vacation
            {
                "topic": "Kỳ nghỉ bãi biển & Mùa hè",
                "words": [
                    ("beach", "noun", "/biːtʃ/", "bãi biển", "Children build yellow sandcastles on beach.", "Trẻ em xây lâu đài cát vàng trên bãi biển."),
                    ("sea", "noun", "/siː/", "biển cả", "The calm blue sea looks peaceful today.", "Biển xanh êm đềm trông thật bình yên hôm nay."),
                    ("ocean", "noun", "/ˈəʊ.ʃən/", "đại dương", "The deep ocean hides many secrets.", "Đại dương sâu thẳm ẩn chứa nhiều điều kỳ bí."),
                    ("sand", "noun", "/sænd/", "bờ cát", "Walking barefoot on warm sand is relaxing.", "Đi chân trần trên cát ấm thật thư giãn."),
                    ("hotel", "noun", "/həʊˈtel/", "khách sạn", "We booked a comfortable seaside hotel.", "Chúng tôi đã đặt một khách sạn ven biển tiện nghi."),
                    ("sun", "noun", "/sʌn/", "mặt trời", "The morning sun shines over the waves.", "Ánh mặt trời buổi sớm chiếu rọi lên những con sóng."),
                ]
            },
            # Day 13: Feelings & Emotions
            {
                "topic": "Cảm xúc & Tâm trạng con người",
                "words": [
                    ("happy", "adjective", "/ˈhæp.i/", "vui vẻ", "The cheerful child smiled with happy eyes.", "Đứa trẻ vui vẻ mỉm cười với ánh mắt rạng rỡ."),
                    ("sad", "adjective", "/sæd/", "buồn bã", "Do not be sad when making mistakes.", "Đừng buồn khi mắc lỗi, hãy cố gắng lên."),
                    ("friendly", "adjective", "/ˈfrend.li/", "thân thiện", "Our new neighbor is extremely friendly.", "Người hàng xóm mới của chúng tôi vô cùng thân thiện."),
                    ("tired", "adjective", "/taɪəd/", "mệt mỏi", "Take a short nap when you feel tired.", "Hãy chợp mắt một lúc khi bạn cảm thấy mệt mỏi."),
                    ("healthy", "adjective", "/ˈhel.θi/", "khỏe mạnh", "Eating fruits keeps your body healthy.", "Ăn trái cây giúp cơ thể bạn luôn khỏe mạnh."),
                    ("kind", "adjective", "/kaɪnd/", "tốt bụng", "A kind word can brighten someone's day.", "Một lời nói tốt bụng có thể làm rạng rỡ ngày của ai đó."),
                ]
            },
            # Day 14: Body Parts & Health
            {
                "topic": "Các bộ phận cơ thể & Sức khỏe",
                "words": [
                    ("eye", "noun", "/aɪ/", "mắt", "Protect your eyes from screen glare.", "Hãy bảo vệ đôi mắt khỏi ánh sáng màn hình quá chói."),
                    ("ear", "noun", "/ɪər/", "tai", "We listen to beautiful music with our ears.", "Chúng ta lắng nghe âm nhạc tuyệt vời bằng đôi tai."),
                    ("nose", "noun", "/nəʊz/", "mũi", "Dogs have a sharp and sensitive nose.", "Loài chó có chiếc mũi vô cùng thính nhạy."),
                    ("hand", "noun", "/hænd/", "bàn tay", "Wash your hands cleanly before eating.", "Hãy rửa tay thật sạch sẽ trước khi ăn cơm."),
                    ("hospital", "noun", "/ˈhɒs.pɪ.təl/", "bệnh viện", "The clean hospital provides great healthcare.", "Bệnh viện sạch sẽ mang lại dịch vụ y tế chu đáo."),
                    ("exercise", "noun", "/ˈek.sə.saɪz/", "tập luyện", "Morning exercise keeps our muscles strong.", "Tập thể dục buổi sáng giúp cơ bắp dẻo dai khỏe mạnh."),
                ]
            },
            # Day 15: Hobbies & Leisure Time
            {
                "topic": "Sở thích & Thời gian rảnh rỗi",
                "words": [
                    ("music", "noun", "/ˈmjuː.zɪk/", "âm nhạc", "Listening to soft music helps me relax.", "Nghe nhạc nhẹ nhàng giúp tôi thư giãn tinh thần."),
                    ("guitar", "noun", "/ɡɪˈtɑːr/", "đàn ghi-ta", "He plays the acoustic guitar very well.", "Cậu ấy chơi đàn ghi-ta thùng rất cừ."),
                    ("piano", "noun", "/piˈæn.əʊ/", "đàn dương cầm", "She practices classical piano every evening.", "Cô bé luyện tập đàn dương cầm mỗi buổi tối."),
                    ("book", "noun", "/bʊk/", "đọc sách", "Reading an interesting book opens the mind.", "Đọc một cuốn sách hay giúp mở rộng chân trời tri thức."),
                    ("game", "noun", "/ɡeɪm/", "trò chơi", "Chess is an intellectual strategic board game.", "Cờ vua là một trò chơi cờ trí tuệ mang tính chiến thuật."),
                    ("toy", "noun", "/tɔɪ/", "đồ chơi", "Children share their toys politely.", "Các bạn nhỏ chia sẻ đồ chơi với nhau rất lịch sự."),
                ]
            },
            # Day 16: Nature & Green Forest
            {
                "topic": "Thiên nhiên & Rừng xanh kỳ thú",
                "words": [
                    ("forest", "noun", "/ˈfɒr.ɪst/", "khu rừng", "Tall trees create a green canopy in forest.", "Những hàng cây cao tạo nên tán lá xanh ngút ngàn trong rừng."),
                    ("tree", "noun", "/triː/", "cái cây", "Planting a tree makes the world greener.", "Trồng một cái cây làm cho thế giới thêm xanh tươi."),
                    ("flower", "noun", "/ˈflaʊ.ər/", "bông hoa", "Spring brings colorful blooming flowers.", "Mùa xuân mang đến muôn hoa khoe sắc rực rỡ."),
                    ("mountain", "noun", "/ˈmaʊn.tɪn/", "ngọn núi", "Hikers climbed to the top of the mountain.", "Những người leo núi đã lên tới đỉnh núi cao."),
                    ("river", "noun", "/ˈrɪv.ər/", "dòng sông", "The gentle river flows quietly to sea.", "Dòng sông êm đềm lững lờ trôi ra biển cả."),
                    ("lake", "noun", "/leɪk/", "hồ nước", "The peaceful lake reflects white clouds.", "Mặt hồ phẳng lặng phản chiếu những đám mây trắng."),
                ]
            },
            # Day 17: Space & Solar System
            {
                "topic": "Vũ trụ & Các hành tinh",
                "words": [
                    ("space", "noun", "/speɪs/", "không gian vũ trụ", "Telescopes help scientists observe deep space.", "Kính viễn vọng giúp các nhà khoa học quan sát không gian sâu thẳm."),
                    ("star", "noun", "/stɑːr/", "ngôi sao", "Twinkling stars light up the night sky.", "Những ngôi sao lấp lánh thắp sáng bầu trời đêm."),
                    ("moon", "noun", "/muːn/", "mặt trăng", "The full moon glows brightly in the dark.", "Mặt trăng tròn tỏa sáng rực rỡ trong bóng đêm."),
                    ("planet", "noun", "/ˈplæn.ɪt/", "hành tinh", "Earth is our beautiful blue home planet.", "Trái Đất là hành tinh xanh tươi đẹp của chúng ta."),
                    ("robot", "noun", "/ˈrəʊ.bɒt/", "người máy", "Smart robots explore distant planets.", "Những người máy thông minh khám phá các hành tinh xa xôi."),
                    ("sky", "noun", "/skaɪ/", "bầu trời", "The clear blue sky fills with sunshine.", "Bầu trời trong xanh ngập tràn ánh nắng ấm áp."),
                ]
            },
            # Day 18: Birthday Party & Celebrations
            {
                "topic": "Tiệc sinh nhật & Lễ hội",
                "words": [
                    ("cake", "noun", "/keɪk/", "bánh kem", "She blew out the candles on birthday cake.", "Cô bé thổi nến trên chiếc bánh sinh nhật."),
                    ("chocolate", "noun", "/ˈtʃɒk.lət/", "sô-cô-la", "Delicious chocolate is sweet and rich.", "Sô-cô-la hảo hạng có vị ngọt ngào và béo ngậy."),
                    ("friend", "noun", "/frend/", "bạn bè", "All friends sang the birthday song together.", "Tất cả bạn bè cùng nhau hát vang bài hát chúc mừng sinh nhật."),
                    ("happy", "adjective", "/ˈhæp.i/", "vui sướng", "Everyone felt happy at the lively party.", "Mọi người đều cảm thấy vui sướng tại bữa tiệc náo nhiệt."),
                    ("music", "noun", "/ˈmjuː.zɪk/", "âm nhạc", "Upbeat music made guests dance cheerfully.", "Âm nhạc sôi động khiến khách dự tiệc khiêu vũ vui vẻ."),
                    ("orange", "noun", "/ˈɒr.ɪndʒ/", "nước cam", "Guests enjoyed sweet chilled orange juice.", "Khách dự tiệc thưởng thức nước cam ép mát lành."),
                ]
            },
            # Day 19: Music & Musical Instruments
            {
                "topic": "Âm nhạc & Các loại nhạc cụ",
                "words": [
                    ("guitar", "noun", "/ɡɪˈtɑːr/", "đàn ghi-ta", "He strummed joyful chords on his guitar.", "Cậu ấy gảy những hợp âm vui tươi trên cây đàn ghi-ta."),
                    ("piano", "noun", "/piˈæn.əʊ/", "đàn dương cầm", "The pianist played smooth melodies on piano.", "Nghệ sĩ dương cầm chơi những giai điệu mượt mà trên đàn."),
                    ("drums", "noun", "/drʌmz/", "bộ trống", "The powerful rhythm comes from the drums.", "Tiết tấu mạnh mẽ bắt nguồn từ bộ trống sôi động."),
                    ("singer", "noun", "/ˈsɪŋ.ər/", "ca sĩ", "The talented singer has a crystal voice.", "Người ca sĩ tài năng sở hữu giọng hát trong trẻo."),
                    ("music", "noun", "/ˈmjuː.zɪk/", "bản nhạc", "Good music inspires creative ideas.", "Âm nhạc hay truyền cảm hứng cho những ý tưởng sáng tạo."),
                    ("teacher", "noun", "/ˈtiː.tʃər/", "thầy dạy nhạc", "Our music teacher teaches us harmony.", "Thầy giáo dạy nhạc dạy chúng tôi cách hòa âm."),
                ]
            },
            # Day 20: A Day at the Zoo
            {
                "topic": "Chuyến dạo chơi Vườn bách thú",
                "words": [
                    ("lion", "noun", "/ˈlaɪ.ən/", "sư tử", "The majestic lion rests under shady trees.", "Chú sư tử uy nghi nghỉ ngơi dưới bóng râm mát."),
                    ("monkey", "noun", "/ˈmʌŋ.ki/", "con khỉ", "The agile monkey swings across branches.", "Chú khỉ nhanh nhẹn chuyền mình qua các cành cây."),
                    ("giraffe", "noun", "/dʒɪˈrɑːf/", "hươu cao cổ", "The tall giraffe eats tender green leaves.", "Chú hươu cao cổ ăn những chiếc lá xanh non trên ngọn cây."),
                    ("zebra", "noun", "/ˈzeb.rə/", "ngựa vằn", "Zebras have unique black and white stripes.", "Ngựa vằn có những sọc đen trắng độc đáo không con nào giống con nào."),
                    ("panda", "noun", "/ˈpæn.də/", "gấu trúc", "The lovely panda chews on fresh bamboo.", "Chú gấu trúc đáng yêu nhai những cành tre tươi."),
                    ("bear", "noun", "/beər/", "con gấu", "The big brown bear catches river fish.", "Chú gấu nâu to lớn bắt cá dưới dòng suối."),
                ]
            },
            # Day 21: Life on the Farm
            {
                "topic": "Nông trại miền quê & Động vật nuôi",
                "words": [
                    ("cow", "noun", "/kaʊ/", "con bò sữa", "Cows graze peacefully on green pastures.", "Những chú bò sữa thong thả gặm cỏ trên đồng cỏ xanh."),
                    ("horse", "noun", "/hɔːs/", "con ngựa", "The fast horse gallops across the field.", "Chú ngựa phi nhanh băng qua cánh đồng bát ngát."),
                    ("sheep", "noun", "/ʃiːp/", "con cừu", "Fluffy white sheep provide warm soft wool.", "Đàn cừu trắng muốt cung cấp lớp lông cừu mềm mại ấm áp."),
                    ("duck", "noun", "/dʌk/", "con vịt", "Little yellow ducks swim in the farm pond.", "Những chú vịt con màu vàng bơi lội trong ao nông trại."),
                    ("chicken", "noun", "/ˈtʃɪk.ɪn/", "con gà", "Chickens peck for grains in the barnyard.", "Đàn gà mổ thóc trong sân chuồng nông trại."),
                    ("farmer", "noun", "/ˈfɑː.mər/", "bác nông dân", "The diligent farmer starts work at dawn.", "Bác nông dân chăm chỉ bắt đầu công việc từ lúc rạng đông."),
                ]
            },
            # Day 22: Supermarket & Shopping Time
            {
                "topic": "Đi siêu thị & Mua sắm",
                "words": [
                    ("apple", "noun", "/ˈæp.əl/", "quả táo tươi", "We choose crisp red apples at market.", "Chúng tôi chọn những quả táo đỏ giòn tại chợ."),
                    ("bread", "noun", "/bred/", "bánh mì thơm", "The bakery section smells of warm bread.", "Khu vực lò nướng thơm lừng mùi bánh mì nóng hổi."),
                    ("milk", "noun", "/mɪlk/", "sữa tươi tiệt trùng", "We bought two bottles of fresh milk.", "Chúng tôi đã mua hai chai sữa tươi thanh trùng."),
                    ("tomato", "noun", "/təˈmɑː.təʊ/", "cà chua", "Bright red tomatoes fill the shopping cart.", "Những quả cà chua đỏ mọng đầy ắp xe đẩy mua sắm."),
                    ("bag", "noun", "/bæɡ/", "túi đựng đồ", "Use cloth bags to protect the environment.", "Hãy dùng túi vải để bảo vệ môi trường."),
                    ("family", "noun", "/ˈfæm.əl.i/", "gia đình", "Our family shops together on Saturday.", "Gia đình chúng tôi cùng nhau đi mua sắm vào thứ Bảy."),
                ]
            },
            # Day 23: Daily Routines & Time
            {
                "topic": "Thói quen sinh hoạt & Thời gian",
                "words": [
                    ("clock", "noun", "/klɒk/", "đồng hồ", "The wall clock reminds us of study time.", "Chiếc đồng hồ treo tường nhắc nhở chúng ta đến giờ học bài."),
                    ("breakfast", "noun", "/ˈbrek.fəst/", "bữa điểm tâm", "A healthy breakfast fuels our school day.", "Bữa sáng lành mạnh tiếp thêm năng lượng cho cả ngày học."),
                    ("school", "noun", "/skuːl/", "trường học", "We walk cheerfully to our lovely school.", "Chúng tôi vui vẻ rảo bước đến ngôi trường thân yêu."),
                    ("book", "noun", "/bʊk/", "cuốn sách", "I finish one chapter of my book at night.", "Tôi đọc xong một chương sách vào mỗi buổi tối."),
                    ("bed", "noun", "/bed/", "chiếc giường", "Go to bed early to wake up refreshed.", "Hãy đi ngủ sớm để thức dậy thật tỉnh táo và sảng khoái."),
                    ("healthy", "adjective", "/ˈhel.θi/", "lối sống lành mạnh", "Good sleep keeps students energetic and healthy.", "Giấc ngủ ngon giữ cho học sinh luôn tràn đầy năng lượng và khỏe mạnh."),
                ]
            },
            # Day 24: Ocean Life & Sea Animals
            {
                "topic": "Đại dương & Sinh vật biển",
                "words": [
                    ("whale", "noun", "/weɪl/", "cá voi", "The giant blue whale glides through water.", "Chú cá voi xanh khổng lồ lướt đi nhẹ nhàng trong làn nước."),
                    ("shark", "noun", "/ʃɑːk/", "cá mập", "Sharks are powerful ocean predators.", "Cá mập là những tay săn mồi dũng mãnh của đại dương."),
                    ("dolphin", "noun", "/ˈdɒl.fɪn/", "cá heo", "Playful dolphins leap above ocean waves.", "Những chú cá heo tinh nghịch nhảy vút lên khỏi ngọn sóng."),
                    ("turtle", "noun", "/ˈtɜː.təl/", "rùa biển", "The ancient sea turtle swims across reef.", "Chú rùa biển bơi qua rạn san hô rực rỡ sắc màu."),
                    ("crab", "noun", "/kræb/", "con cua", "The tiny crab scuttles along sandy shore.", "Chú cua nhỏ bò ngang thoăn thoắt dọc bờ cát."),
                    ("fish", "noun", "/fɪʃ/", "đàn cá", "Schools of colorful fish glitter in light.", "Những đàn cá đủ màu sắc lấp lánh dưới làn nước trong vắt."),
                ]
            },
            # Day 25: Playground & Fun Park
            {
                "topic": "Công viên & Trò chơi giải trí",
                "words": [
                    ("running", "noun", "/ˈrʌn.ɪŋ/", "chạy nhảy", "Children love running freely in green park.", "Trẻ em thích chạy nhảy tự do trong công viên xanh mát."),
                    ("bicycle", "noun", "/ˈbaɪ.sɪ.kəl/", "xe đạp", "Riding a bicycle in the park is refreshing.", "Đạp xe trong công viên mang lại cảm giác thật sảng khoái."),
                    ("friend", "noun", "/frend/", "bạn bè", "We meet close friends at neighborhood park.", "Chúng tôi gặp gỡ những người bạn thân tại công viên gần nhà."),
                    ("sunny", "adjective", "/ˈsʌn.i/", "nắng đẹp", "A warm sunny afternoon is great for sports.", "Một buổi chiều nắng ấm thật lý tưởng để rèn luyện thể thao."),
                    ("tree", "noun", "/triː/", "bóng cây xanh", "Old trees provide cool shade for park visitors.", "Những cây cổ thụ che bóng mát cho khách dạo chơi công viên."),
                    ("happy", "adjective", "/ˈhæp.i/", "vui sướng", "Laughter makes every child feel happy.", "Tiếng cười rộn rã khiến mọi bạn nhỏ đều cảm thấy vui sướng."),
                ]
            },
            # Day 26: Kitchen & Cooking Fun
            {
                "topic": "Nhà bếp & Nấu ăn gia đình",
                "words": [
                    ("kitchen", "noun", "/ˈkɪtʃ.ɪn/", "nhà bếp", "The clean kitchen smells of spices and herbs.", "Gian bếp sạch sẽ thơm nồng hương gia vị thảo mộc."),
                    ("soup", "noun", "/suːp/", "món súp", "Warm vegetable soup is comforting on cold days.", "Món súp rau củ nóng hổi xua tan cái lạnh giá."),
                    ("rice", "noun", "/raɪs/", "cơm nóng", "Steamed white rice accompanies every dish.", "Cơm trắng nóng hổi ăn kèm với các món thật ngon miệng."),
                    ("egg", "noun", "/eɡ/", "trứng gà", "Boiled eggs give essential natural proteins.", "Trứng gà luộc cung cấp nguồn đạm tự nhiên thiết yếu."),
                    ("table", "noun", "/ˈteɪ.bəl/", "bàn ăn", "We sit around dining table and share stories.", "Chúng tôi ngồi quanh bàn ăn và chia sẻ những câu chuyện ấm cúng."),
                    ("cook", "noun", "/kʊk/", "người nấu nướng", "Good cooking brings the entire family together.", "Nấu ăn ngon gắn kết tất cả thành viên trong gia đình lại với nhau."),
                ]
            },
            # Day 27: Toys & Childhood Games
            {
                "topic": "Đồ chơi & Trò chơi tuổi thơ",
                "words": [
                    ("toy", "noun", "/tɔɪ/", "đồ chơi", "Put your toys neatly in storage box.", "Hãy cất đồ chơi gọn gàng vào hộp sau khi chơi xong."),
                    ("robot", "noun", "/ˈrəʊ.bɒt/", "chú người máy", "The futuristic robot lights up and talks.", "Chú người máy tương lai phát sáng và biết nói tiếng người."),
                    ("game", "noun", "/ɡeɪm/", "trò chơi", "Board games teach kids cooperation skills.", "Trò chơi cờ bàn dạy trẻ nhỏ kỹ năng hợp tác cùng nhau."),
                    ("ball", "noun", "/bɔːl/", "quả bóng", "Kick the soccer ball into the goalpost.", "Hãy sút quả bóng vào lưới thật chuẩn xác."),
                    ("book", "noun", "/bʊk/", "truyện tranh", "Comic books have exciting superhero adventures.", "Truyện tranh chứa đựng những chuyến phiêu lưu kỳ thú của siêu anh hùng."),
                    ("friend", "noun", "/frend/", "bạn đồng hành", "Sharing games makes friends even closer.", "Cùng nhau chơi trò chơi giúp bạn bè ngày càng thân thiết hơn."),
                ]
            },
            # Day 28: Fun Science & Experiments
            {
                "topic": "Khoa học vui & Thí nghiệm kỳ thú",
                "words": [
                    ("science", "noun", "/ˈsaɪ.əns/", "khoa học", "Science helps us understand natural laws.", "Khoa học giúp chúng ta hiểu rõ các quy luật tự nhiên."),
                    ("computer", "noun", "/kəmˈpjuː.tər/", "máy tính", "Computers process data at incredible speeds.", "Máy vi tính xử lý dữ liệu với tốc độ phi thường."),
                    ("robot", "noun", "/ˈrəʊ.bɒt/", "người máy tự hành", "Robotic arms build cars in factories.", "Những cánh tay người máy lắp ráp xe hơi trong nhà máy."),
                    ("star", "noun", "/stɑːr/", "ngôi sao thiên văn", "Astronomers study stars with giant telescopes.", "Các nhà thiên văn học nghiên cứu các vì sao bằng kính viễn vọng lớn."),
                    ("planet", "noun", "/ˈplæn.ɪt/", "hành tinh xa xôi", "Probes take photos of red planet Mars.", "Các tàu thăm dò chụp ảnh hành tinh đỏ Sao Hỏa."),
                    ("student", "noun", "/ˈstjuː.dənt/", "nhà khoa học nhí", "Young students ask curious insightful questions.", "Những học sinh nhỏ tuổi luôn đặt ra những câu hỏi tò mò đầy sắc sảo."),
                ]
            },
            # Day 29: Camping & Picnic Adventure
            {
                "topic": "Cắm trại & Thám hiểm thiên nhiên",
                "words": [
                    ("forest", "noun", "/ˈfɒr.ɪst/", "rừng xanh", "We pitched our canvas tent near forest.", "Chúng tôi dựng lều vải gần bìa rừng xanh mát."),
                    ("mountain", "noun", "/ˈmaʊn.tɪn/", "đỉnh núi cao", "The mountain trail leads to a clear spring.", "Lối mòn leo núi dẫn đến một con suối trong vắt."),
                    ("water", "noun", "/ˈwɔː.tər/", "nước uống tinh khiết", "Carry enough clean drinking water on hikes.", "Mang đủ nước uống tinh khiết cho chuyến đi bộ dã ngoại."),
                    ("tree", "noun", "/triː/", "hàng cây che mát", "Campers rested under the shade of pines.", "Những người cắm trại nghỉ ngơi dưới bóng mát của rặng thông."),
                    ("bird", "noun", "/bɜːd/", "chim hót", "Forest birds sing sweetly in early morning.", "Những chú chim rừng cất tiếng hót líu lo vào sớm mai."),
                    ("backpack", "noun", "/ˈbæk.pæk/", "ba lô dã ngoại", "Pack your warm clothes in backpack.", "Hãy xếp quần áo ấm cẩn thận vào trong ba lô."),
                ]
            },
            # Day 30: World Countries & Travel
            {
                "topic": "Các quốc gia & Du lịch thế giới",
                "words": [
                    ("airplane", "noun", "/ˈeə.pleɪn/", "máy bay đường dài", "The airplane crosses continents overnight.", "Chiếc máy bay vượt qua các lục địa trong đêm."),
                    ("airport", "noun", "/ˈeə.pɔːt/", "sân bay quốc tế", "Check passport carefully at border control.", "Kiểm tra hộ chiếu cẩn thận tại cổng kiểm soát xuất nhập cảnh."),
                    ("hotel", "noun", "/həʊˈtel/", "khách sạn nghỉ dưỡng", "The hotel staff greeted travelers warmly.", "Nhân viên khách sạn nồng nhiệt chào đón du khách bốn phương."),
                    ("city", "noun", "/ˈsɪt.i/", "thành phố lớn", "Historical cities showcase cultural treasures.", "Các thành phố lịch sử lưu giữ những kho báu văn hóa quý báu."),
                    ("map", "noun", "/mæp/", "bản đồ thế giới", "Check the city map before starting the tour.", "Hãy xem bản đồ thành phố trước khi bắt đầu chuyến tham quan."),
                    ("luggage", "noun", "/ˈlʌɡ.ɪdʒ/", "hành lý du lịch", "Keep your travel luggage organized and secure.", "Giữ hành lý du lịch của bạn thật gọn gàng và an toàn."),
                ]
            },
            # Day 31: Flowers & Beautiful Garden
            {
                "topic": "Khu vườn hoa & Cây cối xanh tươi",
                "words": [
                    ("garden", "noun", "/ˈɡɑː.dən/", "khu vườn", "Our backyard garden is peaceful and green.", "Khu vườn sau nhà chúng tôi thật yên bình và xanh tươi."),
                    ("flower", "noun", "/ˈflaʊ.ər/", "bông hoa tươi", "Bees collect sweet nectar from colorful flowers.", "Những chú ong chăm chỉ lấy mật ngọt từ muôn hoa."),
                    ("rose", "noun", "/rəʊz/", "hoa hồng đỏ", "The red rose has sweet fragrant perfume.", "Bông hoa hồng đỏ tỏa ngát hương thơm dịu dàng."),
                    ("butterfly", "noun", "/ˈbʌt.ə.flaɪ/", "bướm xinh", "A painted butterfly rests on sunflower.", "Một chú bướm xinh xắn đậu nhẹ trên bông hoa hướng dương."),
                    ("tree", "noun", "/triː/", "cây bóng mát", "Fruit trees blossom abundantly in springtime.", "Những cây ăn quả nở hoa xum xuê khi mùa xuân về."),
                    ("sun", "noun", "/sʌn/", "ánh nắng ấm", "Warm gentle sun nourishes every green plant.", "Ánh mặt trời dịu ấm nuôi dưỡng từng mầm cây xanh tốt."),
                ]
            },
        ]

        # Select topic pool: Match keywords if user searched a specific topic, otherwise rotate by calendar day
        selected_pool = None
        for pool in TOPIC_POOLS:
            p_words = [w.strip() for w in pool["topic"].lower().replace("&", " ").split() if len(w.strip()) > 2]
            if any(pw in t_lower for pw in p_words):
                selected_pool = pool
                break

        if not selected_pool:
            day_seed = (datetime.now().timetuple().tm_yday + grade + len(CUSTOM_UNITS_STORE)) % len(TOPIC_POOLS)
            selected_pool = TOPIC_POOLS[day_seed]

        words = selected_pool["words"]
        used_images: Set[str] = set()

        flashcards = [
            VocabFlashcard(
                id=custom_id * 10 + i,
                word=w[0],
                part_of_speech=w[1],
                ipa=w[2],
                meaning=w[3],
                image_url=get_accurate_vocab_image(w[0], topic_title, index=i, used_urls=used_images),
                audio_text=w[0],
                example_sentence=w[4],
                example_translation=w[5],
            )
            for i, w in enumerate(words)
        ]

        # 8 Rich Multimodal Exercises (Exercises 1 & 2 use the exact distinct flashcard image for that word)
        exercises = [
            # 1. MATCH_IMAGE 1
            MultimodalExercise(
                id=custom_id * 20 + 1,
                exercise_type="MATCH_IMAGE",
                prompt=f"Từ vựng nào miêu tả đúng nghĩa '{words[0][3]}' trong hình?",
                media_url=flashcards[0].image_url,
                audio_text=words[0][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][0].capitalize()),
                ],
                correct_answer="A",
                explanation=f"'{words[0][0]}' có nghĩa là {words[0][3]}.",
            ),
            # 2. MATCH_IMAGE 2
            MultimodalExercise(
                id=custom_id * 20 + 2,
                exercise_type="MATCH_IMAGE",
                prompt=f"Hình ảnh trên minh họa chính xác từ Tiếng Anh nào cho '{words[1][3]}':",
                media_url=flashcards[1].image_url,
                audio_text=words[1][0],
                options=[
                    ExerciseOption(option_key="A", content=words[3][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[4][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[5][0].capitalize()),
                ],
                correct_answer="B",
                explanation=f"'{words[1][0]}' nghĩa là {words[1][3]}.",
            ),
            # 3. LISTEN_SELECT 1
            MultimodalExercise(
                id=custom_id * 20 + 3,
                exercise_type="LISTEN_SELECT",
                prompt=f"Nghe âm thanh mẫu và chọn đáp án từ Tiếng Anh đúng:",
                audio_text=words[2][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][0].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][0].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][0].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][0].capitalize()),
                ],
                correct_answer="C",
                explanation=f"Đoạn phát âm chuẩn là '{words[2][0]}' ({words[2][2]}).",
            ),
            # 4. LISTEN_SELECT 2
            MultimodalExercise(
                id=custom_id * 20 + 4,
                exercise_type="LISTEN_SELECT",
                prompt=f"Nghe phát âm từ vựng và chọn nghĩa Tiếng Việt chính xác:",
                audio_text=words[3][0],
                options=[
                    ExerciseOption(option_key="A", content=words[0][3].capitalize()),
                    ExerciseOption(option_key="B", content=words[1][3].capitalize()),
                    ExerciseOption(option_key="C", content=words[2][3].capitalize()),
                    ExerciseOption(option_key="D", content=words[3][3].capitalize()),
                ],
                correct_answer="D",
                explanation=f"Từ phát âm '{words[3][0]}' mang nghĩa là {words[3][3]}.",
            ),
            # 5. WORD_TYPING 1
            MultimodalExercise(
                id=custom_id * 20 + 5,
                exercise_type="WORD_TYPING",
                prompt=f"✍️ Luyện gõ chính tả: Nghe phát âm hoặc nhìn nghĩa '{words[4][3]}', hãy gõ từ Tiếng Anh:",
                audio_text=words[4][0],
                options=[],
                correct_answer=words[4][0],
                explanation=f"Từ Tiếng Anh chính xác cho '{words[4][3]}' là '{words[4][0]}'.",
            ),
            # 6. WORD_TYPING 2
            MultimodalExercise(
                id=custom_id * 20 + 6,
                exercise_type="WORD_TYPING",
                prompt=f"✍️ Luyện gõ chính tả: Gõ chính xác từ Tiếng Anh cho '{words[5][3]}':",
                audio_text=words[5][0],
                options=[],
                correct_answer=words[5][0],
                explanation=f"Chính tả chính xác là '{words[5][0]}'.",
            ),
            # 7. FILL_BLANK 1
            MultimodalExercise(
                id=custom_id * 20 + 7,
                exercise_type="FILL_BLANK",
                prompt=f"📝 Điền từ còn thiếu vào câu: '{re.sub(rf'(?i)\b{re.escape(words[0][0])}\b', '_____', words[0][4])}'",
                audio_text=words[0][4],
                options=[],
                correct_answer=words[0][0],
                explanation=f"Từ còn thiếu chính xác là '{words[0][0]}'. Dịch câu: {words[0][5]}",
            ),
            # 8. FILL_BLANK 2
            MultimodalExercise(
                id=custom_id * 20 + 8,
                exercise_type="FILL_BLANK",
                prompt=f"📝 Điền từ còn thiếu vào câu: '{re.sub(rf'(?i)\b{re.escape(words[1][0])}\b', '_____', words[1][4])}'",
                audio_text=words[1][4],
                options=[],
                correct_answer=words[1][0],
                explanation=f"Từ còn thiếu chính xác là '{words[1][0]}'. Dịch câu: {words[1][5]}",
            ),
        ]

        if grade <= 5:
            speaking_prompts = [
                SpeakingPrompt(
                    id=custom_id * 30 + 1,
                    target_text=f"I love my {words[0][0]}.",
                    ipa=f"/aɪ lʌv maɪ {words[0][0]}/",
                    meaning=f"Tôi yêu {words[0][3]} của tôi.",
                    tip=f"Mẫu câu ngắn 4 từ đơn giản dành cho Lớp {grade}.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 2,
                    target_text=f"This is a {words[1][0]}.",
                    ipa=f"/ðɪs ɪz ə {words[1][0]}/",
                    meaning=f"Đây là một {words[1][3]}.",
                    tip=f"Phát âm rõ ràng từng từ ngắn.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 3,
                    target_text=f"We like {words[2][0]}.",
                    ipa=f"/wiː laɪk {words[2][0]}/",
                    meaning=f"Chúng tôi thích {words[2][3]}.",
                    tip=f"Đọc trôi chảy câu ngắn 3 từ.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 4,
                    target_text=f"She has a {words[3][0]}.",
                    ipa=f"/ʃiː hæz ə {words[3][0]}/",
                    meaning=f"Cô ấy có một {words[3][3]}.",
                    tip=f"Chú ý âm đuôi /z/ trong từ 'has'.",
                ),
            ]
        else:
            speaking_prompts = [
                SpeakingPrompt(
                    id=custom_id * 30 + 1,
                    target_text=words[0][4],
                    ipa=f"/{words[0][0]} sentence/",
                    meaning=words[0][5],
                    tip=f"Chú ý nhấn trọng âm từ '{words[0][0]}'.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 2,
                    target_text=words[1][4],
                    ipa=f"/{words[1][0]} sentence/",
                    meaning=words[1][5],
                    tip=f"Đọc trôi chảy ngữ điệu tự nhiên.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 3,
                    target_text=words[2][4],
                    ipa=f"/{words[2][0]} sentence/",
                    meaning=words[2][5],
                    tip=f"Phát âm rõ ràng các âm đuôi.",
                ),
                SpeakingPrompt(
                    id=custom_id * 30 + 4,
                    target_text=words[3][4],
                    ipa=f"/{words[3][0]} sentence/",
                    meaning=words[3][5],
                    tip=f"Đọc nối âm chuẩn bản ngữ.",
                ),
            ]

        return EnglishUnitDetailResponse(
            unit_id=custom_id,
            title=f"Unit 8 Phút: {topic_title}",
            topic=topic_title,
            grade=grade,
            description=f"Bài ôn tập Tiếng Anh AI 8 Phút chuẩn GDPT 2018 chủ đề: {topic_title}.",
            flashcards=flashcards,
            exercises=exercises,
            speaking_prompts=speaking_prompts,
        )
