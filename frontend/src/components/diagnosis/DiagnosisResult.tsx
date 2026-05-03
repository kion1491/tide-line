import type { DiagnosisResult as DiagnosisResultType, DiagnosisItem } from "@/types";
import SummaryCard from "./SummaryCard";
import ChecklistCategory from "./ChecklistCategory";
import DiagnosisInterpretation from "./DiagnosisInterpretation";
import { CATEGORY_ORDER } from "@/constants/categories";

interface DiagnosisResultProps {
  result: DiagnosisResultType;
}

function groupByCategory(items: DiagnosisItem[]): Record<string, DiagnosisItem[]> {
  return items.reduce<Record<string, DiagnosisItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
}

export default function DiagnosisResult({ result }: DiagnosisResultProps) {
  const grouped = groupByCategory(result.items);

  return (
    <div className="diagnosis-result space-y-5">
      {/* 3축 요약 카드 (phase / severity / duration / relative_strength) */}
      <SummaryCard result={result} />

      {/* 종합 해석 */}
      <DiagnosisInterpretation result={result} />

      {/* 근거 신호 상세 (7개 자동 지표) */}
      <div className="diagnosis-result__checklist-section">
        <p className="diagnosis-result__checklist-label text-xs font-bold text-slate-400 uppercase tracking-wide px-1 mb-3">근거 신호 상세</p>
        <div className="diagnosis-result__checklist-group space-y-4">
          {CATEGORY_ORDER.map((category) => {
            const categoryItems = grouped[category];
            if (!categoryItems || categoryItems.length === 0) return null;
            return (
              <ChecklistCategory
                key={category}
                category={category}
                items={categoryItems}
                chartData={result.chart_data}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
