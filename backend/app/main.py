from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Ensure tables are created for SQLite / PostgreSQL
    Base.metadata.create_all(bind=engine)

    # Safe lightweight SQLite migration for added columns
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN grade INTEGER;"))
            conn.commit()
        except Exception:
            pass  # Column already exists or unsupported dialect
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN diamond_balance INTEGER DEFAULT 0;"))
            conn.commit()
        except Exception:
            pass

    # Auto-seed initial active accounts and sample gifts if DB has no Admin / Gifts
    from sqlalchemy.orm import Session as DBSession
    from app.models.user import User, UserRole
    from app.models.reward import RewardItem
    from app.core.security import get_password_hash

    with DBSession(engine) as db:
        try:
            admin = db.query(User).filter(User.email == "tuantt.vpc@gmail.com").first()
            if not admin:
                db.add(
                    User(
                        email="tuantt.vpc@gmail.com",
                        hashed_password=get_password_hash("Admin@123"),
                        full_name="Quản Trị Viên Hệ Thống",
                        role=UserRole.ADMIN,
                        is_active=True,
                    )
                )

            # Ensure backup default teacher & student accounts
            teacher = db.query(User).filter(User.email == "teacher@example.com").first()
            if not teacher:
                db.add(
                    User(
                        email="teacher@example.com",
                        hashed_password=get_password_hash("Teacher@123"),
                        full_name="Giáo Viên Mẫu",
                        role=UserRole.TEACHER,
                        is_active=True,
                    )
                )

            student = db.query(User).filter(User.email == "student@example.com").first()
            if not student:
                db.add(
                    User(
                        email="student@example.com",
                        hashed_password=get_password_hash("Student@123"),
                        full_name="Học Sinh Mẫu",
                        role=UserRole.STUDENT,
                        grade=5,
                        is_active=True,
                    )
                )

            # Seed sample student reward items if table is empty
            if db.query(RewardItem).count() == 0:
                sample_items = [
                    RewardItem(
                        title="Bộ Bút Chì Màu 12 Màu Premium",
                        description="Bộ bút chì màu rực rỡ, chất lượng cao dành cho học sinh sáng tạo.",
                        image_url="https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=500&auto=format&fit=crop",
                        diamond_cost=10,
                        stock_quantity=50,
                        category="Dụng cụ học tập",
                        is_active=True,
                    ),
                    RewardItem(
                        title="Sổ Tay Lò Xo Ghi Chép A5 Smart",
                        description="Sổ ghi chép bìa cứng dày dặn, giấy kẻ ngang chống lóa mắt.",
                        image_url="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop",
                        diamond_cost=15,
                        stock_quantity=30,
                        category="Dụng cụ học tập",
                        is_active=True,
                    ),
                    RewardItem(
                        title="Huy Hiệu Dũng Sĩ Tiếng Anh AI",
                        description="Huy hiệu kim loại mạ vàng đính kèm cài áo dành cho học sinh xuất sắc.",
                        image_url="https://images.unsplash.com/photo-1614680376593-902f749f705d?w=500&auto=format&fit=crop",
                        diamond_cost=20,
                        stock_quantity=100,
                        category="Huy hiệu danh dự",
                        is_active=True,
                    ),
                    RewardItem(
                        title="Thước Kẻ Đa Năng 20cm Chống Gãy",
                        description="Thước kẻ trong suốt chia vạch chính xác kèm thước đo độ góc.",
                        image_url="https://images.unsplash.com/photo-1588072432836-e10032774350?w=500&auto=format&fit=crop",
                        diamond_cost=8,
                        stock_quantity=60,
                        category="Dụng cụ học tập",
                        is_active=True,
                    ),
                    RewardItem(
                        title="Balo Học Sinh Siêu Nhẹ Anti-Gravity",
                        description="Balo chống gù lưng thế hệ mới, đệm thoáng khí, chống nước nhẹ.",
                        image_url="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop",
                        diamond_cost=50,
                        stock_quantity=10,
                        category="Vật phẩm cao cấp",
                        is_active=True,
                    ),
                ]
                db.add_all(sample_items)

            db.commit()
        except Exception as exc:
            pass


    yield




app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    version="1.0.0",
)

# CORS Middleware
origins = settings.BACKEND_CORS_ORIGINS
if isinstance(origins, str):
    origins = [o.strip() for o in origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["system"])
def root():
    """Root health and discovery endpoint."""
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/api/health", tags=["system"])
def health_check(db: Session = Depends(get_db)):
    """Database and service health check endpoint."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "environment": "production" if not settings.DATABASE_URL.startswith("sqlite") else "development",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
