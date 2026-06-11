import logging
import logging.handlers
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import init_db
from api.routes import router
from api.detail_routes import router as detail_router

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.handlers.RotatingFileHandler(
            "logs/investai.log", maxBytes=10_000_000, backupCount=5, encoding="utf-8"
        ),
    ],
)

app = FastAPI(title="InvestAI", version="1.0.0")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS if o.strip()]
if not CORS_ORIGINS:
    # Dev default: allow localhost and any LAN IP on port 3000
    CORS_ORIGINS = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"http://((localhost)|(127\.0\.0\.1)|(192\.168\.\d+\.\d+)|(10\.\d+\.\d+\.\d+)|(172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


app.include_router(router, prefix="/api")
app.include_router(detail_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
