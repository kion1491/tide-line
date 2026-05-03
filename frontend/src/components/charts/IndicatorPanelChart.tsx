"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import { BASE_CHART_OPTIONS, toChartTime } from "./chartUtils";
import type { IndicatorPoint } from "@/types";

interface LineConfig {
  data: IndicatorPoint[];
  color: string;
  label: string;
  lineWidth?: number;
}

interface ThresholdLine {
  value: number;
  color: string;
  label: string;
}

interface IndicatorPanelChartProps {
  lines: LineConfig[];
  thresholds?: ThresholdLine[];
  height?: number;
}

export default function IndicatorPanelChart({
  lines,
  thresholds,
  height = 200,
}: IndicatorPanelChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || lines.length === 0) return;

    const chart = createChart(containerRef.current, {
      ...BASE_CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height,
    });

    lines.forEach((cfg) => {
      const series = chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: (cfg.lineWidth ?? 2) as 1 | 2 | 3 | 4,
        priceLineVisible: false,
        lastValueVisible: true,
        title: cfg.label,
      });

      const validData = cfg.data
        .filter((d) => d.value !== null)
        .map((d) => ({
          time: toChartTime(d.time),
          value: d.value as number,
        }));

      series.setData(validData);

      // 임계선 (예: ADX 25선)을 첫 번째 시리즈에 priceLine으로 추가
      if (cfg === lines[0] && thresholds) {
        thresholds.forEach((t) => {
          series.createPriceLine({
            price: t.value,
            color: t.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: t.label,
          });
        });
      }
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
  }, [lines, thresholds, height]);

  return (
    <div
      ref={containerRef}
      className="indicator-panel-chart w-full"
      style={{ height }}
      aria-label="지표 패널 차트"
    />
  );
}
