from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi.util import get_remote_address
from slowapi import Limiter

from app.services.diagnosis import DiagnosisService
from app.schemas.diagnosis import DiagnosisResponse

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class DiagnoseRequest(BaseModel):
    ticker: str


@router.post("/diagnose", response_model=DiagnosisResponse)
@limiter.limit("10/minute")
async def diagnose(request: Request, body: DiagnoseRequest) -> dict:
    """
    주식 종목 하락 추세 정밀 진단 - 7개 지표 자동 체크 (phase / severity / duration)
    """
    ticker = body.ticker.strip()

    import re
    if not re.match(r"^\d{6}$", ticker):
        raise HTTPException(status_code=400, detail="종목 코드는 6자리 숫자여야 합니다")

    try:
        service = DiagnosisService()
        result = await service.diagnose(ticker)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"진단 처리 중 오류 발생: {str(e)}")
