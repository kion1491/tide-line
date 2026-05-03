"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import { BASE_CHART_OPTIONS, toChartTime } from "./chartUtils";
import type { OhlcPoint, IndicatorPoint } from "@/types";

interface VolumeOhlcChartProps {
  obv: IndicatorPoint[];
  ohlc: OhlcPoint[];
  height?: number;
}

export default function VolumeOhlcChart({
  obv,
  ohlc,
  height = 320,
}: VolumeOhlcChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || ohlc.length === 0) return;

    const chart = createChart(containerRef.current, {
      ...BASE_CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height,
    });

    // OBV 라인 (pane 0)
    const obvSeries = chart.addSeries(LineSeries, {
      color: "#7c3aed",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "OBV",
    });

    const validObv = obv
      .filter((d) => d.value !== null)
      .map((d) => ({
        time: toChartTime(d.time),
        value: d.value as number,
      }));
    obvSeries.setData(validObv);

    // 거래량 히스토그램 (pane 1 — 별도 창)
    const volSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" } },
      1
    );

    const volData = ohlc.map((d) => ({
      time: toChartTime(d.time),
      value: d.volume ?? 0,
      // 상승봉=빨강, 하락봉=파랑 (한국 기준)
      color: d.close >= d.open ? "#fca5a5" : "#93c5fd",
    }));
    volSeries.setData(volData);

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
  }, [obv, ohlc, height]);

  return (
    <div
      ref={containerRef}
      className="volume-obv-chart w-full"
      style={{ height }}
      aria-label="OBV / 거래량 차트"
    />
  );
}
