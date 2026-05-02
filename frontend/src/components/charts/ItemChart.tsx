"use client";

import PriceChart from "./PriceChart";
import IndicatorPanelChart from "./IndicatorPanelChart";
import VolumeOhlcChart from "./VolumeOhlcChart";
import type { DiagnosisItem, ChartData } from "@/types";

interface ItemChartProps {
  item: DiagnosisItem;
  chartData: ChartData;
}

export default function ItemChart({ item, chartData }: ItemChartProps) {
  const { id } = item;

  switch (id) {
    case 1:
      // 주봉 HH-HL 구조 파괴 — 주봉 캔들 + 직전 저점/고점 참고선
      return (
        <PriceChart
          ohlc={chartData.weekly}
          pivots={chartData.pivots_weekly}
          height={260}
        />
      );

    case 2:
      // 일봉 swing 구조 손상 — 일봉 캔들 + 직전 저점/고점 참고선
      return (
        <PriceChart
          ohlc={chartData.daily}
          pivots={chartData.pivots_daily}
          height={260}
        />
      );

    case 3:
      // 200일선 하향 이탈 + 우하향 — 일봉 라인 + SMA200 오버레이
      return (
        <PriceChart
          ohlc={chartData.daily}
          overlays={[{ data: chartData.sma200, color: "#f59e0b", label: "SMA200" }]}
          height={260}
        />
      );

    case 4:
      // 60일선 하향 이탈 + 우하향 — 일봉 라인 + SMA60 오버레이
      return (
        <PriceChart
          ohlc={chartData.daily}
          overlays={[{ data: chartData.sma60, color: "#8b5cf6", label: "SMA60" }]}
          height={260}
        />
      );

    case 5:
      // 피보나치 0.618 이탈 — 일봉 캔들 + 피보 7단 수평선
      return (
        <PriceChart
          ohlc={chartData.daily}
          fibLevels={chartData.fib}
          height={300}
        />
      );

    case 6:
      // OBV 우하향 + 거래량 증폭 — OBV 라인 + 거래량 히스토그램
      return (
        <VolumeOhlcChart
          obv={chartData.obv}
          ohlc={chartData.daily}
          height={320}
        />
      );

    case 7:
      // ADX 추세 강도 — ADX/+DI/-DI 3 라인 + 25 임계 점선
      return (
        <IndicatorPanelChart
          lines={[
            { data: chartData.adx, color: "#1d4ed8", label: "ADX" },
            { data: chartData.di_plus, color: "#16a34a", label: "+DI" },
            { data: chartData.di_minus, color: "#dc2626", label: "-DI" },
          ]}
          thresholds={[{ value: 25, color: "#94a3b8", label: "ADX 25" }]}
          height={220}
        />
      );

    default:
      return null;
  }
}
