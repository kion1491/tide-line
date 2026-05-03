"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import { BASE_CHART_OPTIONS, toChartTime } from "./chartUtils";
import type { IndicatorPoint } from "@/types";

interface RelativeStrengthChartProps {
  stockData: IndicatorPoint[];
  indexData: IndicatorPoint[];
  stockName: string;
  indexLabel: string;
  height?: number;
}

export default function RelativeStrengthChart({
  stockData,
  indexData,
  stockName,
  indexLabel,
  height = 200,
}: RelativeStrengthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || stockData.length === 0) return;

    // 종목이 지수보다 위에서 끝나는지 판단 → 라인 색상 결정
    const lastStock = stockData[stockData.length - 1]?.value ?? 100;
    const lastIndex = indexData[indexData.length - 1]?.value ?? 100;
    const stockColor = lastStock >= lastIndex ? "#16a34a" : "#dc2626";

    const chart = createChart(containerRef.current, {
      ...BASE_CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height,
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });

    // 지수 라인 (회색, 먼저 그려서 뒤에)
    const indexSeries = chart.addSeries(LineSeries, {
      color: "#94a3b8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: indexLabel,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    });
    indexSeries.setData(
      indexData
        .filter((d) => d.value !== null)
        .map((d) => ({
          time: toChartTime(d.time),
          value: d.value as number,
        }))
    );

    // 종목 라인 (성과에 따라 초록/빨강)
    const stockSeries = chart.addSeries(LineSeries, {
      color: stockColor,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: stockName,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    });
    stockSeries.setData(
      stockData
        .filter((d) => d.value !== null)
        .map((d) => ({
          time: toChartTime(d.time),
          value: d.value as number,
        }))
    );

    // 기준선 100 (점선)
    stockSeries.createPriceLine({
      price: 100,
      color: "#cbd5e1",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "기준",
    });

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
  }, [stockData, indexData, stockName, indexLabel, height]);

  return (
    <div
      ref={containerRef}
      className="relative-strength-chart w-full"
      style={{ height }}
      aria-label="시장 대비 상대 강도 차트"
    />
  );
}
