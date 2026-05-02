"use client";

import type { DiagnosisItem, ChartData } from "@/types";
import ChecklistItem from "./ChecklistItem";

interface ChecklistCategoryProps {
  category: string;
  items: DiagnosisItem[];
  chartData?: ChartData;
}

const CATEGORY_ICONS: Record<string, string> = {
  "추세 구조": "📉",
  "이동평균":  "📐",
  "모멘텀":    "📊",
  "추세 강도": "⚡",
};

export default function ChecklistCategory({ category, items, chartData }: ChecklistCategoryProps) {
  const checkedCount = items.filter((i) => i.checked).length;
  const maxScore = items.reduce((sum, i) => sum + i.weight, 0);
  const dangerScore = items.filter((i) => i.checked).reduce((sum, i) => sum + i.weight, 0);
  const icon = CATEGORY_ICONS[category] ?? "📌";

  return (
    <section className="checklist-category rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="checklist-category__header flex items-center gap-2 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <span className="checklist-category__icon text-base shrink-0" aria-hidden="true">{icon}</span>
        <div className="checklist-category__title-group flex items-center gap-1.5 flex-wrap">
          <h3 className="checklist-category__title text-sm font-bold text-slate-700">{category}</h3>
          <span className={`checklist-category__score text-sm font-bold ${dangerScore > 0 ? "text-orange-600" : "text-slate-400"}`}>
            ({dangerScore > 0 ? `위험 ${dangerScore}` : "정상"}/{maxScore}pt)
          </span>
          {checkedCount > 0 && (
            <span className="checklist-category__signal-count text-xs text-orange-500 font-medium">{checkedCount}개 신호</span>
          )}
        </div>
      </div>

      <div className="checklist-category__body p-4 flex flex-col gap-3">
        {items.map((item) => (
          <ChecklistItem key={item.id} item={item} chartData={chartData} />
        ))}
      </div>
    </section>
  );
}
