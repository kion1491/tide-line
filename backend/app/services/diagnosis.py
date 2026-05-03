"""
주식 하락 추세 정밀 진단 서비스 v2
7개 핵심 지표로 3축(phase / severity / duration) 산출 + 페이크 검증(지속성·상대강도)
"""
import asyncio
import functools
from datetime import datetime, timedelta
from typing import Any, Literal

import numpy as np
import pandas as pd
import ta
from pykrx import stock

from app.services.trend_timing import (
    days_since_close_below_sma,
    days_since_slope_negative,
    days_since_pivot_low_break,
    days_since_pivot_high_failed,
    days_since_weekly_hl_break,
    days_since_fib_break,
    days_since_obv_slope_negative,
    days_since_adx_bearish,
    _pivot_low_val,
    _pivot_high_val,
)
from app.services.chart_data import build_chart_data


# ── 캐시 ─────────────────────────────────────────────────────────────

_cache: dict[str, tuple[datetime, Any]] = {}
_cache_lock = asyncio.Lock()
CACHE_TTL = 600


def _get_cache(key: str) -> Any | None:
    if key in _cache:
        ts, val = _cache[key]
        if (datetime.now() - ts).total_seconds() < CACHE_TTL:
            return val
    return None


def _set_cache(key: str, val: Any) -> None:
    _cache[key] = (datetime.now(), val)


# ── 데이터 조회 ───────────────────────────────────────────────────────

def _fetch_ohlcv(ticker: str, period_days: int = 400) -> pd.DataFrame:
    end = datetime.today().strftime("%Y%m%d")
    start = (datetime.today() - timedelta(days=period_days)).strftime("%Y%m%d")
    df = stock.get_market_ohlcv(start, end, ticker)
    if df.empty:
        raise ValueError(f"종목 코드 {ticker}의 데이터를 찾을 수 없습니다")
    df.columns = ["open", "high", "low", "close", "volume", "change"]
    return df


def _fetch_weekly_ohlcv(ticker: str, period_weeks: int = 104) -> pd.DataFrame:
    end = datetime.today().strftime("%Y%m%d")
    start = (datetime.today() - timedelta(weeks=period_weeks)).strftime("%Y%m%d")
    df = stock.get_market_ohlcv(start, end, ticker)
    if df.empty:
        raise ValueError(f"주봉 계산용 일봉 데이터 없음: {ticker}")
    df.columns = ["open", "high", "low", "close", "volume", "change"]
    weekly = df.resample("W").agg({
        "open": "first", "high": "max", "low": "min",
        "close": "last", "volume": "sum", "change": "last",
    }).dropna()
    return weekly


def _fetch_index_ohlcv(index_code: str, period_days: int = 400) -> pd.DataFrame:
    end = datetime.today().strftime("%Y%m%d")
    start = (datetime.today() - timedelta(days=period_days)).strftime("%Y%m%d")
    return stock.get_index_ohlcv(start, end, index_code)


# ── 피보나치 ─────────────────────────────────────────────────────────

def _fibonacci_level(high: float, low: float, ratio: float) -> float:
    return high - (high - low) * ratio


# ── 7개 지표 체크 함수 ───────────────────────────────────────────────

def check_item_1(weekly: pd.DataFrame) -> dict:
    """1. 주봉 HH-HL 구조 파괴 (핵심 신호 A)"""
    pivot_low = _pivot_low_val(weekly["low"])
    pivot_high = _pivot_high_val(weekly["high"])
    current = float(weekly["close"].iloc[-1])
    current_high = float(weekly["high"].iloc[-1])
    low_broken = pivot_low is not None and current < pivot_low
    high_failed = pivot_high is not None and current_high < pivot_high
    checked = low_broken and high_failed

    evidence = (
        f"주봉 직전 저점 {pivot_low:,.0f}원 이탈 + 반등 고점 {pivot_high:,.0f}원 회복 실패"
        if checked else "주봉 HH-HL 구조 유지 중"
    )
    age = days_since_weekly_hl_break(weekly) if checked else None
    return {
        "id": 1, "category": "추세 구조",
        "label": "주봉 HH-HL 구조 파괴",
        "checked": checked, "weight": 3, "evidence": evidence,
        "manual": False, "signal_age_days": age,
    }


def check_item_2(daily: pd.DataFrame) -> dict:
    """2. 일봉 swing 구조 손상 (저점 이탈 AND 고점 회복 실패 동시)"""
    pivot_low = _pivot_low_val(daily["low"])
    pivot_high = _pivot_high_val(daily["high"])
    current = float(daily["close"].iloc[-1])
    current_high = float(daily["high"].iloc[-1])

    low_broken = pivot_low is not None and current < pivot_low
    high_failed = pivot_high is not None and current_high < pivot_high
    checked = low_broken and high_failed

    evidence = (
        f"직전 swing low {pivot_low:,.0f}원 이탈 + 직전 swing high {pivot_high:,.0f}원 회복 실패"
        if checked else "일봉 swing 구조 정상 (저점 유지 또는 고점 회복)"
    )
    if checked:
        d1 = days_since_pivot_low_break(daily)
        d2 = days_since_pivot_high_failed(daily)
        age = max(v for v in [d1, d2] if v is not None) if any(v is not None for v in [d1, d2]) else None
    else:
        age = None

    return {
        "id": 2, "category": "추세 구조",
        "label": "일봉 swing 구조 손상",
        "checked": checked, "weight": 3, "evidence": evidence,
        "manual": False, "signal_age_days": age,
    }


def check_item_3(daily: pd.DataFrame) -> dict:
    """3. 200일선 종가 하향 이탈 + 기울기 음수 (핵심 신호 B)"""
    sma200 = ta.trend.sma_indicator(daily["close"], window=200)
    current = float(daily["close"].iloc[-1])
    sma_val = float(sma200.iloc[-1]) if not sma200.empty else None

    below = sma_val is not None and current < sma_val
    slope_neg = False
    slope_pct = 0.0
    if sma_val and len(sma200.dropna()) >= 6:
        prev = float(sma200.dropna().iloc[-6])
        slope_neg = sma_val < prev
        slope_pct = (sma_val - prev) / prev * 100 if prev != 0 else 0

    checked = below and slope_neg
    pct = ((current - sma_val) / sma_val * 100) if sma_val else 0
    evidence = (
        f"현재가 {current:,.0f} / 200일선 {sma_val:,.0f} ({pct:+.1f}%), 기울기 {slope_pct:+.2f}%"
        if sma_val else "200일선 계산 불가 (데이터 부족)"
    )
    age = days_since_close_below_sma(daily, 200) if checked else None
    return {
        "id": 3, "category": "이동평균",
        "label": "200일선 하향 이탈 + 우하향",
        "checked": checked, "weight": 3, "evidence": evidence,
        "manual": False, "signal_age_days": age,
    }


def check_item_4(daily: pd.DataFrame) -> dict:
    """4. 60일선 종가 하향 이탈 + 기울기 음수"""
    sma60 = ta.trend.sma_indicator(daily["close"], window=60)
    current = float(daily["close"].iloc[-1])
    sma_val = float(sma60.iloc[-1]) if not sma60.empty else None

    below = sma_val is not None and current < sma_val
    slope_neg = False
    slope_pct = 0.0
    if sma_val and len(sma60.dropna()) >= 6:
        prev = float(sma60.dropna().iloc[-6])
        slope_neg = sma_val < prev
        slope_pct = (sma_val - prev) / prev * 100 if prev != 0 else 0

    checked = below and slope_neg
    pct = ((current - sma_val) / sma_val * 100) if sma_val else 0
    evidence = (
        f"현재가 {current:,.0f} / 60일선 {sma_val:,.0f} ({pct:+.1f}%), 기울기 {slope_pct:+.2f}%"
        if sma_val else "60일선 계산 불가"
    )
    age = days_since_close_below_sma(daily, 60) if checked else None
    return {
        "id": 4, "category": "이동평균",
        "label": "60일선 하향 이탈 + 우하향",
        "checked": checked, "weight": 2, "evidence": evidence,
        "manual": False, "signal_age_days": age,
    }


def check_item_5(daily: pd.DataFrame) -> dict:
    """5. 피보나치 0.618 라인 종가 이탈"""
    recent = daily.tail(126)
    swing_high = float(recent["high"].max())
    swing_low = float(recent["low"].min())
    fib618 = _fibonacci_level(swing_high, swing_low, 0.618)
    current = float(daily["close"].iloc[-1])
    checked = current < fib618

    evidence = f"0.618 라인 {fib618:,.0f}원 → 현재가 {current:,.0f}원 ({'이탈' if checked else '유지'})"
    age = days_since_fib_break(daily) if checked else None
    return {
        "id": 5, "category": "이동평균",
        "label": "피보나치 0.618 라인 이탈",
        "checked": checked, "weight": 2, "evidence": evidence,
        "manual": False, "signal_age_days": age,
    }


def check_item_6(daily: pd.DataFrame) -> dict:
    """6. OBV 우하향 + 하락봉 거래량 증폭 (동시 충족)"""
    obv = ta.volume.on_balance_volume(daily["close"], daily["volume"])
    obv_slope = float(obv.iloc[-1] - obv.iloc[-21]) if len(obv) >= 21 else 0
    base = abs(float(obv.iloc[-21])) if len(obv) >= 21 and abs(float(obv.iloc[-21])) > 0 else 1
    obv_slope_pct = obv_slope / base * 100

    vol_ma20 = float(daily["volume"].rolling(20).mean().iloc[-1])
    recent_down = daily[daily["close"] < daily["open"]].tail(5)
    avg_down_vol = float(recent_down["volume"].mean()) if not recent_down.empty else 0
    vol_ratio = avg_down_vol / vol_ma20 if vol_ma20 > 0 else 0

    obv_bearish = obv_slope < 0
    vol_bearish = vol_ratio > 1.2
    checked = obv_bearish and vol_bearish

    evidence = (
        f"OBV 20일 기울기 {obv_slope_pct:+.1f}% / 하락봉 거래량 {vol_ratio:.2f}x (기준 1.2x)"
    )
    age = days_since_obv_slope_negative(daily) if checked else None
    return {
        "id": 6, "category": "모멘텀",
        "label": "OBV 우하향 + 하락 거래량 증폭",
        "checked": checked, "weight": 2, "evidence": evidence,
        "manual": False, "signal_age_days": age,
    }


def check_item_7(daily: pd.DataFrame) -> dict:
    """7. ADX(14) ≥ 25 AND -DI > +DI — 실제 하락 추세 강도 확인"""
    try:
        adx_ind = ta.trend.ADXIndicator(
            daily["high"], daily["low"], daily["close"], window=14
        )
        adx_val = float(adx_ind.adx().iloc[-1])
        dip_val = float(adx_ind.adx_pos().iloc[-1])  # +DI
        din_val = float(adx_ind.adx_neg().iloc[-1])  # -DI

        strong_trend = adx_val >= 25
        bearish_dir = din_val > dip_val
        checked = strong_trend and bearish_dir

        evidence = f"ADX {adx_val:.1f} / +DI {dip_val:.1f} / -DI {din_val:.1f}"
    except Exception as e:
        checked = False
        evidence = f"ADX 계산 실패: {e}"

    age = days_since_adx_bearish(daily) if checked else None
    return {
        "id": 7, "category": "추세 강도",
        "label": "ADX 추세 강도 확인 (-DI > +DI)",
        "checked": checked, "weight": 2, "evidence": evidence,
        "manual": False, "signal_age_days": age,
    }


# ── 상대 강도 (별도 축) ──────────────────────────────────────────────

def _compute_relative_strength(daily: pd.DataFrame, etf_ticker: str) -> tuple[dict, pd.DataFrame | None]:
    try:
        end = datetime.today().strftime("%Y%m%d")
        start_45 = (datetime.today() - timedelta(days=45)).strftime("%Y%m%d")
        etf_df = stock.get_market_ohlcv(start_45, end, etf_ticker)
        etf_df.columns = ["open", "high", "low", "close", "volume", "change"]

        if len(etf_df) < 22 or len(daily) < 22:
            raise ValueError("데이터 부족")

        stock_ret = (float(daily["close"].iloc[-1]) / float(daily["close"].iloc[-22]) - 1) * 100
        index_ret = (float(etf_df["close"].iloc[-1]) / float(etf_df["close"].iloc[-22]) - 1) * 100
        diff = round(stock_ret - index_ret, 2)
        index_label = "코스닥150" if etf_ticker == "229200" else "코스피200"

        if diff < -2:
            label = "weaker_than_market"
        elif diff > 2:
            label = "stronger_than_market"
        else:
            label = "aligned"

        return {
            "value": diff,
            "label": label,
            "stock_return": round(stock_ret, 2),
            "index_return": round(index_ret, 2),
            "index_label": index_label,
        }, etf_df
    except Exception:
        return {
            "value": 0.0,
            "label": "aligned",
            "stock_return": 0.0,
            "index_return": 0.0,
            "index_label": "코스피200",
        }, None


# ── 3축 산출 함수 ────────────────────────────────────────────────────

def _get_item(items: list[dict], item_id: int) -> dict:
    return next(i for i in items if i["id"] == item_id)


def _compute_phase(items: list[dict]) -> str:
    """
    핵심 신호 = item1(주봉 구조) AND item3(200일선)
    confirmed_raw: 둘 다 True + item7(ADX) True
    caution_raw:   핵심 중 하나만 True, 또는 둘 다인데 ADX 미통과
    healthy_raw:   핵심 신호 0개
    """
    core_weekly = _get_item(items, 1)["checked"]
    core_ma200  = _get_item(items, 3)["checked"]
    adx_pass    = _get_item(items, 7)["checked"]

    core_both = core_weekly and core_ma200
    core_any = core_weekly or core_ma200

    if core_both and adx_pass:
        return "confirmed"
    elif core_any:
        return "caution"
    else:
        return "healthy"


def _compute_severity(items: list[dict]) -> dict:
    max_raw = sum(i["weight"] for i in items)
    danger_raw = sum(i["weight"] for i in items if i["checked"])
    total = round(danger_raw / max_raw * 100) if max_raw > 0 else 0

    def pct(ids: list[int]) -> int:
        subset = [i for i in items if i["id"] in ids]
        m = sum(i["weight"] for i in subset)
        d = sum(i["weight"] for i in subset if i["checked"])
        return round(d / m * 100) if m > 0 else 0

    level = (
        "extreme" if total >= 80
        else "high" if total >= 56
        else "mid" if total >= 30
        else "low"
    )

    return {
        "total": total,
        "structure": pct([1, 2]),
        "trend_ma": pct([3, 4, 5]),
        "momentum": pct([6]),
        "trend_strength": pct([7]),
        "level": level,
        "max_raw": max_raw,
        "danger_raw": danger_raw,
    }


def _compute_duration(items: list[dict]) -> dict:
    active = [
        i for i in items
        if i["checked"] and i.get("signal_age_days") is not None
    ]
    all_signals = sorted(
        [{"id": i["id"], "label": i["label"], "days_ago": i["signal_age_days"]} for i in active],
        key=lambda x: x["days_ago"],
        reverse=True,
    )

    # 핵심 신호(id 1, 3) 기준 primary_days
    core_active = [i for i in active if i["id"] in (1, 3)]
    if core_active:
        primary_days = max(i["signal_age_days"] for i in core_active)
    elif active:
        primary_days = max(i["signal_age_days"] for i in active)
    else:
        primary_days = None

    stage = None
    if primary_days is not None:
        if primary_days <= 3:
            stage = "fresh"
        elif primary_days <= 10:
            stage = "early"
        elif primary_days <= 30:
            stage = "established"
        else:
            stage = "extended"

    return {
        "primary_days": primary_days,
        "stage": stage,
        "all_signals": all_signals,
    }


def _detect_fake_signals(duration: dict, rel_strength: dict) -> list[str]:
    fakes = []
    if duration["stage"] == "fresh":
        fakes.append("short_duration")
    if rel_strength["label"] != "weaker_than_market":
        fakes.append("macro_aligned")
    return fakes


def _apply_fake_downgrade(raw_phase: str, fake_signals: list[str]) -> str:
    if raw_phase == "confirmed" and fake_signals:
        return "caution"
    return raw_phase


def _compose_interpretation(
    phase: str,
    phase_raw: str,
    severity: dict,
    duration: dict,
    rel_strength: dict,
    fake_signals: list[str],
    items: list[dict],
) -> dict:
    # 종합 요약 한 문장
    if phase == "healthy":
        summary = "주요 하락 추세 신호가 발생하지 않았습니다. 현재 추세 구조는 안정적입니다."
    elif phase == "caution":
        parts = []
        if duration["primary_days"]:
            parts.append(f"{duration['primary_days']}일 전부터 하락 신호 감지")
        parts.append(f"심각도 {severity['level']}")
        if "short_duration" in fake_signals:
            parts.append("신호 기간이 짧아 단기 파동 가능성 있음")
        if "macro_aligned" in fake_signals:
            parts.append("시장 전반과 동조 중")
        summary = ". ".join(parts) + "."
    else:  # confirmed
        days_str = f"{duration['primary_days']}일 전부터 " if duration["primary_days"] else ""
        summary = (
            f"{days_str}핵심 하락 신호(주봉 구조 파괴 + 200일선 이탈 + 추세 강도 확인) 동시 충족. "
            f"심각도 {severity['level']}."
        )

    # 핵심 손상 포인트 (checked 상위 3개)
    checked_items = [i for i in items if i["checked"]]
    key_damages = sorted(
        [
            {
                "label": i["label"],
                "days_ago": i.get("signal_age_days"),
                "weight": i["weight"],
            }
            for i in checked_items
        ],
        key=lambda x: (x["weight"], x["days_ago"] or 0),
        reverse=True,
    )[:3]

    # 정상화 회복 조건 (매매 추천 아님)
    recovery_map = {
        1: "주봉 직전 저점 회복 + 직전 고점 돌파 → 주봉 HH-HL 구조 정상화",
        2: "일봉 직전 저점 위로 종가 회복 + 직전 고점 초과",
        3: "200일선 종가 회복 후 3일 이상 유지 + 기울기 반등",
        4: "60일선 종가 회복 + 기울기 양전환",
        5: "피보나치 0.618 라인 종가 회복",
        6: "OBV 상승 전환 + 상승봉 거래량 우세",
        7: "ADX 하락 또는 +DI > -DI 역전 → 하락 추세 강도 약화",
    }
    recovery_signals = [
        recovery_map[i["id"]] for i in checked_items if i["id"] in recovery_map
    ]

    # 노이즈 경고
    noise_warning = None
    if "short_duration" in fake_signals and "macro_aligned" in fake_signals:
        noise_warning = (
            "신호 발생 기간이 매우 짧고, 시장 전반과 동조 중입니다. "
            "하락 추세로 단정하기 이릅니다."
        )
    elif "short_duration" in fake_signals:
        d = duration["primary_days"]
        noise_warning = (
            f"핵심 신호 발생 후 {d}일로, 단기 파동일 가능성이 있습니다. "
            "추가 봉 확인 후 재진단을 권장합니다."
        )
    elif "macro_aligned" in fake_signals:
        rs = rel_strength
        if rs["label"] == "stronger_than_market":
            noise_warning = (
                f"시장({rs['index_label']}) 대비 {abs(rs['value']):.1f}%p 더 강하게 버티고 있습니다. "
                "종목 고유 약세가 아닌 매크로 영향일 가능성이 있습니다."
            )
        else:
            noise_warning = (
                f"시장({rs['index_label']})과 비슷한 수준으로 하락 중입니다. "
                "종목 고유 약세인지 매크로 동조인지 추가 확인이 필요합니다."
            )

    return {
        "summary": summary,
        "key_damages": key_damages,
        "recovery_signals": recovery_signals,
        "noise_warning": noise_warning,
    }


# ── 진단 서비스 ──────────────────────────────────────────────────────

class DiagnosisService:
    async def diagnose(self, ticker: str) -> dict:
        cache_key = f"diagnose_v3:{ticker}"
        async with _cache_lock:
            cached = _get_cache(cache_key)
        if cached:
            return cached

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, functools.partial(self._run_diagnosis, ticker)
        )
        async with _cache_lock:
            _set_cache(cache_key, result)
        return result

    def _run_diagnosis(self, ticker: str) -> dict:
        # 종목명 조회
        try:
            name = stock.get_market_ticker_name(ticker)
        except Exception:
            name = ticker

        # 데이터 조회
        daily = _fetch_ohlcv(ticker)
        weekly = _fetch_weekly_ohlcv(ticker)
        current_price = int(daily["close"].iloc[-1])

        # 코스피/코스닥 판단 → ETF 프록시 선택
        try:
            kosdaq_list = stock.get_market_ticker_list(market="KOSDAQ")
            etf_ticker = "229200" if ticker in kosdaq_list else "069500"
        except Exception:
            etf_ticker = "069500"

        # 7개 항목 계산
        items = [
            check_item_1(weekly),
            check_item_2(daily),
            check_item_3(daily),
            check_item_4(daily),
            check_item_5(daily),
            check_item_6(daily),
            check_item_7(daily),
        ]

        # 3축 산출
        phase_raw = _compute_phase(items)
        severity = _compute_severity(items)
        duration = _compute_duration(items)
        rel_strength, etf_df = _compute_relative_strength(daily, etf_ticker)

        # 페이크 검증 + phase 보정
        fake_signals = _detect_fake_signals(duration, rel_strength)
        phase = _apply_fake_downgrade(phase_raw, fake_signals)

        # 종합 해석
        interpretation = _compose_interpretation(
            phase, phase_raw, severity, duration, rel_strength, fake_signals, items
        )

        chart_data = build_chart_data(daily, weekly, etf_df=etf_df, index_label=rel_strength["index_label"])

        return {
            "ticker": ticker,
            "name": name,
            "current_price": current_price,
            "phase": phase,
            "phase_raw": phase_raw,
            "severity": severity,
            "duration": duration,
            "relative_strength": rel_strength,
            "fake_signals": fake_signals,
            "interpretation": interpretation,
            "items": items,
            "disclosures_count": 0,
            "chart_data": chart_data,
        }
