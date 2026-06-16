# RichBot

주식·코인 모니터링 웹앱. KRX 전 종목 골든/데드크로스 및 거래량 급증을 자동 감지하고 웹 푸시로 알림을 발송합니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 관심종목/코인 | 추가·삭제, 종목별 알림 설정 |
| 전체종목 스캔 | KRX 전 종목(~2,875개) 골든/데드크로스 & 거래량 급증 자동 감지 |
| 전체코인 스캔 | 업비트 KRW 전 코인 크로스·거래량 감지 |
| 차트 | 주식 15분/일/주/월/연봉, 코인 15분/60분/일/주/월/연봉, MA 오버레이·캔들차트 |
| 웹 푸시 알림 | VAPID 기반, 브라우저 백그라운드 수신 |
| DART 공시 | 관심종목 최신 공시 자동 수집 및 AI 요약 |
| AI 해설 | Claude API로 주식·코인 최근 시세·크로스 분석 해설 생성 |
| 전역 알림 설정 | MA 쌍·거래량 임계값 전역 설정, 종목별 개별 설정도 지원 |

## 기술 스택

**백엔드** — Python 3.11 · FastAPI · SQLAlchemy 2 (async) · SQLite · APScheduler · FinanceDataReader · pywebpush · Anthropic Claude API

**프론트엔드** — Next.js (App Router) · TypeScript · Tailwind CSS · Recharts · TanStack React Query v5

## 빠른 시작

### 사전 요구사항

- Python 3.11+
- Node.js 18+

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 필요한 키를 입력합니다. 키가 없어도 앱은 실행되며 해당 기능만 비활성화됩니다.

| 키 | 용도 | 발급처 |
|---|---|---|
| `DART_API_KEY` | 공시 수집 | https://opendart.fss.or.kr |
| `ANTHROPIC_API_KEY` | AI 해설 | https://console.anthropic.com |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | 웹 푸시 | 아래 명령으로 직접 생성 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 프론트 웹 푸시 | 위 공개키와 동일값, `frontend/.env.local`에 설정 |

**VAPID 키 생성 (최초 1회)**

```bash
cd backend
.\.venv\Scripts\python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print('PUBLIC:', v.public_key); print('PRIVATE:', v.private_key)"
```

### 2. 백엔드 실행

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000
```

### 3. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 아키텍처

```
브라우저
  ↓ axios (포트 3000 → 8000)
Next.js 프론트엔드 (포트 3000)
  ↓ REST API
FastAPI 백엔드 (포트 8000)
  ↓ async SQLAlchemy
SQLite (backend/richbot.db)
```

APScheduler가 백엔드 프로세스 내에서 함께 실행됩니다.

| 작업 | 주기 |
|---|---|
| KRX 전 종목 크로스·거래량 감지 + 웹 푸시 | 평일 16:00 KST |
| 업비트 전 코인 크로스·거래량 감지 | 매 시간 정각 |
| 관심종목 DART 공시 수집 | 매일 18:00 KST |

## Docker 배포

```bash
docker-compose up -d
```

## 주요 제약

- **데이터 T+1** — FinanceDataReader는 실시간 미지원, 당일 데이터는 장 마감 후 제공
- **DB 스키마 변경** — `backend/richbot.db` 삭제 후 재시작하면 자동 재생성
- **AI 해설** — 사용자 요청 시에만 생성, 날짜별로 캐시됨

## 라이선스

MIT



주식·암호화폐 모니터링 웹 서비스 개발 (개인 프로젝트)

FastAPI + SQLAlchemy(async) 기반 REST API 서버 설계 및 구현, APScheduler로 KRX 주식 시세 자동 수집(일 1회) 및 암호화폐 시세 수집(시간별) 스케줄링
FinanceDataReader(KRX), Upbit API를 통한 OHLCV 데이터 수집 및 이동평균선(MA5·20·60·99·200) 계산, 골든크로스·데드크로스 감지 알고리즘 구현
Web Push(pywebpush, VAPID) 기반 실시간 알림 시스템 구축 — 크로스 이벤트 및 거래량 급증 감지 시 브라우저 푸시 발송
DART OpenAPI 연동으로 관심종목 공시 자동 수집 및 Anthropic Claude API를 활용한 공시 요약·종목 AI 해설 기능 구현
Next.js 16(App Router) + React Query + Recharts로 인터랙티브 차트(15분봉~연봉), 관심종목·전체종목 검색, 알림 내역 등 프론트엔드 구현
Docker Compose + Nginx 리버스 프록시로 AWS EC2 프로덕션 배포 — same-origin 구성으로 CORS 제거, 무중단 업데이트 환경 구축