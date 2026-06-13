from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_db
from models.stock import Stock, PriceSnapshot
from models.alert import AlertSetting
from schemas.stock import StockCreate, StockOut, StockSearchResult, PriceSnapshotOut
from services.stock_data import search_stocks, fetch_ohlcv, get_stock_name
from services.indicators import compute_indicators

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
    result = await db.execute(select(Stock).where(Stock.is_active == True).order_by(Stock.added_at))
    stocks = result.scalars().all()
    out = []
    for s in stocks:
        snap_result = await db.execute(
            select(PriceSnapshot).where(PriceSnapshot.stock_id == s.id)
            .order_by(desc(PriceSnapshot.date)).limit(1)
        )
        latest = snap_result.scalar_one_or_none()
        item = StockOut.model_validate(s)
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

    import asyncio
    asyncio.create_task(_seed_prices(stock.id, payload.ticker, db))
    return StockOut.model_validate(stock)


@router.delete("/{ticker}", status_code=204)
async def delete_stock(ticker: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock).where(Stock.ticker == ticker))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    stock.is_active = False
    await db.commit()


async def _seed_prices(stock_id: int, ticker: str, db: AsyncSession):
    from models.stock import PriceSnapshot
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    import asyncio

    # Fetch 400 days to support MA240
    df = await asyncio.to_thread(fetch_ohlcv, ticker, 400)
    if df.empty:
        return
    df = compute_indicators(df)
    async with db.bind.connect() as conn:
        for idx, row in df.iterrows():
            def sf(v):
                try:
                    f = float(v)
                    return None if f != f else f
                except Exception:
                    return None
            stmt = sqlite_insert(PriceSnapshot).values(
                stock_id=stock_id, date=idx.date(),
                open=sf(row.get("open")), high=sf(row.get("high")),
                low=sf(row.get("low")), close=float(row["close"]),
                volume=int(row["volume"]),
                ma20=sf(row.get("ma20")), ma50=sf(row.get("ma50")),
                ma60=sf(row.get("ma60")), ma120=sf(row.get("ma120")),
                ma200=sf(row.get("ma200")), ma240=sf(row.get("ma240")),
                volume_ratio=sf(row.get("volume_ratio")),
            ).on_conflict_do_nothing(index_elements=["stock_id", "date"])
            await conn.execute(stmt)
        await conn.commit()
