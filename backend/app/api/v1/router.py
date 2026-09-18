from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.documents import router as documents_router
from app.api.v1.questions import router as questions_router
from app.api.v1.ai import router as ai_router
from app.api.v1.exams import router as exams_router
from app.api.v1.english import router as english_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(documents_router)
api_router.include_router(questions_router)
api_router.include_router(ai_router)
api_router.include_router(exams_router)
api_router.include_router(english_router, prefix="/english", tags=["english-ai"])

