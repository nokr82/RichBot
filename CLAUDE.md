# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 명령어

### 백엔드 (`backend/` 디렉토리에서 실행)
# 터미널명령어
cd d:\개발소스\RichBot\backend
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000

```powershell
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000   # 핫리로드 개발 서버
.\.venv\Scripts\python -m py_compile main.py                 # 특정 파일 문법 검사
.\.venv\Scripts\python -c "import asyncio; from database import init_db; asyncio.run(init_db())"  # DB 재초기화
```

> `uvicorn` / `python` 명령은 venv를 활성화하지 않고 `.venv\Scripts\` 경로로 직접 실행한다.  
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` 실행 후 활성화도 가능하다.

### 프론트엔드 (`frontend/` 디렉토리에서 실행)
```powershell
npm run dev        # 포트 3000 개발 서버
npx tsc --noEmit   # 타입 체크
npm run build      # 프로덕션 빌드
```

### VAPID 키 생성 (최초 1회)
```powershell
cd backend
.\.venv\Scripts\python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print('PUBLIC:', v.public_key); print('PRIVATE:', v.private_key)"
```

## 파일 작업 제약

**GateGuard 훅이 `Write`/`Edit` 도구를 차단한다.** 모든 파일 생성·수정은 반드시 PowerShell로 수행한다:

```powershell
Set-Content -Path "경로\파일.py" -Value $content -Encoding utf8
```

## 환경 설정

프로젝트 루트의 `.env.example`을 `.env`로 복사. 필요한 키:
- `DART_API_KEY` — https://opendart.fss.or.kr/ 무료 발급
- `ANTHROPIC_API_KEY` — AI 해설 기능용
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push 알림용
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — 위 공개키와 동일값, `frontend/.env.local`에 설정

키가 없어도 앱은 작동하며 해당 기능만 비활성화된다.

## 아키텍처

### 요청 흐름
```
브라우저 → Next.js 프론트엔드 (포트 3000)
                ↓ axios (NEXT_PUBLIC_API_URL)
          FastAPI 백엔드 (포트 8000)
                ↓ async SQLAlchemy
            SQLite (backend/richbot.db)
```

백엔드는 **APScheduler**를 프로세스 내에서 함께 실행한다:
- 15분마다 (장 시간 09:00–15:35 KST, 월–금): FinanceDataReader 시세 수집 → MA5/20/60 계산 → 크로스 감지 → 거래량 급증 감지 → Web Push 발송
- 매일 18:00 KST: 관심종목 DART 공시 수집

### 백엔드 레이어

| 레이어 | 경로 | 역할 |
|---|---|---|
| 진입점 | `main.py` | FastAPI 앱, CORS, lifespan (DB 초기화 + 스케줄러 시작) |
| ORM | `models/` | SQLAlchemy 테이블 — `Stock`, `PriceSnapshot`, `CrossEvent`, `VolumeSpikeEvent`, `AlertSetting`, `PushSubscription`, `Notification`, `Disclosure`, `AiCommentary` |
| 스키마 | `schemas/` | Pydantic 요청/응답 형식 (도메인별 1파일) |
| 라우터 | `routers/` | HTTP 엔드포인트, 얇게 유지 — 서비스에 위임 |
| 서비스 | `services/` | 비즈니스 로직: `stock_data.py`(FinanceDataReader), `indicators.py`(MA·크로스), `alert_engine.py`(푸시 디스패치), `push_service.py`(pywebpush), `dart_service.py`(DART API), `ai_service.py`(Claude API) |
| 스케줄러 | `scheduler/` | `setup.py`(AsyncIOScheduler 설정), `jobs.py`(작업 함수) |
| 설정 | `config.py` | `pydantic-settings` — 프로젝트 루트(`../`)의 `.env` 읽기 |

### 시세 데이터 소스: FinanceDataReader

pykrx는 1.2.x부터 KRX 회원 로그인이 필요해져 **FinanceDataReader**로 교체했다.

```python
# 전체 종목 목록 (1회 호출, ~2875개)
fdr.StockListing('KRX')   # 컬럼: Code, Name, MarketId(STK=KOSPI/KSQ=KOSDAQ)

# OHLCV (컬럼: Open/High/Low/Close/Volume/Change, 인덱스: Date)
fdr.DataReader('005930', '2026-01-01', '2026-06-12')
```

전체 종목 캐시는 `backend/data/tickers_YYYYMMDD.json`에 저장되며 3일 이내 파일은 재사용된다 (주말/공휴일 안전). `ensure_cache_built()`가 서버 시작 시 백그라운드 스레드로 빌드를 트리거한다.

### 핵심 데이터 흐름: 골든/데드크로스 감지

```
scheduler/jobs.py
  → services/stock_data.py   (FinanceDataReader로 OHLCV 수집)
  → services/indicators.py   (MA·크로스·거래량비율 계산)
  → models/alert.py          (CrossEvent / VolumeSpikeEvent 저장)
  → services/alert_engine.py (미알림 이벤트 조회)
  → services/push_service.py (Web Push 발송)
```

`indicators.compute_indicators(df)`는 pandas DataFrame에 `ma5/ma20/ma60/vol_avg20/volume_ratio` 컬럼을 추가한다. `indicators.detect_crosses(df)`는 마지막 두 행을 비교해 3가지 MA 쌍(5/20, 5/60, 20/60)의 교차를 찾는다. 크로스 이벤트는 `notified=False`로 저장되고, `alert_engine.process_new_events()`가 순회하며 푸시 알림을 발송한 뒤 `notified=True`로 표시한다.

### 프론트엔드 레이어

| 레이어 | 경로 | 역할 |
|---|---|---|
| 페이지 | `src/app/` | `watchlist/`, `alerts/`, `disclosures/`, `all-stocks/` |
| 컴포넌트 | `src/components/` | `watchlist/WatchlistTable`(확장 가능 행), `stocks/AllStocksList`(전체종목+상세패널), `charts/PriceChart`(Recharts MA 오버레이), `ai/AICommentaryCard`, `alerts/AlertList`, `disclosures/DisclosureFeed`, `layout/Navbar+NotificationBell` |
| 훅 | `src/hooks/` | React Query 래퍼 — `useWatchlist`, `useAlerts`, `useStockPrice`(15분 폴링), `usePushNotifications`(SW 등록) |
| Lib | `src/lib/` | `api.ts`(axios 인스턴스), `queryClient.ts`, `formatters.ts`(KRW·퍼센트·거래량·날짜 포맷) |

`src/app/providers.tsx`가 트리 전체를 `QueryClientProvider`로 감싼다. 루트 `page.tsx`는 `/watchlist`로 리다이렉트한다.

### 전체종목 탭 (`/all-stocks`)

`GET /api/stocks/all?q=&page=1&size=50` — 캐시에서 페이지네이션 검색  
`GET /api/prices/{ticker}/chart` — DB 없이 FinanceDataReader 직접 조회 (미등록 종목 차트용)

## 주요 제약사항

- **데이터는 T+1 (전일 종가)** — FinanceDataReader는 실시간이 아님. 당일 데이터는 장 마감 후 제공된다.
- **DB 스키마 변경 시** — `richbot.db`를 삭제하고 재시작하면 `init_db()`가 `create_all`로 재생성한다. 개발 중 Alembic 불필요.
- **AI 해설은 사용자 요청 시에만 생성** — `(stock_id, date)` 단위로 `ai_commentary` 테이블에 캐시. 공시 요약도 동일하게 온디맨드.
