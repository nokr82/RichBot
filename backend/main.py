import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import stocks, prices, alerts, notifications, disclosures, ai
from scheduler.setup import scheduler
from scheduler.jobs import fetch_prices_job, fetch_disclosures_job
from services.stock_data import ensure_cache_built

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    ensure_cache_built()  # 전체 종목 캐시 백그라운드 빌드
    scheduler.add_job(fetch_prices_job, "interval", minutes=15, id="fetch_prices", replace_existing=True)
    scheduler.add_job(fetch_disclosures_job, "cron", hour=18, minute=0, id="fetch_disclosures", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler started")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="RichBot API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
app.include_router(stocks.router)
app.include_router(prices.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(disclosures.router)
app.include_router(ai.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
