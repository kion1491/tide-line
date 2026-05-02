"use client";

import type { DiagnosisResult, Phase, SeverityLevel, DurationStage } from "@/types";
import RelativeStrengthChart from "@/components/charts/RelativeStrengthChart";

// ── 테마 설정 ────────────────────────────────────────────────────────

const PHASE_THEME: Record<Phase, { label: string; sub: string; bg: string; ring: string; dot: string; text: string }> = {
  healthy:   { label: "추세 이상 없음",    sub: "하락 전환 신호 미감지",      bg: "bg-emerald-50",  ring: "ring-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700" },
  caution:   { label: "하락 신호 주의",    sub: "일부 하락 신호 발생 (페이크 가능성 점검 필요)", bg: "bg-amber-50",    ring: "ring-amber-200",   dot: "bg-amber-400",   text: "text-amber-700"   },
  confirmed: { label: "하락 추세 확정",    sub: "핵심 신호 동시 충족 — 추세 전환 가능성 높음",  bg: "bg-red-50",      ring: "ring-red-200",     dot: "bg-red-500",     text: "text-red-700"     },
};

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  low:     "bg-emerald-500 text-white",
  mid:     "bg-amber-400 text-white",
  high:    "bg-red-50 text-red-600",
  extreme: "bg-red-50 text-red-600",
};

const SEVERITY_BAR: Record<SeverityLevel, string> = {
  low:     "bg-emerald-500",
  mid:     "bg-amber-400",
  high:    "bg-orange-500",
  extreme: "bg-red-600",
};

const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  low: "안정", mid: "경고", high: "심각", extreme: "심각",
};

const STAGE_LABEL: Record<DurationStage, { label: string; color: string }> = {
  fresh:       { label: "신규 (1~3일)",    color: "text-sky-600" },
  early:       { label: "초기 (4~10일)",   color: "text-amber-600" },
  established: { label: "확정 (11~30일)",  color: "text-orange-600" },
  extended:    { label: "장기 (30일+)",    color: "text-red-600" },
};

const RS_THEME = {
  weaker_than_market:   { label: "시장보다 약함",  color: "text-red-600",     bar: "bg-red-400" },
  aligned:              { label: "시장과 동조",    color: "text-slate-600",   bar: "bg-slate-400" },
  stronger_than_market: { label: "시장보다 강함",  color: "text-emerald-600", bar: "bg-emerald-500" },
};

// ── 미니 게이지 바 ────────────────────────────────────────────────────

function MiniBar({ label, dangerPct }: { label: string; dangerPct: number }) {
  const stabilityPct = 100 - dangerPct;
  const barColor =
    stabilityPct === 100 ? "bg-emerald-500"
    : stabilityPct >= 50  ? "bg-amber-400"
    :                        "bg-red-500";
  const textColor =
    stabilityPct === 100 ? "text-emerald-600"
    : stabilityPct >= 50  ? "text-amber-600"
    :                        "text-red-600";

  return (
    <div className="mini-bar space-y-1">
      <div className="mini-bar__header flex justify-between text-xs text-slate-500">
        <span className="mini-bar__label">{label}</span>
        <span className={`mini-bar__value font-semibold ${textColor}`}>{stabilityPct}%</span>
      </div>
      <div className="mini-bar__track h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`mini-bar__fill h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${stabilityPct}%` }}
        />
      </div>
    </div>
  );
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────

export default function SummaryCard({ result }: { result: DiagnosisResult }) {
  const { name, ticker, current_price, phase, phase_raw, severity, duration, relative_strength, fake_signals } = result;
  const pt = PHASE_THEME[phase];
  const sevBadge = SEVERITY_BADGE[severity.level];
  const sevBar   = SEVERITY_BAR[severity.level];
  const rs = RS_THEME[relative_strength.label];
  const stageInfo = duration.stage ? STAGE_LABEL[duration.stage] : null;
  const hasFakeDowngrade = phase !== phase_raw;

  return (
    <section className="summary-card rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* 종목 헤더 */}
      <div className="summary-card__header px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="summary-card__name text-lg font-bold text-slate-900">{name}</h2>
          <p className="summary-card__ticker text-sm text-slate-500">{ticker} · {current_price.toLocaleString()}원</p>
        </div>
      </div>

      <div className="summary-card__body px-5 py-5 space-y-5">
        {/* ① Phase 신호등 */}
        <div className={`summary-card__phase summary-card__phase--${phase} rounded-xl ring-1 ${pt.ring} ${pt.bg} px-4 py-4 flex items-center gap-4`}>
          <span className={`summary-card__phase-dot shrink-0 w-4 h-4 rounded-full ${pt.dot} shadow-sm`} />
          <div className="summary-card__phase-content flex-1 min-w-0">
            <p className={`summary-card__phase-label text-base font-bold ${pt.text}`}>{pt.label}</p>
            <p className="summary-card__phase-sub text-xs text-slate-500 mt-0.5">{pt.sub}</p>
          </div>
          {hasFakeDowngrade && (
            <span className="summary-card__fake-badge shrink-0 text-xs font-medium text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">
              페이크 조정됨
            </span>
          )}
        </div>

        {/* 페이크 경고 배너 */}
        {fake_signals.length > 0 && (
          <div className="summary-card__fake-banner rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
            <p className="summary-card__fake-banner-title text-xs font-bold text-amber-700">⚠ 페이크 신호 감지 — 단정 전 확인 필요</p>
            {fake_signals.includes("short_duration") && (
              <p className="summary-card__fake-banner-item text-xs text-amber-700">
                · 신호 발생 기간이 {duration.primary_days}일로 짧습니다 — 단기 파동일 수 있습니다
              </p>
            )}
            {fake_signals.includes("macro_aligned") && (
              <p className="summary-card__fake-banner-item text-xs text-amber-700">
                · 시장 전반과 동조 중 ({relative_strength.index_label} 대비 {relative_strength.value > 0 ? "+" : ""}{relative_strength.value.toFixed(1)}%p) — 종목 고유 약세가 아닐 수 있습니다
              </p>
            )}
          </div>
        )}

        {/* ② 추세 안정 점수 */}
        <div className="summary-card__severity rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 space-y-3">
          <div className="summary-card__severity-header flex items-center justify-between">
            <p className="summary-card__severity-title text-xs font-bold text-slate-500 uppercase tracking-wide">추세 안정 점수</p>
            <span className={`summary-card__severity-badge text-xs font-bold px-2 py-0.5 rounded-full ${sevBadge}`}>
              {SEVERITY_LABEL[severity.level]}
            </span>
          </div>
          {/* 안정 점수 강조 (높을수록 안정적) */}
          <div className="summary-card__severity-score flex items-end gap-2">
            <span className="summary-card__severity-score-value text-3xl font-black text-slate-800 leading-none">
              {severity.max_raw - severity.danger_raw}
            </span>
            <span className="summary-card__severity-score-max text-sm text-slate-400 pb-0.5">
              / {severity.max_raw}pt
            </span>
          </div>
          {/* 안정도 바 (길수록 안정적) */}
          <div className="summary-card__severity-track h-2.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`summary-card__severity-fill h-full rounded-full transition-all duration-700 ${sevBar}`}
              style={{ width: `${100 - severity.total}%` }}
              role="progressbar"
              aria-valuenow={100 - severity.total}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          {/* 카테고리별 위험 미니 바 */}
          <div className="summary-card__severity-mini-bars grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
            <MiniBar label="추세 구조" dangerPct={severity.structure}      />
            <MiniBar label="이동평균"  dangerPct={severity.trend_ma}       />
            <MiniBar label="모멘텀"    dangerPct={severity.momentum}       />
            <MiniBar label="추세 강도" dangerPct={severity.trend_strength} />
          </div>
        </div>

        {/* ③ 지속 기간 */}
        <div className="summary-card__duration rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
          <p className="summary-card__duration-title text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">신호 지속 기간</p>
          {duration.primary_days != null ? (
            <div className="summary-card__duration-main flex items-end gap-3">
              <span className="summary-card__duration-days text-4xl font-black text-slate-800 leading-none">
                {duration.primary_days}
              </span>
              <div className="pb-1">
                <span className="text-base text-slate-500">일</span>
                {stageInfo && (
                  <p className={`summary-card__duration-stage text-xs font-semibold mt-0.5 ${stageInfo.color}`}>
                    {stageInfo.label}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="summary-card__duration-empty text-sm text-slate-400">활성 핵심 신호 없음</p>
          )}
          {duration.all_signals.length > 0 && (
            <div className="summary-card__duration-signals mt-3 space-y-1">
              {duration.all_signals.slice(0, 4).map((s) => (
                <div key={s.id} className="summary-card__duration-signal-row flex justify-between text-xs text-slate-500">
                  <span className="truncate">{s.label}</span>
                  <span className="shrink-0 ml-2 font-medium">{s.days_ago}일째</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ④ 상대 강도 */}
        <div className="summary-card__relative-strength rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 space-y-3">
          <div className="summary-card__relative-strength-header flex items-center justify-between">
            <p className="summary-card__relative-strength-title text-xs font-bold text-slate-500 uppercase tracking-wide">
              시장 대비 상대 강도 ({relative_strength.index_label}, 1개월)
            </p>
            <div className="flex items-center gap-2">
              <span className={`summary-card__relative-strength-diff text-sm font-bold ${rs.color}`}>
                {relative_strength.value > 0 ? "+" : ""}{relative_strength.value.toFixed(1)}%p
              </span>
              <span className={`summary-card__relative-strength-label text-xs font-semibold ${rs.color}`}>
                {relative_strength.label === "weaker_than_market" ? "↓" : relative_strength.label === "stronger_than_market" ? "↑" : "→"}
                {" "}{rs.label}
              </span>
            </div>
          </div>

          {/* 비교 차트 */}
          {result.chart_data.relative_stock.length > 0 && (
            <div className="summary-card__relative-strength-chart -mx-1">
              <RelativeStrengthChart
                stockData={result.chart_data.relative_stock}
                indexData={result.chart_data.relative_index}
                stockName={name}
                indexLabel={result.chart_data.relative_index_label}
                height={180}
              />
            </div>
          )}

          <div className="summary-card__relative-strength-returns flex gap-3 text-xs text-slate-400">
            <span>종목 {relative_strength.stock_return > 0 ? "+" : ""}{relative_strength.stock_return.toFixed(1)}%</span>
            <span>지수 {relative_strength.index_return > 0 ? "+" : ""}{relative_strength.index_return.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
