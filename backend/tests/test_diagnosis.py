"""진단 로직 단위 테스트 (외부 API 미호출)"""
import numpy as np
import pandas as pd
import pytest

from app.services.diagnosis import (
    _fibonacci_level,
    _compute_phase,
    _compute_severity,
    _compute_duration,
    _detect_fake_signals,
    _apply_fake_downgrade,
    check_item_3,
    check_item_4,
    check_item_5,
)
from app.services.trend_timing import _pivot_low_val, _pivot_high_val


# ── 헬퍼 ─────────────────────────────────────────────────────────────

def _make_daily(closes: list[float], volumes: list[float] | None = None) -> pd.DataFrame:
    dates = pd.date_range("2022-01-01", periods=len(closes), freq="B")
    if volumes is None:
        volumes = [1_000_000] * len(closes)
    df = pd.DataFrame({
        "open":   closes,
        "high":   [c * 1.01 for c in closes],
        "low":    [c * 0.99 for c in closes],
        "close":  closes,
        "volume": volumes,
        "change": [0.0] * len(closes),
    }, index=dates)
    return df


def _make_items(
    checked_ids: set[int],
    age_map: dict[int, int] | None = None,
) -> list[dict]:
    """7개 항목 mock 생성. checked_ids에 속한 id는 checked=True."""
    weights = {1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 2, 7: 2}
    categories = {
        1: "추세 구조", 2: "추세 구조", 3: "이동평균",
        4: "이동평균", 5: "이동평균", 6: "모멘텀", 7: "추세 강도",
    }
    age_map = age_map or {}
    return [
        {
            "id": i,
            "category": categories[i],
            "label": f"항목{i}",
            "checked": i in checked_ids,
            "weight": weights[i],
            "evidence": "테스트",
            "manual": False,
            "signal_age_days": age_map.get(i) if i in checked_ids else None,
        }
        for i in range(1, 8)
    ]


# ── 피보나치 ─────────────────────────────────────────────────────────

def test_fibonacci_level():
    assert _fibonacci_level(10000, 5000, 0.618) == pytest.approx(6910.0, abs=1)
    assert _fibonacci_level(10000, 5000, 0.382) == pytest.approx(8090.0, abs=1)


# ── 피벗 헬퍼 (trend_timing) ─────────────────────────────────────────

def test_pivot_low_val_detects_lowest_before_recovery():
    vals = pd.Series([100.0, 90, 80, 70, 60, 70, 80, 90, 100, 110, 120])
    assert _pivot_low_val(vals, window=2) == pytest.approx(60.0)


def test_pivot_high_val_detects_highest_before_drop():
    vals = pd.Series([60.0, 70, 80, 90, 100, 90, 80, 70, 60, 50, 40])
    assert _pivot_high_val(vals, window=2) == pytest.approx(100.0)


def test_pivot_low_val_returns_none_for_short_series():
    assert _pivot_low_val(pd.Series([100.0, 90]), window=5) is None


# ── _compute_phase ───────────────────────────────────────────────────

def test_phase_healthy_no_core_signals():
    items = _make_items(checked_ids={4, 5})  # 핵심 신호(1, 3) 없음
    assert _compute_phase(items) == "healthy"


def test_phase_caution_one_core_signal():
    items = _make_items(checked_ids={1})  # item1만 True
    assert _compute_phase(items) == "caution"


def test_phase_caution_both_core_but_no_adx():
    items = _make_items(checked_ids={1, 3})  # ADX(id=7) 미통과
    assert _compute_phase(items) == "caution"


def test_phase_confirmed_both_core_and_adx():
    items = _make_items(checked_ids={1, 3, 7})
    assert _compute_phase(items) == "confirmed"


def test_phase_confirmed_ignores_non_core():
    # id=1, 3, 7만 확인, 나머지는 무관
    items = _make_items(checked_ids={1, 2, 3, 4, 5, 6, 7})
    assert _compute_phase(items) == "confirmed"


# ── _compute_severity ────────────────────────────────────────────────

def test_severity_none_checked():
    items = _make_items(checked_ids=set())
    sev = _compute_severity(items)
    assert sev["total"] == 0
    assert sev["level"] == "low"
    assert sev["structure"] == 0
    assert sev["trend_ma"] == 0
    assert sev["momentum"] == 0
    assert sev["trend_strength"] == 0


def test_severity_all_checked():
    items = _make_items(checked_ids={1, 2, 3, 4, 5, 6, 7})
    sev = _compute_severity(items)
    assert sev["total"] == 100
    assert sev["level"] == "extreme"
    assert sev["structure"] == 100
    assert sev["trend_ma"] == 100
    assert sev["momentum"] == 100
    assert sev["trend_strength"] == 100


def test_severity_level_thresholds():
    # total 0 → low
    assert _compute_severity(_make_items(set()))["level"] == "low"
    # id=1(3pt) 체크 → danger=3, max=17 → total=18% → low
    assert _compute_severity(_make_items({1}))["level"] == "low"
    # id=1,2,3(9pt) 체크 → danger=9, max=17 → total=53% → mid
    assert _compute_severity(_make_items({1, 2, 3}))["level"] == "mid"
    # id=1,2,3,4,5(13pt) → 76% → high
    assert _compute_severity(_make_items({1, 2, 3, 4, 5}))["level"] == "high"
    # 전부 → 100% → extreme
    assert _compute_severity(_make_items({1, 2, 3, 4, 5, 6, 7}))["level"] == "extreme"


def test_severity_structure_partial():
    # id=1(w=3)만 체크, 구조 max=6 → structure=50%
    items = _make_items(checked_ids={1})
    sev = _compute_severity(items)
    assert sev["structure"] == 50


# ── _compute_duration ────────────────────────────────────────────────

def test_duration_no_active_signals():
    items = _make_items(checked_ids=set())
    dur = _compute_duration(items)
    assert dur["primary_days"] is None
    assert dur["stage"] is None
    assert dur["all_signals"] == []


def test_duration_stage_fresh():
    items = _make_items(checked_ids={1, 3}, age_map={1: 2, 3: 1})
    dur = _compute_duration(items)
    assert dur["primary_days"] == 2
    assert dur["stage"] == "fresh"


def test_duration_stage_early():
    items = _make_items(checked_ids={1, 3}, age_map={1: 7, 3: 5})
    dur = _compute_duration(items)
    assert dur["primary_days"] == 7
    assert dur["stage"] == "early"


def test_duration_stage_established():
    items = _make_items(checked_ids={1, 3}, age_map={1: 20, 3: 15})
    dur = _compute_duration(items)
    assert dur["primary_days"] == 20
    assert dur["stage"] == "established"


def test_duration_stage_extended():
    items = _make_items(checked_ids={1, 3}, age_map={1: 45, 3: 40})
    dur = _compute_duration(items)
    assert dur["primary_days"] == 45
    assert dur["stage"] == "extended"


def test_duration_primary_uses_max_of_core_signals():
    # 핵심 신호 id=1(10일), id=3(30일) → primary=30
    items = _make_items(checked_ids={1, 3}, age_map={1: 10, 3: 30})
    dur = _compute_duration(items)
    assert dur["primary_days"] == 30


def test_duration_fallback_to_any_signal_when_no_core():
    # 핵심 신호(1, 3) 없이 id=6만 체크
    items = _make_items(checked_ids={6}, age_map={6: 8})
    dur = _compute_duration(items)
    assert dur["primary_days"] == 8
    assert dur["stage"] == "early"


def test_duration_all_signals_sorted_by_days_desc():
    items = _make_items(checked_ids={1, 2, 3}, age_map={1: 5, 2: 15, 3: 10})
    dur = _compute_duration(items)
    days = [s["days_ago"] for s in dur["all_signals"]]
    assert days == sorted(days, reverse=True)


# ── _detect_fake_signals ─────────────────────────────────────────────

def _dur(stage):
    return {"stage": stage, "primary_days": 2, "all_signals": []}


def _rs(label):
    return {"value": 0.0, "label": label, "stock_return": 0.0,
            "index_return": 0.0, "index_label": "코스피200"}


def test_fake_signals_empty_when_established_and_weaker():
    fakes = _detect_fake_signals(_dur("established"), _rs("weaker_than_market"))
    assert fakes == []


def test_fake_signals_short_duration_when_fresh():
    fakes = _detect_fake_signals(_dur("fresh"), _rs("weaker_than_market"))
    assert "short_duration" in fakes
    assert "macro_aligned" not in fakes


def test_fake_signals_macro_aligned_when_not_weaker():
    fakes = _detect_fake_signals(_dur("established"), _rs("aligned"))
    assert "macro_aligned" in fakes
    assert "short_duration" not in fakes


def test_fake_signals_both_when_fresh_and_stronger():
    fakes = _detect_fake_signals(_dur("fresh"), _rs("stronger_than_market"))
    assert "short_duration" in fakes
    assert "macro_aligned" in fakes


# ── _apply_fake_downgrade ────────────────────────────────────────────

def test_downgrade_confirmed_to_caution_when_fakes():
    assert _apply_fake_downgrade("confirmed", ["short_duration"]) == "caution"
    assert _apply_fake_downgrade("confirmed", ["macro_aligned"]) == "caution"
    assert _apply_fake_downgrade("confirmed", ["short_duration", "macro_aligned"]) == "caution"


def test_no_downgrade_when_no_fakes():
    assert _apply_fake_downgrade("confirmed", []) == "confirmed"


def test_no_downgrade_caution_or_healthy():
    # caution / healthy는 페이크가 있어도 추가 다운그레이드 없음
    assert _apply_fake_downgrade("caution", ["short_duration", "macro_aligned"]) == "caution"
    assert _apply_fake_downgrade("healthy", ["short_duration", "macro_aligned"]) == "healthy"


# ── check_item_3 (200일선 + 기울기) ──────────────────────────────────

def test_item3_below_200sma_with_negative_slope():
    # 220봉 하락 → 현재가 < SMA200, 기울기 음수
    closes = [5000 - i * 5 for i in range(220)]
    daily = _make_daily(closes)
    result = check_item_3(daily)
    assert result["id"] == 3
    assert result["checked"] is True
    assert result["signal_age_days"] is not None


def test_item3_above_200sma():
    # 220봉 상승 → 현재가 > SMA200
    closes = [1000 + i * 5 for i in range(220)]
    daily = _make_daily(closes)
    result = check_item_3(daily)
    assert result["checked"] is False
    assert result["signal_age_days"] is None


# ── check_item_4 (60일선 + 기울기) ───────────────────────────────────

def test_item4_below_60sma_with_negative_slope():
    closes = [3000 - i * 10 for i in range(80)]
    daily = _make_daily(closes)
    result = check_item_4(daily)
    assert result["id"] == 4
    assert result["checked"] is True


def test_item4_above_60sma():
    closes = [1000 + i * 10 for i in range(80)]
    daily = _make_daily(closes)
    result = check_item_4(daily)
    assert result["checked"] is False


# ── check_item_5 (피보나치 0.618) ────────────────────────────────────

def test_item5_below_fib618():
    # 상승 후 급락 → 0.618 아래
    up = list(range(5000, 10000, 40))    # 상승 125봉
    down = list(range(9960, 5000, -200)) # 급락
    closes = up + down
    daily = _make_daily(closes)
    result = check_item_5(daily)
    assert result["id"] == 5
    assert result["checked"] is True


def test_item5_above_fib618():
    # 126봉 횡보 → swing range 좁아 0.618 라인이 현재가 아래에 위치
    closes = [8000] * 126
    daily = _make_daily(closes)
    result = check_item_5(daily)
    assert result["checked"] is False
