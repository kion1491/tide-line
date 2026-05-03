# 🌊 Tide Line

> 한국 주식의 하락 추세를 7가지 지표로 정밀 진단하는 웹 도구

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06b6d4?logo=tailwindcss) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi) ![Python](https://img.shields.io/badge/Python-3.11-3776ab?logo=python)

---

## 개요

**Tide Line**은 "이 종목이 정말 추세 전환인지, 단순 조정인지"를 판단하는 데 도움을 주는 분석 보조 도구입니다.

6자리 종목 코드를 입력하면 7가지 기술적 지표를 자동으로 평가하고, `confirmed`(하락 추세) / `caution`(주의) / `healthy`(이상 없음) 3단계로 진단 결과를 보여줍니다.

> **면책**: 본 도구는 투자 자문이 아닌 분석 보조 도구입니다. 모든 투자 결정과 손익은 사용자 본인 책임입니다.

---

## ✨ 주요 기능

- **종목 자동완성 검색** — KRX 전 종목 코드/종목명 즉시 검색
- **7개 지표 자동 진단** — 가중치 기반 점수 산출 및 3단계 분류
- **3축 분류** — 국면(phase) / 심각도(severity) / 지속기간(duration)
- **인터랙티브 차트** — 가격·거래량·이동평균·상대강도(vs KOSPI200/KOSDAQ150)
- **DART 공시 패널** — 최근 N일 금융감독원 공시 목록 및 본문 조회
- **결과 텍스트 복사** — 진단 결과를 클립보드에 복사
- **모바일 반응형** — 스마트폰에서도 전체 기능 사용 가능

---

## 📊 진단 로직

7개 지표를 가중치 합산으로 점수화하며, 핵심 신호(A·B) 미충족 시 진단 국면을 자동 다운그레이드합니다.

| # | 지표 | 가중치 | 비고 |
|---|---|---|---|
| 1 | 주봉 HH-HL 구조 파괴 | 3 | 핵심신호 A |
| 2 | 일봉 swing 구조 손상 | 3 | |
| 3 | 200일선 하향 이탈 + 우하향 | 3 | 핵심신호 B |
| 4 | 60일선 하향 이탈 + 우하향 | 2 | |
| 5 | 피보나치 0.618 라인 이탈 | 2 | |
| 6 | OBV 우하향 + 하락봉 거래량 증폭 | 2 | |
| 7 | ADX ≥ 25 AND -DI > +DI | 2 | 추세 강도 |

페이크 신호(`short_duration`, `macro_aligned`) 검증을 통해 단기·거시 동조 구간의 오탐을 방지합니다. 핵심 구현: [backend/app/services/diagnosis.py](backend/app/services/diagnosis.py)

KODEX 200(069500), KODEX 코스닥150(229200) ETF 대비 상대강도를 함께 계산합니다.

---

## 🛠 기술 스택

| 영역 | 기술 |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, lightweight-charts 5 |
| **Backend** | FastAPI 0.115, Python 3.11, Pydantic 2.10, slowapi, pandas, numpy, ta |
| **데이터** | pykrx (KRX OHLCV), dart-fss (DART 공시) |
| **배포** | Railway (backend), Procfile 기반 |

---

## 📁 프로젝트 구조

```
tide-line/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI 엔트리포인트
│   │   ├── api/
│   │   │   ├── diagnose.py       # POST /api/diagnose
│   │   │   ├── stocks.py         # GET  /api/stocks
│   │   │   └── disclosures.py    # GET  /api/disclosures
│   │   ├── services/
│   │   │   ├── diagnosis.py      # 7개 지표 진단 로직
│   │   │   ├── trend_timing.py   # 추세 타이밍 분석
│   │   │   ├── chart_data.py     # 차트 OHLCV 데이터
│   │   │   ├── dart.py           # DART 공시 조회
│   │   │   └── stock_list.py     # KRX 종목 목록
│   │   ├── schemas/              # Pydantic 요청/응답 모델
│   │   └── core/config.py        # 환경 설정
│   ├── tests/
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env.example
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx           # 단일 페이지 (SPA)
        │   └── layout.tsx
        ├── components/
        │   ├── diagnosis/         # SearchForm, DiagnosisResult, 체크리스트, 요약카드
        │   ├── charts/            # lightweight-charts 기반 차트 컴포넌트
        │   └── chat/              # DisclosurePanel, ChatPanel
        ├── lib/api.ts             # 백엔드 API 클라이언트
        ├── types/index.ts         # 공통 타입 정의
        └── constants/categories.ts
```

---

## 🚀 시작하기

### 사전 요구사항

- Node.js 20+
- Python 3.11+
- DART OpenAPI 키 → [opendart.fss.or.kr](https://opendart.fss.or.kr) 에서 발급

### Backend 실행

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # DART_API_KEY 입력 필수
uvicorn app.main:app --reload
# → http://localhost:8000
```

### Frontend 실행

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## ⚙️ 환경 변수

### Backend (`backend/.env`)

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `DART_API_KEY` | ✅ | — | 금융감독원 DART OpenAPI 인증키 |
| `CORS_ORIGINS` | | `http://localhost:3000` | 허용 Origin |
| `RATE_LIMIT_PER_MINUTE` | | `10` | 진단 API Rate Limit |
| `APP_ENV` | | `development` | `production` 시 `/docs` 비활성화 |

### Frontend

| 변수 | 기본값 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 백엔드 API 주소 |

---

## 🔌 API 엔드포인트

| Method | Path | 설명 | Rate Limit |
|---|---|---|---|
| `POST` | `/api/diagnose` | 종목 코드로 진단 실행 (캐시 TTL 600s) | 10/min |
| `GET` | `/api/stocks?q=` | 종목명·코드 자동완성 (최대 15건) | — |
| `GET` | `/api/disclosures?ticker=&days=` | 최근 N일(1~180) DART 공시 목록 | 30/min |
| `GET` | `/api/disclosure/{rcept_no}` | 공시 본문 조회 | 20/min |
| `GET` | `/health` | 헬스체크 | — |

개발 모드에서 Swagger UI: `http://localhost:8000/docs`

---

## 🖼 스크린샷

| 메인 화면 | 진단 결과 |
|---|---|
| ![메인](inspection-01-main.png) | ![결과](inspection-04-result-full.png) |

| 모바일 | 실제 종목 진단 예시 |
|---|---|
| ![모바일](inspection-07-mobile-main.png) | ![카카오](inspection-13-kakao-full.png) |

---

## 📋 개발 규칙

- **언어**: 주석·커밋·문서 → 한국어 / 변수·함수명 → 영어
- **코드 스타일**: 들여쓰기 2칸, camelCase, 동사 시작 함수명, BEM 클래스명
- **브랜치**: `feature/기능명` 형식
- **커밋**: 한국어 메시지, **커밋 전 린트 실행 필수**

자세한 규칙: [.claude/rules/code-style.md](.claude/rules/code-style.md), [.claude/rules/git-rules.md](.claude/rules/git-rules.md)

---

## ⚠️ 면책 사항

- 본 도구는 **투자 자문이 아닌 분석 보조 도구**입니다.
- 모든 투자 결정과 그에 따른 손익은 **전적으로 사용자 본인 책임**입니다.
- KRX 및 DART 데이터의 정확성·지연 여부를 보장하지 않습니다.
- 과거 패턴 기반 분석이므로 미래 수익을 보장하지 않습니다.
