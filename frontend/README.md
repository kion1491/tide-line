# Tide Line — 주식 하락 추세 진단 도구

국내 주식 종목의 하락 추세 여부를 7개 기술적 지표로 자동 진단하고, 항목별 차트와 함께 시각적으로 제공하는 웹 애플리케이션입니다.

---

## 개요

종목 코드를 입력하면 백엔드가 야후 파이낸스에서 시세 데이터를 수집하고, 추세 구조 / 이동평균 / 모멘텀 / 추세 강도 4개 카테고리 7개 지표를 분석합니다. 결과는 심각도(안정 / 경고 / 심각) 및 점수로 요약되며, 각 항목은 실제 차트를 펼쳐 근거를 확인할 수 있습니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **7개 지표 자동 진단** | 200일선 이탈, SMA 배열, 피보나치 되돌림, OBV, ADX/DI 등 |
| **항목별 차트** | 캔들스틱, 이동평균 오버레이, 거래량+OBV, 지표 패널 (TradingView lightweight-charts) |
| **심각도 배지** | 종합 점수 기반 안정 / 경고 / 심각 3단계 |
| **시장 대비 상대 강도** | 코스피200 or 섹터 ETF 대비 정규화 비교 차트 |
| **DART 공시 연동** | 최신 공시 목록 빠른 조회 |
| **종목 자동완성** | 종목명 / 코드 실시간 검색 |

---

## 기술 스택

### 프론트엔드 (`/frontend`)

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** — 유틸리티 퍼스트 스타일링, BEM 클래스 병행
- **TradingView lightweight-charts v5** — 캔들스틱 / 라인 / 히스토그램 차트

### 백엔드 (`/backend`)

- **FastAPI** + **Python 3.12**
- **yfinance** — 시세 / 지수 데이터 수집
- **pandas / numpy** — 지표 연산
- **dart-fss** — DART 공시 API
- **Redis** — 진단 결과 캐싱 (진단_v3)
- **slowapi** — Rate Limiting (10회/분)

---

## 진단 항목

| # | 카테고리 | 항목 | 지표 |
|---|---------|------|------|
| 1 | 추세 구조 | 200일선 하향 이탈 + 우하향 | 주봉 캔들 + SMA200 |
| 2 | 추세 구조 | 단기 고점 갱신 실패 (하락 파동) | 일봉 + 피벗 고점 |
| 3 | 이동평균 | 장기 이평 역배열 (SMA200 위) | 일봉 + SMA200 |
| 4 | 이동평균 | 중기 이평 역배열 (SMA60 위) | 일봉 + SMA60 |
| 5 | 모멘텀 | 피보나치 주요 되돌림 저항 | 일봉 + 피보나치 레벨 |
| 6 | 모멘텀 | OBV 감소 (매도 우위) | OBV 라인 + 거래량 |
| 7 | 추세 강도 | ADX 상승 + -DI > +DI | ADX / ±DI 패널 |

---

## 로컬 실행

### 백엔드

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`.env` 파일에 다음 환경 변수 설정이 필요합니다.

```
DART_API_KEY=...
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:3000
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속합니다.

---

## 프로젝트 구조

```
tide-line/
├── backend/
│   └── app/
│       ├── api/          # FastAPI 라우터 (diagnose, stocks, disclosures)
│       ├── schemas/      # Pydantic 응답 모델
│       └── services/     # 진단 로직, 차트 데이터 빌드, 주식 목록
└── frontend/
    └── src/
        ├── app/          # Next.js App Router 페이지
        ├── components/
        │   ├── charts/   # PriceChart, ItemChart, RelativeStrengthChart 등
        │   └── diagnosis/ # ChecklistCategory, ChecklistItem, SummaryCard 등
        └── types/        # TypeScript 공통 타입
```
