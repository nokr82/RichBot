import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_db
from models.coin import Coin, CoinPriceSnapshot
from schemas.coin import CoinPriceSnapshotOut
from services.coin_data import fetch_coin_chart
from services.coin_indicators import compute_coin_indicators

router = APIRouter(prefix="/api/coin-prices", tags=["coin-prices"])


@router.get("/{ticker}/chart", response_model=list[CoinPriceSnapshotOut])
async def coin_chart(
    ticker: str,
    interval: str = Query(default="day", pattern="^(day|60m|week|month)$"),
):
    df = await fetch_coin_chart(ticker, interval)
    if df.empty:
        raise HTTPException(status_code=404, detail="가격 데이터를 가져올 수 없습니다")
    df = compute_coin_indicators(df)
    rows = []
    for idx, row in df.iterrows():
        def sf(v):
            try:
                f = float(v); return None if f != f else f
            except Exception:
                return None
        rows.append(CoinPriceSnapshotOut(
            date=idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx,
            open=sf(row.get("open")), high=sf(row.get("high")),
            low=sf(row.get("low")), close=float(row["close"]),
            volume=float(row["volume"]),
            ma7=sf(row.get("ma7")), ma20=sf(row.get("ma20")),
            ma25=sf(row.get("ma25")), ma50=sf(row.get("ma50")),
            ma99=sf(row.get("ma99")), ma200=sf(row.get("ma200")),
            volume_ratio=sf(row.get("volume_ratio")),
        ))
    return rows


@router.get("/{ticker}/latest", response_model=CoinPriceSnapshotOut)
async def latest_price(ticker: str, db: AsyncSession = Depends(get_db)):
    coin = await _get_coin(ticker, db)
    result = await db.execute(
        select(CoinPriceSnapshot).where(CoinPriceSnapshot.coin_id == coin.id)
        .order_by(desc(CoinPriceSnapshot.date)).limit(1)
    )
    snap = result.scalar_one_or_none()
    if not snap:
        raise HTTPException(status_code=404, detail="No price data")
    return CoinPriceSnapshotOut.model_validate(snap)


async def _get_coin(ticker: str, db: AsyncSession) -> Coin:
    result = await db.execute(select(Coin).where(Coin.ticker == ticker, Coin.is_active == True))
    coin = result.scalar_one_or_none()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")
    return coin
