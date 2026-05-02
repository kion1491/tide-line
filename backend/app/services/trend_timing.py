"""
추세 신호 지속 기간 계산 헬퍼
각 위험 신호가 현재 활성 상태일 때, 몇 봉(거래일) 전부터 시작됐는지 반환한다.
반환값: int (경과 봉 수) | None (현재 해당 신호 활성 아님)
"""
import pandas as pd
import ta


# ── 내부 유틸 ────────────────────────────────────────────────────────

def _pivot_low_val(series: pd.Series, window: int = 5) -> float | None:
    values = series.values
    for i in range(len(values) - window - 1, window - 1, -1):
        c = values[i]
        if c < min(values[i - window:i]) and c < min(values[i + 1:i + window + 1]):
            return float(c)
    return None


def _pivot_high_val(series: pd.Series, window: int = 5) -> float | None:
    values = series.values
    for i in range(len(values) - window - 1, window - 1, -1):
        c = values[i]
        if c > max(values[i - window:i]) and c > max(values[i + 1:i + window + 1]):
            return float(c)
    return None


def _days_since_condition_false(bool_series: pd.Series) -> int | None:
    """
    bool_series[-1] == True 인 상태에서,
    마지막으로 False였던 봉으로부터 경과 봉 수를 반환.
    현재 False이면 None 반환.
    """
    if len(bool_series) == 0 or not bool_series.iloc[-1]:
        return None
    values = bool_series.values
    n = len(values)
    for i in range(n - 2, -1, -1):
        if not values[i]:
            return n - 1 - i
    # 전체 데이터가 True인 경우
    return n - 1


# ── 공개 헬퍼 ────────────────────────────────────────────────────────

def days_since_close_below_sma(daily: pd.DataFrame, period: int) -> int | None:
    """종가가 period일 SMA 아래로 진입한 지 며칠. 현재 SMA 이상이면 None."""
    sma = ta.trend.sma_indicator(daily["close"], window=period)
    below = daily["close"] < sma
    return _days_since_condition_false(below.dropna())


def days_since_slope_negative(series: pd.Series, lookback: int = 5) -> int | None:
    """시리즈 기울기(lookback 구간)가 음수가 된 지 며칠. 현재 양수/NaN이면 None."""
    if len(series) < lookback + 2:
        return None
    slope = series.diff(lookback)
    negative = slope < 0
    return _days_since_condition_false(negative.dropna())


def days_since_pivot_low_break(daily: pd.DataFrame, window: int = 5) -> int | None:
    """일봉 swing low 이탈 후 며칠. 이탈 안 했으면 None."""
    pivot_low = _pivot_low_val(daily["low"], window=window)
    if pivot_low is None:
        return None
    below = daily["close"] < pivot_low
    return _days_since_condition_false(below)


def days_since_pivot_high_failed(daily: pd.DataFrame, window: int = 5) -> int | None:
    """직전 swing high 회복 실패 후 며칠. 고점 초과했으면 None."""
    pivot_high = _pivot_high_val(daily["high"], window=window)
    if pivot_high is None:
        return None
    failed = daily["high"] < pivot_high
    return _days_since_condition_false(failed)


def days_since_weekly_hl_break(weekly: pd.DataFrame, window: int = 5) -> int | None:
    """
    주봉 HH-HL 구조 파괴(저점 이탈 AND 고점 회복 실패) 후 거래일 수.
    주봉×5로 거래일 근사. 미이탈이면 None.
    """
    pivot_low = _pivot_low_val(weekly["low"], window=window)
    pivot_high = _pivot_high_val(weekly["high"], window=window)

    low_broken = pivot_low is not None and float(weekly["close"].iloc[-1]) < pivot_low
    high_failed = pivot_high is not None and float(weekly["high"].iloc[-1]) < pivot_high

    if not (low_broken and high_failed):
        return None

    close_vals = weekly["close"].values
    high_vals = weekly["high"].values
    n = len(close_vals)

    for i in range(n - 2, window - 1, -1):
        c_low = pivot_low is not None and close_vals[i] < pivot_low
        c_high = pivot_high is not None and high_vals[i] < pivot_high
        if not (c_low and c_high):
            return (n - 1 - i) * 5  # 주봉 → 거래일

    return max(0, n - 1 - window) * 5


def days_since_fib_break(daily: pd.DataFrame, ratio: float = 0.618, lookback: int = 126) -> int | None:
    """피보나치 ratio 라인 이탈 후 며칠. 이탈 안 했으면 None."""
    recent = daily.tail(lookback)
    swing_high = float(recent["high"].max())
    swing_low = float(recent["low"].min())
    fib_level = swing_high - (swing_high - swing_low) * ratio

    below = daily["close"] < fib_level
    return _days_since_condition_false(below)


def days_since_obv_slope_negative(daily: pd.DataFrame, lookback: int = 20) -> int | None:
    """OBV lookback일 기울기가 음수가 된 지 며칠. 양수이면 None."""
    obv = ta.volume.on_balance_volume(daily["close"], daily["volume"])
    return days_since_slope_negative(obv, lookback=lookback)


def days_since_adx_bearish(
    daily: pd.DataFrame,
    adx_window: int = 14,
    adx_threshold: float = 25,
) -> int | None:
    """ADX≥threshold AND -DI>+DI 조건이 충족된 지 며칠. 미충족이면 None."""
    adx_ind = ta.trend.ADXIndicator(
        daily["high"], daily["low"], daily["close"], window=adx_window
    )
    adx = adx_ind.adx()
    dip = adx_ind.adx_pos()  # +DI
    din = adx_ind.adx_neg()  # -DI

    bearish = (adx >= adx_threshold) & (din > dip)
    return _days_since_condition_false(bearish.dropna())
