# RichBot 기술 스택

## 백엔드

| 항목 | 내용 |
|---|---|
| 언어 | Python 3.11+ |
| 프레임워크 | FastAPI |
| 서버 | Uvicorn (핫리로드 개발) |
| ORM | SQLAlchemy 2.x (async) |
| DB | SQLite (`backend/richbot.db`) |
| 스케줄러 | APScheduler (AsyncIOScheduler) |
| 시세 데이터 | FinanceDataReader (T+1, KRX 전 종목) |
| 공시 데이터 | DART OpenAPI |
| AI 해설 | Anthropic Claude API |
| 웹 푸시 | pywebpush (VAPID) |
| 설정 관리 | pydantic-settings (`.env`) |
| 패키지 관리 | venv (`.venv/`) |

## 프론트엔드

| 항목 | 내용 |
|---|---|
| 언어 | TypeScript |
| 프레임워크 | Next.js (App Router) |
| UI 라이브러리 | React 19 |
| 스타일 | Tailwind CSS |
| 차트 | Recharts (ComposedChart) |
| 서버 상태 | TanStack React Query v5 |
| HTTP 클라이언트 | axios |
| 개발 서버 | Next.js dev (포트 3000) |

## 아키텍처

```
브라우저
  ↓ axios (포트 3000 → 8000)
Next.js 프론트엔드
  ↓ REST API
FastAPI 백엔드
  ↓ async SQLAlchemy
SQLite
```

## 백엔드 레이어

| 레이어 | 경로 | 역할 |
|---|---|---|
| 진입점 | `main.py` | FastAPI 앱, CORS, lifespan |
| ORM | `models/` | Stock, PriceSnapshot, CrossEvent, VolumeSpikeEvent, AlertSetting, GlobalAlertSetting 등 |
| 스키마 | `schemas/` | Pydantic 요청/응답 |
| 라우터 | `routers/` | HTTP 엔드포인트 |
| 서비스 | `services/` | 비즈니스 로직 (시세·지표·알림·DART·AI) |
| 스케줄러 | `scheduler/` | APScheduler 설정 및 작업 함수 |
| 설정 | `config.py` | pydantic-settings, `.env` 로드 |

## 프론트엔드 레이어

| 레이어 | 경로 | 역할 |
|---|---|---|
| 페이지 | `src/app/` | watchlist, alerts, disclosures, all-stocks, stocks/[ticker] |
| 컴포넌트 | `src/components/` | 차트, 알림, 관심종목, AI 해설, 공시 등 |
| 훅 | `src/hooks/` | React Query 래퍼 |
| Lib | `src/lib/` | axios 인스턴스, 포맷터 |

## 스케줄 작업

| 작업 | 주기 |
|---|---|
| 전체 KRX 종목 크로스 감지 + Web Push | 평일 16:00 KST |
| 관심종목 DART 공시 수집 | 매일 18:00 KST |

## 주요 제약

- **데이터 T+1** — FinanceDataReader는 실시간 미지원, 당일 데이터는 장 마감 후 제공
- **DB 스키마 변경** — `richbot.db` 삭제 후 재시작하면 `create_all`로 재생성 (Alembic 불필요)
- **AI 해설** — 사용자 요청 시에만 생성, `(stock_id, date)` 단위 캐시
- **GateGuard** — Edit/Write 도구 차단, 파일 수정은 PowerShell로만 수행

## 개발 환경

- OS: Windows 10
- 백엔드 실행: `cd backend && .\.venv\Scripts\uvicorn.exe main:app --reload --port 8000`
- 프론트 실행: `cd frontend && npm run dev`
- 타입 체크: `cd frontend && npx tsc --noEmit`