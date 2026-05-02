from fastapi import APIRouter, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.dart import DartService

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/disclosures")
@limiter.limit("30/minute")
async def list_disclosures(
    request: Request,
    ticker: str = Query(..., regex=r"^\d{6}$"),
    days: int = Query(default=30, ge=1, le=180),
) -> list[dict]:
    """최근 N일간 DART 공시 목록 조회"""
    try:
        service = DartService()
        return await service.get_disclosures(ticker, days)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/disclosure/{rcept_no}")
@limiter.limit("20/minute")
async def get_disclosure_content(request: Request, rcept_no: str) -> dict:
    """공시 본문 텍스트 조회 (사용자가 클릭할 때만 fetch)"""
    import re
    if not re.match(r"^\d{14}$", rcept_no):
        raise HTTPException(status_code=400, detail="잘못된 접수번호 형식입니다")

    try:
        service = DartService()
        return await service.get_disclosure_content(rcept_no)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"공시 본문 조회 실패: {str(e)}")
