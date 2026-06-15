import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from database import get_db, engine
from models.stock import Stock, PriceSnapshot
from models.alert import AlertSetting
from schemas.stock import StockCreate, StockOut, StockSearchResult, PriceSnapshotOut
from services.stock_data import search_stocks, fetch_ohlcv, get_stock_name
from services.indicators import compute_indicators
from services.utils import safe_float

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/search", response_model=list[StockSearchResult])
async def search(q: str):
    if len(q) < 1:
        return []
    result = search_stocks(q)
    return result["items"]


@router.get("/info/{ticker}", response_model=StockSearchResult)
async def stock_info(ticker: str):
    """캐시에서 단일 종목 정보 조회 (관심종목 여부 무관)."""
    result = search_stocks(ticker, page=1, size=20)
    for item in result["items"]:
        if item["ticker"] == ticker:
            return item
    raise HTTPException(status_code=404, detail="Stock not found")


@router.get("/all")
async def all_stocks(q: str = "", page: int = 1, size: int = 50):
    return search_stocks(q, page=page, size=size)


@router.get("", response_model=list[StockOut])
async def list_stocks(db: AsyncSession = Depends(get_db)):
    latest_subq = (
        select(PriceSnapshot.stock_id, func.max(PriceSnapshot.date).label("max_date"))
        .group_by(PriceSnapshot.stock_id)
        .subquery()
    )
    rows = await db.execute(
        select(Stock, PriceSnapshot)
        .outerjoin(latest_subq, Stock.id == latest_subq.c.stock_id)
        .outerjoin(
            PriceSnapshot,
            (PriceSnapshot.stock_id == latest_subq.c.stock_id)
            & (PriceSnapshot.date == latest_subq.c.max_date),
        )
        .where(Stock.is_active == True)
        .order_by(Stock.added_at)
    )
    out = []
    for stock, latest in rows.all():
        item = StockOut.model_validate(stock)
        item.latest_price = PriceSnapshotOut.model_validate(latest) if latest else None
        out.append(item)
    return out


@router.post("", response_model=StockOut, status_code=201)
async def add_stock(payload: StockCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Stock).where(Stock.ticker == payload.ticker))
    stock = existing.scalar_one_or_none()
    if stock:
        if not stock.is_active:
            stock.is_active = True
            await db.commit()
            await db.refresh(stock)
        return StockOut.model_validate(stock)

    stock = Stock(ticker=payload.ticker, name=payload.name, market=payload.market)
    db.add(stock)
    await db.flush()
    setting = AlertSetting(stock_id=stock.id)
    db.add(setting)
    await db.commit()
    await db.refresh(stock)

    task = asyncio.create_task(_seed_prices(stock.id, payload.ticker))
    task.add_done_callback(
        lambda t: logger.error("가격 시드 오류 %s: %s", payload.ticker, t.exception())
        if not t.cancelled() and t.exception() else None
    )
    return StockOut.model_validate(stock)


@router.delete("/{ticker}", status_code=204)
async def delete_stock(ticker: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock).where(Stock.ticker == ticker))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    stock.is_active = False
    await db.commit()


async def _seed_prices(stock_id: int, ticker: str):
    from models.stock import PriceSnapshot
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    df = await asyncio.to_thread(fetch_ohlcv, ticker, 400)
    if df.empty:
        return
    df = compute_indicators(df)
    async with engine.connect() as conn:
        for idx, row in df.iterrows():
            stmt = sqlite_insert(PriceSnapshot).values(
                stock_id=stock_id, date=idx.date(),
                open=safe_float(row.get("open")), high=safe_float(row.get("high")),
                low=safe_float(row.get("low")), close=float(row["close"]),
                volume=int(row["volume"]),
                ma20=safe_float(row.get("ma20")), ma50=safe_float(row.get("ma50")),
                ma60=safe_float(row.get("ma60")), ma120=safe_float(row.get("ma120")),
                ma200=safe_float(row.get("ma200")), ma240=safe_float(row.get("ma240")),
                volume_ratio=safe_float(row.get("volume_ratio")),
            ).on_conflict_do_nothing(index_elements=["stock_id", "date"])
            await conn.execute(stmt)
        await conn.commit()
