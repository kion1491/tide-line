"""
주식 목록 서비스 - DART API corpCode.xml 직접 호출
dart_fss 라이브러리 버그 우회 + pykrx 휴장일 이슈 우회
"""
import asyncio
import io
import logging
import zipfile
import xml.etree.ElementTree as ET
from functools import lru_cache

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_STOCK_LIST: list[dict[str, str]] = []
_TICKER_TO_CORP: dict[str, str] = {}
_LOADED = False
_LOAD_ERROR: str = ""

DART_CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"


def _fetch_corp_list_sync() -> list[dict[str, str]]:
    """DART API에서 ZIP XML 다운로드 → 상장 종목만 파싱"""
    if not settings.dart_api_key:
        raise RuntimeError("DART_API_KEY가 설정되지 않았습니다")

    resp = requests.get(
        DART_CORP_CODE_URL,
        params={"crtfc_key": settings.dart_api_key},
        timeout=30,
    )
    resp.raise_for_status()

    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    xml_bytes = zf.read("CORPCODE.xml")
    root = ET.fromstring(xml_bytes)

    result: list[dict[str, str]] = []
    for item in root.findall(".//list"):
        code = (item.findtext("stock_code") or "").strip()
        name = (item.findtext("corp_name") or "").strip()
        # 상장 종목: stock_code가 6자리 숫자
        corp_code = (item.findtext("corp_code") or "").strip()
        if code and len(code) == 6 and code.isdigit() and name:
            result.append({
                "ticker": code,
                "corp_code": corp_code,  # DART 8자리 법인코드
                "name": name,
                "display": f"{name}({code})",
                "name_lower": name.lower(),
            })

    return result


async def load_stock_list() -> None:
    global _STOCK_LIST, _TICKER_TO_CORP, _LOADED, _LOAD_ERROR
    try:
        logger.info("주식 목록 로딩 시작 (DART API)...")
        loop = asyncio.get_event_loop()
        _STOCK_LIST = await loop.run_in_executor(None, _fetch_corp_list_sync)
        _TICKER_TO_CORP = {s["ticker"]: s["corp_code"] for s in _STOCK_LIST if s.get("corp_code")}
        _LOADED = True
        logger.info(f"주식 목록 로딩 완료: {len(_STOCK_LIST)}개")
    except Exception as e:
        _LOAD_ERROR = str(e)
        logger.error(f"주식 목록 로딩 실패: {e}")


def is_loaded() -> bool:
    return _LOADED


def search_stocks(query: str, limit: int = 15) -> list[dict[str, str]]:
    """종목명 또는 코드로 검색, 우선순위 순 정렬"""
    if not query.strip() or not _LOADED:
        return []

    q = query.strip()
    q_lower = q.lower()
    is_numeric = q.isdigit()

    exact_ticker: list[dict] = []
    name_prefix: list[dict] = []
    ticker_prefix: list[dict] = []
    name_contains: list[dict] = []

    for stock in _STOCK_LIST:
        ticker = stock["ticker"]
        name_lower = stock["name_lower"]

        if is_numeric:
            if ticker == q:
                exact_ticker.append(stock)
            elif ticker.startswith(q):
                ticker_prefix.append(stock)
        else:
            if name_lower.startswith(q_lower):
                name_prefix.append(stock)
            elif q_lower in name_lower:
                name_contains.append(stock)

    # 우선순위: 코드 완전일치 > 이름 앞부분 > 코드 앞부분 > 이름 포함
    combined = exact_ticker + name_prefix + ticker_prefix + name_contains
    # 응답에서 내부 필드 제거
    return [
        {"ticker": s["ticker"], "name": s["name"], "display": s["display"]}
        for s in combined[:limit]
    ]


def get_corp_code_by_ticker(ticker: str) -> str | None:
    """종목 코드(ticker)로 DART 8자리 법인코드 반환 (목록 로딩 완료 후에만 유효)"""
    return _TICKER_TO_CORP.get(ticker) or None
