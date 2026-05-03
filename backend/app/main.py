import asyncio
import logging
from contextlib import asynccontextmanager

import dart_fss as dart
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api import diagnose, disclosures, stocks
from app.core.config import settings
from app.services.stock_list import load_stock_list

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 DART API 키 등록 + 주식 목록 백그라운드 로딩"""
    if settings.dart_api_key:
        dart.set_api_key(api_key=settings.dart_api_key)
        logger.info("DART API 키 등록 완료")
        asyncio.create_task(load_stock_list())
    else:
        logger.warning("DART_API_KEY 미설정 - 공시/자동완성 기능 비활성화")
    yield


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Tide Line API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(diagnose.router, prefix="/api")
app.include_router(disclosures.router, prefix="/api")
app.include_router(stocks.router, prefix="/api")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
