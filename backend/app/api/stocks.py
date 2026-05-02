from fastapi import APIRouter, Query
from app.services.stock_list import search_stocks, is_loaded

router = APIRouter()


@router.get("/stocks")
async def search_stocks_api(q: str = Query("", max_length=50)) -> dict:
    """종목명/코드 자동완성 검색 엔드포인트"""
    q = q.strip()
    if not q:
        return {"loaded": is_loaded(), "results": []}

    results = search_stocks(q, limit=15)
    return {"loaded": is_loaded(), "results": results}
