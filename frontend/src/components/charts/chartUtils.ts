import type { DeepPartial, ChartOptions, Time } from "lightweight-charts";

export const toChartTime = (t: string): Time => t as Time;

export const BASE_CHART_OPTIONS: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: "#ffffff" },
    textColor: "#64748b",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: "#f1f5f9" },
    horzLines: { color: "#f1f5f9" },
  },
  rightPriceScale: {
    borderColor: "#e2e8f0",
  },
  timeScale: {
    borderColor: "#e2e8f0",
    timeVisible: false,
    rightOffset: 4,
    fixLeftEdge: true,
    fixRightEdge: true,
  },
  crosshair: {
    vertLine: { color: "#94a3b8", labelBackgroundColor: "#475569" },
    horzLine: { color: "#94a3b8", labelBackgroundColor: "#475569" },
  },
  handleScale: {
    mouseWheel: false,
    pinch: false,
  },
  handleScroll: {
    mouseWheel: false,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: false,
  },
};

export const KRW_PRICE_FORMAT = {
  type: "price" as const,
  precision: 0,
  minMove: 1,
};
