"use client";

import type { DiagnosisResult } from "@/types";

export default function DiagnosisInterpretation({ result }: { result: DiagnosisResult }) {
  const { interpretation, fake_signals } = result;
  const { summary, key_damages, recovery_signals, noise_warning } = interpretation;

  return (
    <section className="diagnosis-interpretation rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="diagnosis-interpretation__header px-5 py-4 border-b border-slate-100">
        <h2 className="diagnosis-interpretation__title font-semibold text-slate-800 text-sm">종합 진단 해석</h2>
      </div>

      <div className="diagnosis-interpretation__body px-5 py-5 space-y-4">
        {/* 노이즈 경고 배너 */}
        {noise_warning && (
          <div className="diagnosis-interpretation__noise-warning rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-bold text-amber-700 mb-1">⚠ 주의</p>
            <p className="text-sm text-amber-800 leading-relaxed">{noise_warning}</p>
          </div>
        )}

        {/* 종합 요약 */}
        <p className="diagnosis-interpretation__summary text-sm text-slate-700 leading-relaxed">{summary}</p>

        {/* 핵심 손상 포인트 */}
        {key_damages.length > 0 && (
          <div className="diagnosis-interpretation__damages">
            <p className="diagnosis-interpretation__damages-title text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">핵심 손상 포인트</p>
            <div className="space-y-2">
              {key_damages.map((d, i) => (
                <div key={i} className="diagnosis-interpretation__damage-item flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
                  <span className="diagnosis-interpretation__damage-rank shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="diagnosis-interpretation__damage-label flex-1 text-sm text-red-800 font-medium">{d.label}</span>
                  <div className="diagnosis-interpretation__damage-meta shrink-0 flex items-center gap-1.5">
                    {d.days_ago != null && (
                      <span className="text-xs text-red-600 font-semibold">{d.days_ago}일째</span>
                    )}
                    <span className="text-xs text-red-400">-{d.weight}pt</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 정상화 회복 조건 */}
        {recovery_signals.length > 0 && (
          <div className="diagnosis-interpretation__recovery">
            <p className="diagnosis-interpretation__recovery-title text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              정상화 회복 조건 <span className="normal-case font-normal text-slate-400">(매매 추천 아님 — 추세 전환 참고 지표)</span>
            </p>
            <div className="space-y-1.5">
              {recovery_signals.map((r, i) => (
                <div key={i} className="diagnosis-interpretation__recovery-item flex items-start gap-2 text-sm text-slate-600">
                  <span className="shrink-0 mt-0.5 text-emerald-500">○</span>
                  <span className="leading-snug">{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
