"use client";

import { useState } from "react";
import type { DiagnosisItem, ChartData } from "@/types";
import ItemChart from "@/components/charts/ItemChart";

interface ChecklistItemProps {
  item: DiagnosisItem;
  chartData?: ChartData;
}

const CHART_ITEM_IDS = new Set([1, 2, 3, 4, 5, 6, 7]);

export default function ChecklistItem({ item, chartData }: ChecklistItemProps) {
  const { id, label, checked, weight, evidence, signal_age_days } = item;
  const [expanded, setExpanded] = useState(false);
  const hasChart = chartData != null && CHART_ITEM_IDS.has(id);

  return (
    <div
      className={[
        "checklist-item rounded-xl border transition-colors",
        checked
          ? "checklist-item--checked border-orange-200 bg-orange-50"
          : "checklist-item--unchecked border-slate-200 bg-white",
        expanded ? "checklist-item--expanded" : "",
      ].join(" ")}
    >
      <div className="checklist-item__inner flex items-start gap-3 p-4">
        {/* 체크/미체크 아이콘 */}
        <span
          className="checklist-item__icon shrink-0 mt-0.5 text-lg leading-none"
          aria-label={checked ? "해당함" : "해당 없음"}
        >
          {checked ? "🔴" : "⚪"}
        </span>

        <div className="checklist-item__content flex-1 min-w-0">
          <div className="checklist-item__top flex items-center justify-between gap-2 flex-wrap">
            {/* 항목 레이블 */}
            <span className="checklist-item__label flex items-center gap-1.5 flex-wrap">
              <span
                className={[
                  "text-sm font-semibold leading-snug",
                  checked ? "text-orange-800" : "text-slate-700",
                ].join(" ")}
              >
                {label}
              </span>
              {!checked && (
                <span className="checklist-item__no-signal text-xs font-medium text-slate-400">
                  → 해당사항 없음
                </span>
              )}
            </span>

            {/* 뱃지 + 차트 토글 그룹 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="checklist-item__badges flex items-center gap-1.5">
                {/* 신호 지속 기간 칩 */}
                {checked && signal_age_days != null && (
                  <span className="checklist-item__age-chip text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    {signal_age_days}일째
                  </span>
                )}
                {/* 가중치 배지 */}
                <span
                  className={[
                    "checklist-item__weight-badge text-xs font-bold px-2 py-0.5 rounded-full",
                    checked
                      ? "bg-red-100 text-red-600"
                      : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {checked ? `-${weight}pt` : `+${weight}pt`}
                </span>
              </div>

              {/* 차트 보기 토글 버튼 */}
              {hasChart && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className={[
                    "checklist-item__chart-toggle flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border transition-all",
                    expanded
                      ? "border-blue-400 bg-blue-500 text-white shadow-sm"
                      : "border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-400",
                  ].join(" ")}
                  aria-expanded={expanded}
                  aria-label="차트 보기 토글"
                >
                  {/* 막대차트 아이콘 */}
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="8" width="3" height="7" rx="0.5" />
                    <rect x="6" y="4" width="3" height="11" rx="0.5" />
                    <rect x="11" y="1" width="3" height="14" rx="0.5" />
                  </svg>
                  {expanded ? "차트 닫기" : "차트 보기"}
                  <svg
                    className={`h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* 근거 텍스트 */}
          <p className="checklist-item__evidence mt-1 text-xs text-slate-500 leading-relaxed">
            {evidence}
          </p>
        </div>
      </div>

      {/* 차트 영역 (펼쳐진 상태) */}
      {hasChart && expanded && (
        <div className="checklist-item__chart-area border-t border-slate-100 px-4 pb-4 pt-3">
          <ItemChart item={item} chartData={chartData!} />
        </div>
      )}
    </div>
  );
}
