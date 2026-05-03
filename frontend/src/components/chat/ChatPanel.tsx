"use client";

import { useState } from "react";
import type { DiagnosisResult } from "@/types";

const PHASE_KO: Record<string, string> = {
  healthy:   "추세 이상 없음",
  caution:   "하락 신호 주의",
  confirmed: "하락 추세 확정",
};

const SEVERITY_KO: Record<string, string> = {
  low: "낮음", mid: "중간", high: "높음", extreme: "매우 높음",
};

const STAGE_KO: Record<string, string> = {
  fresh: "신규(1~3일)", early: "초기(4~10일)",
  established: "확정(11~30일)", extended: "장기(30일+)",
};

const RS_KO: Record<string, string> = {
  weaker_than_market:   "시장보다 약함",
  aligned:              "시장과 동조",
  stronger_than_market: "시장보다 강함",
};

interface ChatPanelProps {
  result: DiagnosisResult;
}

function buildContext(result: DiagnosisResult): string {
  const { name, ticker, current_price, phase, phase_raw, severity, duration, relative_strength, fake_signals, interpretation, items } = result;
  const checkedItems = items.filter((i) => i.checked);
  const uncheckedItems = items.filter((i) => !i.checked);

  return `# ${name}(${ticker}) 하락 추세 진단

## 기본 정보
- 현재가: ${current_price.toLocaleString()}원

## 진단 결과 (3축)
- 추세 단계: ${PHASE_KO[phase]}${phase !== phase_raw ? ` (보정 전: ${PHASE_KO[phase_raw]})` : ""}
- 심각도: ${SEVERITY_KO[severity.level]} (${severity.total}%)
  · 추세 구조 ${severity.structure}% / 이동평균 ${severity.trend_ma}% / 모멘텀 ${severity.momentum}% / 추세강도 ${severity.trend_strength}%
- 신호 지속: ${duration.primary_days != null ? `${duration.primary_days}일째 (${duration.stage ? STAGE_KO[duration.stage] : ""})` : "활성 핵심 신호 없음"}
- 시장 대비 강도: ${RS_KO[relative_strength.label]} (${relative_strength.value > 0 ? "+" : ""}${relative_strength.value.toFixed(1)}%p, ${relative_strength.index_label} 기준)
  · 종목 1개월 수익률 ${relative_strength.stock_return > 0 ? "+" : ""}${relative_strength.stock_return.toFixed(1)}% / 지수 ${relative_strength.index_return > 0 ? "+" : ""}${relative_strength.index_return.toFixed(1)}%

## 페이크 검증
${fake_signals.length === 0 ? "페이크 신호 없음 — 진단 결과 신뢰도 높음" : fake_signals.map((f) => {
  if (f === "short_duration") return `- 단기 파동 가능성: 핵심 신호 발생 후 ${duration.primary_days}일로 짧음`;
  if (f === "macro_aligned") return `- 매크로 동조 가능성: 시장 전반과 유사한 흐름 (격차 ${relative_strength.value.toFixed(1)}%p)`;
  return `- ${f}`;
}).join("\n")}

## 종합 해석
${interpretation.summary}
${interpretation.noise_warning ? `\n⚠ ${interpretation.noise_warning}` : ""}

## 핵심 손상 포인트
${interpretation.key_damages.map((d, i) => `${i + 1}. ${d.label}${d.days_ago != null ? ` (${d.days_ago}일째)` : ""} [-${d.weight}pt]`).join("\n")}

## 정상화 회복 조건 (참고용 — 매매 추천 아님)
${interpretation.recovery_signals.map((r) => `○ ${r}`).join("\n")}

## 활성 위험 신호 (${checkedItems.length}개)
${checkedItems.map((i) => `- [🔴] [${i.category}] ${i.label}${i.signal_age_days != null ? ` (${i.signal_age_days}일째)` : ""}: ${i.evidence}`).join("\n")}

## 비활성 신호 — 정상 (${uncheckedItems.length}개)
${uncheckedItems.map((i) => `- [⚪] [${i.category}] ${i.label}: ${i.evidence}`).join("\n")}

---
위 진단은 기술적 추세 분석입니다. 매수/매도 판단은 본인의 책임 하에 하시기 바랍니다.`;
}

function estimateTotalTokens(result: DiagnosisResult): number {
  return 500 + result.items.length * 30;
}

export default function ChatPanel({ result }: ChatPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildContext(result);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleOpenClaude() {
    window.open("https://claude.ai/new", "_blank", "noopener,noreferrer");
  }

  const totalTokens = estimateTotalTokens(result);

  return (
    <section className="chat-panel rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="chat-panel__header px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="text-base" aria-hidden="true">🤖</span>
        <h2 className="chat-panel__title font-semibold text-slate-800 text-sm">Claude로 심층 분석하기</h2>
      </div>

      <div className="chat-panel__body px-5 py-5 space-y-4">
        <p className="chat-panel__description text-sm text-slate-600 leading-relaxed">
          진단 결과를 복사해서 Claude에 붙여넣으면 추세 맥락을 바탕으로 심층 분석을 받을 수 있습니다.
        </p>

        {/* 포함 내용 요약 */}
        <div className="chat-panel__content-summary rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 mb-2">복사될 내용</p>
          <div className="chat-panel__content-item flex items-center gap-2 text-sm text-slate-700">
            <span className="text-green-500">✓</span>
            <span>{result.name} ({result.ticker}) 3축 진단 결과</span>
          </div>
          <div className="chat-panel__content-item flex items-center gap-2 text-sm text-slate-700">
            <span className="text-green-500">✓</span>
            <span>7개 신호 상세 근거 + 지속 기간</span>
          </div>
          <div className="chat-panel__content-item flex items-center gap-2 text-sm text-slate-700">
            <span className="text-green-500">✓</span>
            <span>페이크 검증 + 정상화 회복 조건</span>
          </div>
          <p className="text-xs text-slate-400 pt-1 border-t border-slate-200 mt-2">
            약 {totalTokens.toLocaleString()} 토큰
          </p>
        </div>

        {/* 사용 안내 */}
        <ol className="chat-panel__steps space-y-2">
          {[
            "아래 \"컨텍스트 복사\" 버튼을 클릭",
            "\"Claude 열기\" 버튼으로 claude.ai 이동",
            "새 대화창에 붙여넣기 후 질문 입력",
          ].map((step, i) => (
            <li key={i} className="chat-panel__step flex items-start gap-2.5 text-sm text-slate-600">
              <span className="chat-panel__step-number shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {/* 버튼 */}
        <div className="chat-panel__actions flex gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className={[
              "chat-panel__copy-btn flex-1 h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
              copied
                ? "bg-green-500 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95",
            ].join(" ")}
          >
            {copied ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                복사 완료
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                컨텍스트 복사
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenClaude}
            className="chat-panel__open-btn flex-1 h-11 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
            Claude 열기
          </button>
        </div>
      </div>
    </section>
  );
}
