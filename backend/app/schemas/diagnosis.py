from __future__ import annotations
from typing import Literal
from pydantic import BaseModel


# ── 차트 데이터 모델 ─────────────────────────────────────────────────

class OhlcPoint(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int | None = None


class IndicatorPoint(BaseModel):
    time: str
    value: float | None


class FibLevels(BaseModel):
    high: float
    low: float
    levels: dict[str, float]


class PivotMarker(BaseModel):
    time: str
    type: Literal["low", "high"]
    price: float


class ChartData(BaseModel):
    daily: list[OhlcPoint]
    weekly: list[OhlcPoint]
    sma200: list[IndicatorPoint]
    sma60: list[IndicatorPoint]
    obv: list[IndicatorPoint]
    adx: list[IndicatorPoint]
    di_plus: list[IndicatorPoint]
    di_minus: list[IndicatorPoint]
    fib: FibLevels
    pivots_daily: list[PivotMarker]
    pivots_weekly: list[PivotMarker]
    relative_stock: list[IndicatorPoint]
    relative_index: list[IndicatorPoint]
    relative_index_label: str


class DiagnosisItem(BaseModel):
    id: int
    category: str
    label: str
    checked: bool
    weight: int
    evidence: str
    manual: bool
    signal_age_days: int | None = None


class Severity(BaseModel):
    total: int
    structure: int
    trend_ma: int
    momentum: int
    trend_strength: int
    level: Literal["low", "mid", "high", "extreme"]
    max_raw: int
    danger_raw: int


class SignalAge(BaseModel):
    id: int
    label: str
    days_ago: int


class Duration(BaseModel):
    primary_days: int | None
    stage: Literal["fresh", "early", "established", "extended"] | None
    all_signals: list[SignalAge]


class RelativeStrength(BaseModel):
    value: float
    label: Literal["weaker_than_market", "aligned", "stronger_than_market"]
    stock_return: float
    index_return: float
    index_label: str


class KeyDamage(BaseModel):
    label: str
    days_ago: int | None
    weight: int


class Interpretation(BaseModel):
    summary: str
    key_damages: list[KeyDamage]
    recovery_signals: list[str]
    noise_warning: str | None


class DiagnosisResponse(BaseModel):
    ticker: str
    name: str
    current_price: int
    phase: Literal["healthy", "caution", "confirmed"]
    phase_raw: Literal["healthy", "caution", "confirmed"]
    severity: Severity
    duration: Duration
    relative_strength: RelativeStrength
    fake_signals: list[str]
    interpretation: Interpretation
    items: list[DiagnosisItem]
    disclosures_count: int
    chart_data: ChartData
