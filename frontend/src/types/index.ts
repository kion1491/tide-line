// ── 진단 항목 ────────────────────────────────────────────────────────

export interface DiagnosisItem {
  id: number;
  category: string;
  label: string;
  checked: boolean;
  weight: number;
  evidence: string;
  manual: boolean;
  signal_age_days: number | null;
}

// ── 3축 출력 ─────────────────────────────────────────────────────────

export type Phase = "healthy" | "caution" | "confirmed";
export type SeverityLevel = "low" | "mid" | "high" | "extreme";
export type DurationStage = "fresh" | "early" | "established" | "extended";
export type RelativeStrengthLabel =
  | "weaker_than_market"
  | "aligned"
  | "stronger_than_market";

export interface Severity {
  total: number;          // 0-100 (danger %)
  structure: number;      // 추세 구조 카테고리 (0-100)
  trend_ma: number;       // 이동평균 카테고리 (0-100)
  momentum: number;       // 모멘텀 카테고리 (0-100)
  trend_strength: number; // 추세 강도 카테고리 (0-100)
  level: SeverityLevel;
  max_raw: number;
  danger_raw: number;
}

export interface SignalAge {
  id: number;
  label: string;
  days_ago: number;
}

export interface Duration {
  primary_days: number | null;
  stage: DurationStage | null;
  all_signals: SignalAge[];
}

export interface RelativeStrength {
  value: number;          // 종목% - 지수% (양수: 종목이 강함)
  label: RelativeStrengthLabel;
  stock_return: number;
  index_return: number;
  index_label: string;    // "코스피200" | "코스닥150"
}

export interface KeyDamage {
  label: string;
  days_ago: number | null;
  weight: number;
}

export interface Interpretation {
  summary: string;
  key_damages: KeyDamage[];
  recovery_signals: string[];
  noise_warning: string | null;
}

// ── 차트 데이터 ──────────────────────────────────────────────────────

export interface OhlcPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IndicatorPoint {
  time: string;
  value: number | null;
}

export interface FibLevels {
  high: number;
  low: number;
  levels: Record<string, number>;
}

export interface PivotMarker {
  time: string;
  type: "low" | "high";
  price: number;
}

export interface ChartData {
  daily: OhlcPoint[];
  weekly: OhlcPoint[];
  sma200: IndicatorPoint[];
  sma60: IndicatorPoint[];
  obv: IndicatorPoint[];
  adx: IndicatorPoint[];
  di_plus: IndicatorPoint[];
  di_minus: IndicatorPoint[];
  fib: FibLevels;
  pivots_daily: PivotMarker[];
  pivots_weekly: PivotMarker[];
  relative_stock: IndicatorPoint[];
  relative_index: IndicatorPoint[];
  relative_index_label: string;
}

// ── 진단 응답 전체 ───────────────────────────────────────────────────

export interface DiagnosisResult {
  ticker: string;
  name: string;
  current_price: number;
  phase: Phase;
  phase_raw: Phase;
  severity: Severity;
  duration: Duration;
  relative_strength: RelativeStrength;
  fake_signals: string[];
  interpretation: Interpretation;
  items: DiagnosisItem[];
  disclosures_count: number;
  chart_data: ChartData;
}

// ── 공시 관련 ────────────────────────────────────────────────────────

export interface Disclosure {
  rcept_no: string;
  title: string;
  date: string;
  url: string;
  est_tokens: number;
}

export interface DisclosureContent {
  rcept_no: string;
  title: string;
  date: string;
  content_text: string;
}

export interface AttachedDisclosure {
  rcept_no: string;
  title: string;
  content_text: string;
  est_tokens: number;
}
