"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import { BASE_CHART_OPTIONS, KRW_PRICE_FORMAT, toChartTime } from "./chartUtils";
import type { OhlcPoint, IndicatorPoint, FibLevels, PivotMarker } from "@/types";

interface OverlayLine {
  data: IndicatorPoint[];
  color: string;
  label: string;
}

interface PriceChartProps {
  ohlc: OhlcPoint[];
  overlays?: OverlayLine[];
  fibLevels?: FibLevels;
  pivots?: PivotMarker[];
  height?: number;
}

const FIB_COLORS: Record<string, string> = {
  "0": "#94a3b8",
  "0.236": "#a78bfa",
  "0.382": "#60a5fa",
  "0.5": "#fbbf24",
  "0.618": "#f87171",
  "0.786": "#fb923c",
  "1": "#94a3b8",
};

const FIB_LABELS: Record<string, string> = {
  "0": "0%",
  "0.236": "23.6%",
  "0.382": "38.2%",
  "0.5": "50%",
  "0.618": "61.8% ★",
  "0.786": "78.6%",
  "1": "100%",
};

export default function PriceChart({
  ohlc,
  overlays,
  fibLevels,
  pivots,
  height = 280,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || ohlc.length === 0) return;

    const chart = createChart(containerRef.current, {
      ...BASE_CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height,
    });

    // 한국 주식 색상: 상승=빨강, 하락=파랑
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderUpColor: "#ef4444",
      borderDownColor: "#3b82f6",
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
      priceFormat: KRW_PRICE_FORMAT,
    });

    candle.setData(
      ohlc.map((d) => ({
        time: toChartTime(d.time),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // 오버레이 라인 (SMA200, SMA60 등)
    overlays?.forEach((overlay) => {
      const line = chart.addSeries(LineSeries, {
        color: overlay.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: overlay.label,
        priceFormat: KRW_PRICE_FORMAT,
      });
      const validData = overlay.data
        .filter((d) => d.value !== null)
        .map((d) => ({
          time: toChartTime(d.time),
          value: d.value as number,
        }));
      line.setData(validData);
    });

    // 피보나치 수평선
    if (fibLevels) {
      Object.entries(fibLevels.levels).forEach(([key, price]) => {
        candle.createPriceLine({
          price,
          color: FIB_COLORS[key] ?? "#94a3b8",
          lineWidth: key === "0.618" ? 2 : 1,
          lineStyle: key === "0.618" ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: FIB_LABELS[key] ?? key,
        });
      });
    }

    // 피벗 마커 (직전 저점/고점 수평 참고선)
    if (pivots && pivots.length > 0) {
      const lastLow = [...pivots].filter((p) => p.type === "low").pop();
      const lastHigh = [...pivots].filter((p) => p.type === "high").pop();

      if (lastLow) {
        candle.createPriceLine({
          price: lastLow.price,
          color: "#3b82f6",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "직전 저점",
        });
      }
      if (lastHigh) {
        candle.createPriceLine({
          price: lastHigh.price,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "직전 고점",
        });
      }
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [ohlc, overlays, fibLevels, pivots, height]);

  return (
    <div
      ref={containerRef}
      className="price-chart w-full"
      style={{ height }}
      aria-label="가격 차트"
    />
  );
}
