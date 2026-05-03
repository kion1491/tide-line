"""
DART 공시 서비스 - DART Open API + 뷰어 직접 호출 (dart_fss 버그 우회)
법인코드(corp_code)는 stock_list의 corpCode.xml 파싱 결과를 우선 사용하고,
미로딩 시 /api/company.json 폴백으로 조회한다.
공시 본문은 DART 뷰어 페이지 스크래핑으로 가져온다.
"""
import asyncio
import functools
import logging
import re
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup

from app.core.config import settings
from app.services.stock_list import get_corp_code_by_ticker

logger = logging.getLogger(__name__)

DART_BASE = "https://opendart.fss.or.kr/api"

# corp_code 메모리 캐시 (ticker → corp_code)
_CORP_CODE_CACHE: dict[str, str] = {}
# 공시 목록 캐시 (ticker:days → (timestamp, list))
_DISCLOSURE_CACHE: dict[str, tuple[datetime, list]] = {}
CACHE_TTL = 600  # 10분


def _get_dart_params(extra: dict | None = None) -> dict:
    params = {"crtfc_key": settings.dart_api_key}
    if extra:
        params.update(extra)
    return params


def _resolve_corp_code(ticker: str) -> str:
    """ticker → DART 8자리 법인코드 조회 (캐시 → stock_list → DART API 순)"""
    # 1. 메모리 캐시
    if ticker in _CORP_CODE_CACHE:
        return _CORP_CODE_CACHE[ticker]

    # 2. 로딩 완료된 stock_list에서 조회
    corp_code = get_corp_code_by_ticker(ticker)
    if corp_code:
        _CORP_CODE_CACHE[ticker] = corp_code
        return corp_code

    # 3. DART company.json 폴백
    if not settings.dart_api_key:
        raise RuntimeError("DART_API_KEY가 설정되지 않았습니다")

    resp = requests.get(
        f"{DART_BASE}/company.json",
        params=_get_dart_params({"stock_code": ticker}),
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") != "000":
        raise ValueError(f"종목 코드 {ticker}에 해당하는 법인 정보를 찾을 수 없습니다")

    corp_code = data.get("corp_code", "").strip()
    if not corp_code:
        raise ValueError(f"종목 코드 {ticker}에 대한 법인 코드가 없습니다")

    _CORP_CODE_CACHE[ticker] = corp_code
    return corp_code


def _estimate_tokens(report_nm: str) -> int:
    token_map = {
        "사업보고서": 80000,
        "분기보고서": 50000,
        "반기보고서": 60000,
        "주요사항보고서": 3000,
        "공정공시": 2000,
        "주주총회": 5000,
        "임원·주요주주": 1500,
        "자기주식": 2000,
    }
    for key, val in token_map.items():
        if key in report_nm:
            return val
    return 2000


def _fetch_disclosures_sync(ticker: str, days: int) -> list[dict]:
    if not settings.dart_api_key:
        raise RuntimeError("DART_API_KEY가 설정되지 않았습니다")

    corp_code = _resolve_corp_code(ticker)

    end_de = datetime.today().strftime("%Y%m%d")
    bgn_de = (datetime.today() - timedelta(days=days)).strftime("%Y%m%d")

    resp = requests.get(
        f"{DART_BASE}/list.json",
        params=_get_dart_params({
            "corp_code": corp_code,
            "bgn_de": bgn_de,
            "end_de": end_de,
            "page_count": 40,
        }),
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    # status "013" = 데이터 없음 (정상)
    if data.get("status") == "013":
        return []

    if data.get("status") != "000":
        logger.warning(f"DART list.json 오류 {ticker}: {data.get('message')}")
        return []

    results = []
    for item in data.get("list", []):
        rcept_no = item.get("rcept_no", "")
        if not rcept_no:
            continue
        rcept_dt = item.get("rcept_dt", "")
        date_str = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:8]}" if len(rcept_dt) == 8 else rcept_dt
        report_nm = item.get("report_nm", "")
        results.append({
            "rcept_no": rcept_no,
            "title": report_nm,
            "date": date_str,
            "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}",
            "est_tokens": _estimate_tokens(report_nm),
        })

    return results


_VIEWER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
_DART_VIEWER_BASE = "https://dart.fss.or.kr"


def _parse_first_node(html: str) -> dict | None:
    """DART main.do 응답 JavaScript에서 첫 번째 node 정보 파싱"""
    fields = re.findall(r"node\d+\['(\w+)'\]\s*=\s*[\"']([^\"']*)[\"']", html)
    node: dict[str, str] = {}
    for key, val in fields:
        if key not in node:
            node[key] = val
    return node if node.get("dcmNo") else None


def _fetch_content_sync(rcept_no: str) -> dict:
    """DART 뷰어 페이지를 통해 공시 본문 텍스트 추출"""
    session = requests.Session()
    session.headers.update(_VIEWER_HEADERS)

    # 1. main.do에서 dcmNo, eleId, offset, length, dtd 파싱
    main_resp = session.get(
        f"{_DART_VIEWER_BASE}/dsaf001/main.do",
        params={"rcpNo": rcept_no},
        timeout=15,
    )
    main_resp.raise_for_status()

    node = _parse_first_node(main_resp.text)
    if not node:
        raise ValueError(f"공시 문서 구조를 파싱할 수 없습니다 (rcept_no={rcept_no})")

    # 2. viewer.do에서 문서 HTML 취득
    viewer_resp = session.get(
        f"{_DART_VIEWER_BASE}/report/viewer.do",
        params={
            "rcpNo": rcept_no,
            "dcmNo": node["dcmNo"],
            "eleId": node.get("eleId", "0"),
            "offset": node.get("offset", "0"),
            "length": node.get("length", "50000"),
            "dtd": node.get("dtd", "dart3.xsd"),
        },
        headers={"Referer": f"{_DART_VIEWER_BASE}/dsaf001/main.do?rcpNo={rcept_no}"},
        timeout=30,
    )
    viewer_resp.raise_for_status()

    soup = BeautifulSoup(viewer_resp.text, "lxml")
    content_text = soup.get_text(separator="\n", strip=True)

    if len(content_text) > 50_000:
        content_text = content_text[:50_000] + "\n\n[이하 생략 - 본문이 너무 깁니다]"

    return {
        "rcept_no": rcept_no,
        "title": node.get("text", ""),
        "date": "",
        "content_text": content_text,
    }


class DartService:
    async def get_disclosures(self, ticker: str, days: int) -> list[dict]:
        if not settings.dart_api_key:
            raise RuntimeError("DART API 키가 설정되지 않아 공시 기능을 사용할 수 없습니다")

        cache_key = f"{ticker}:{days}"
        if cache_key in _DISCLOSURE_CACHE:
            ts, val = _DISCLOSURE_CACHE[cache_key]
            if (datetime.now() - ts).total_seconds() < CACHE_TTL:
                return val

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, functools.partial(_fetch_disclosures_sync, ticker, days)
        )
        _DISCLOSURE_CACHE[cache_key] = (datetime.now(), result)
        return result

    async def get_disclosure_content(self, rcept_no: str) -> dict:
        if not settings.dart_api_key:
            raise RuntimeError("DART API 키가 설정되지 않아 공시 본문을 조회할 수 없습니다")

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, functools.partial(_fetch_content_sync, rcept_no)
        )
