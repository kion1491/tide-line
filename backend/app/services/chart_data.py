"""
차트 시각화용 시계열 데이터 빌더
진단 결과에 첨부할 OHLCV + 인디케이터 직렬화
"""
import math
import pandas as pd
import ta


def _safe_float(val: object) -> float | None:
    """NaN/None → None, 그 외 float"""
    if val is None:
        return None
    try:
        f = float(val)  # type: ignore[arg-type]
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _serialize_ohlc(df: pd.DataFrame, n: int) -> list[dict]:
    """마지막 n봉을 OHLCV 리스트로 직렬화"""
    tail = df.tail(n)
    result = []
    for date, row in tail.iterrows():
        result.append({
            "time": date.strftime("%Y-%m-%d"),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row["volume"]),
        })
    return result


def _serialize_series(series: pd.Series, n: int) -> list[dict]:
    """Series 마지막 n개를 [{time, value}] 리스트로 직렬화 (NaN → None)"""
    tail = series.tail(n)
    result = []
    for date, val in tail.items():
        result.append({
            "time": date.strftime("%Y-%m-%d"),
            "value": _safe_float(val),
        })
    return result


def _extract_pivots(df: pd.DataFrame, window: int = 5, n_recent: int = 5) -> list[dict]:
    """최근 swing low/high pivot 추출 (마지막 n_recent개씩)"""
    low_pivots: list[dict] = []
    high_pivots: list[dict] = []
    lows = df["low"]
    highs = df["high"]

    # 마지막 봉은 미완성이므로 제외
    for i in range(window, len(df) - 1):
        window_lows = lows.iloc[max(0, i - window): i + window + 1]
        window_highs = highs.iloc[max(0, i - window): i + window + 1]

        if float(lows.iloc[i]) == float(window_lows.min()):
            low_pivots.append({
                "time": df.index[i].strftime("%Y-%m-%d"),
                "type": "low",
                "price": float(lows.iloc[i]),
                "_rank": i,
            })
        if float(highs.iloc[i]) == float(window_highs.max()):
            high_pivots.append({
                "time": df.index[i].strftime("%Y-%m-%d"),
                "type": "high",
                "price": float(highs.iloc[i]),
                "_rank": i,
            })

    recent_lows = sorted(low_pivots, key=lambda x: x["_rank"])[-n_recent:]
    recent_highs = sorted(high_pivots, key=lambda x: x["_rank"])[-n_recent:]

    combined = []
    for p in recent_lows + recent_highs:
        combined.append({"time": p["time"], "type": p["type"], "price": p["price"]})

    return sorted(combined, key=lambda x: x["time"])


def _compute_fib(daily: pd.DataFrame, lookback: int = 126) -> dict:
    """피보나치 7단계 레벨 계산"""
    recent = daily.tail(lookback)
    high = float(recent["high"].max())
    low = float(recent["low"].min())

    def fib_level(ratio: float) -> float:
        return round(high - (high - low) * ratio, 0)

    return {
        "high": high,
        "low": low,
        "levels": {
            "0": fib_level(0),
            "0.236": fib_level(0.236),
            "0.382": fib_level(0.382),
            "0.5": fib_level(0.5),
            "0.618": fib_level(0.618),
            "0.786": fib_level(0.786),
            "1": fib_level(1),
        },
    }


def _compute_relative_norm(
    daily: pd.DataFrame,
    etf_df: pd.DataFrame,
    n_days: int = 22,
) -> tuple[list[dict], list[dict]]:
    """종목·지수 수익률을 100 기준 정규화해서 [{time, value}] 반환"""
    stock_close = daily["close"].tail(n_days + 5)  # 여유분 확보
    etf_close = etf_df["close"]

    common_idx = stock_close.index.intersection(etf_close.index)
    if len(common_idx) < 2:
        return [], []

    stock = stock_close.loc[common_idx].tail(n_days)
    etf = etf_close.loc[common_idx].tail(n_days)

    base_s = float(stock.iloc[0])
    base_e = float(etf.iloc[0])
    if base_s == 0 or base_e == 0:
        return [], []

    stock_norm = stock / base_s * 100
    etf_norm = etf / base_e * 100

    def to_points(series: pd.Series) -> list[dict]:
        return [
            {"time": d.strftime("%Y-%m-%d"), "value": round(float(v), 2)}
            for d, v in series.items()
        ]

    return to_points(stock_norm), to_points(etf_norm)


def build_chart_data(
    daily: pd.DataFrame,
    weekly: pd.DataFrame,
    etf_df: pd.DataFrame | None = None,
    index_label: str = "코스피200",
) -> dict:
    """진단에 첨부할 차트 데이터 빌드 (인디케이터 재계산 포함)"""
    DAILY_N = 200
    WEEKLY_N = 52

    sma200 = ta.trend.sma_indicator(daily["close"], window=200)
    sma60 = ta.trend.sma_indicator(daily["close"], window=60)
    obv = ta.volume.on_balance_volume(daily["close"], daily["volume"])

    try:
        adx_ind = ta.trend.ADXIndicator(daily["high"], daily["low"], daily["close"], window=14)
        adx_series = adx_ind.adx()
        di_plus_series = adx_ind.adx_pos()
        di_minus_series = adx_ind.adx_neg()
    except Exception:
        nan_series = pd.Series([float("nan")] * len(daily), index=daily.index)
        adx_series = nan_series
        di_plus_series = nan_series.copy()
        di_minus_series = nan_series.copy()

    if etf_df is not None:
        rel_stock, rel_index = _compute_relative_norm(daily, etf_df)
    else:
        rel_stock, rel_index = [], []

    return {
        "daily": _serialize_ohlc(daily, DAILY_N),
        "weekly": _serialize_ohlc(weekly, WEEKLY_N),
        "sma200": _serialize_series(sma200, DAILY_N),
        "sma60": _serialize_series(sma60, DAILY_N),
        "obv": _serialize_series(obv, DAILY_N),
        "adx": _serialize_series(adx_series, DAILY_N),
        "di_plus": _serialize_series(di_plus_series, DAILY_N),
        "di_minus": _serialize_series(di_minus_series, DAILY_N),
        "fib": _compute_fib(daily),
        "pivots_daily": _extract_pivots(daily.tail(DAILY_N + 20), window=5, n_recent=5),
        "pivots_weekly": _extract_pivots(weekly.tail(WEEKLY_N + 10), window=3, n_recent=5),
        "relative_stock": rel_stock,
        "relative_index": rel_index,
        "relative_index_label": index_label,
    }
