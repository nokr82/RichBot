from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import asyncio
from database import get_db
from models.stock import Stock, PriceSnapshot
from schemas.stock import PriceSnapshotOut
from services.stock_data import fetch_ohlcv, fetch_ohlcv_interval
from services.indicators import compute_indicators
from services.utils import safe_float

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/{ticker}/history", response_model=list[PriceSnapshotOut])
async def price_history(ticker: str, days: int = 90, db: AsyncSession = Depends(get_db)):
    stock = await _get_stock(ticker, db)
    result = await db.execute(
        select(PriceSnapshot).where(PriceSnapshot.stock_id == stock.id)
        .order_by(PriceSnapshot.date).limit(days)
    )
    return [PriceSnapshotOut.model_validate(r) for r in result.scalars().all()]


@router.get("/{ticker}/chart", response_model=list[PriceSnapshotOut])
async def live_chart(
    ticker: str,
    days: int = 90,
    interval: str = Query(default="day", pattern="^(15m|day|week|month|year)$"),
):
    """FinanceDataReader 직접 조회 - 미등록 종목 및 다중 시간봉 지원."""
    df = await asyncio.to_thread(fetch_ohlcv_interval, ticker, interval)
    if df.empty:
        raise HTTPException(status_code=404, detail="가격 데이터를 가져올 수 없습니다")
    df = compute_indicators(df)
    rows = []
    for idx, row in df.iterrows():
        rows.append(PriceSnapshotOut(
            date=idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx,
            open=safe_float(row.get("open")), high=safe_float(row.get("high")),
            low=safe_float(row.get("low")), close=float(row["close"]), volume=int(row["volume"]),
            ma20=safe_float(row.get("ma20")), ma50=safe_float(row.get("ma50")), ma60=safe_float(row.get("ma60")),
            ma120=safe_float(row.get("ma120")), ma200=safe_float(row.get("ma200")), ma240=safe_float(row.get("ma240")),
            volume_ratio=safe_float(row.get("volume_ratio")),
        ))
    return rows


@router.get("/{ticker}/latest", response_model=PriceSnapshotOut)
async def latest_price(ticker: str, db: AsyncSession = Depends(get_db)):
    stock = await _get_stock(ticker, db)
    result = await db.execute(
        select(PriceSnapshot).where(PriceSnapshot.stock_id == stock.id)
        .order_by(desc(PriceSnapshot.date)).limit(1)
    )
    snap = result.scalar_one_or_none()
    if not snap:
        raise HTTPException(status_code=404, detail="No price data")
    return PriceSnapshotOut.model_validate(snap)


async def _get_stock(ticker: str, db: AsyncSession) -> Stock:
    result = await db.execute(select(Stock).where(Stock.ticker == ticker, Stock.is_active == True))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock
