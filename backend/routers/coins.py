import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_db
from models.coin import Coin, CoinPriceSnapshot, CoinAlertSetting
from schemas.coin import CoinCreate, CoinOut, CoinSearchResult, CoinPriceSnapshotOut
from services.coin_data import search_coins, get_all_coins, fetch_coin_ohlcv
from services.coin_indicators import compute_coin_indicators

router = APIRouter(prefix="/api/coins", tags=["coins"])


@router.get("/search", response_model=list[CoinSearchResult])
async def search(q: str):
    if not q:
        return []
    result = search_coins(q)
    return result["items"]


@router.get("/all")
async def all_coins(q: str = "", page: int = 1, size: int = 50):
    if not _cache_ready():
        await get_all_coins()
    return search_coins(q, page=page, size=size)


@router.get("/info/{ticker}")
async def coin_info(ticker: str, db: AsyncSession = Depends(get_db)):
    """코인 기본 정보 (관심목록 여부 포함). 전체 코인 대상."""
    result = await db.execute(select(Coin).where(Coin.ticker == ticker))
    coin = result.scalar_one_or_none()
    if coin:
        return {"ticker": coin.ticker, "name": coin.name, "is_active": coin.is_active}

    # DB에 없으면 Upbit 캐시에서 조회
    from services.coin_data import _coin_cache
    for c in _coin_cache:
        if c["ticker"] == ticker:
            return {"ticker": c["ticker"], "name": c["name"], "is_active": False}

    # 캐시가 비어있으면 갱신 후 재시도
    await get_all_coins()
    from services.coin_data import _coin_cache as cache2
    for c in cache2:
        if c["ticker"] == ticker:
            return {"ticker": c["ticker"], "name": c["name"], "is_active": False}

    raise HTTPException(status_code=404, detail="Coin not found")


@router.get("", response_model=list[CoinOut])
async def list_coins(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Coin).where(Coin.is_active == True).order_by(Coin.added_at))
    coins = result.scalars().all()
    out = []
    for c in coins:
        snap_result = await db.execute(
            select(CoinPriceSnapshot).where(CoinPriceSnapshot.coin_id == c.id)
            .order_by(desc(CoinPriceSnapshot.date)).limit(1)
        )
        latest = snap_result.scalar_one_or_none()
        item = CoinOut.model_validate(c)
        item.latest_price = CoinPriceSnapshotOut.model_validate(latest) if latest else None
        out.append(item)
    return out


@router.post("", response_model=CoinOut, status_code=201)
async def add_coin(payload: CoinCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Coin).where(Coin.ticker == payload.ticker))
    coin = existing.scalar_one_or_none()
    if coin:
        if not coin.is_active:
            coin.is_active = True
            await db.commit()
            await db.refresh(coin)
        return CoinOut.model_validate(coin)

    coin = Coin(ticker=payload.ticker, name=payload.name)
    db.add(coin)
    await db.flush()
    setting = CoinAlertSetting(coin_id=coin.id)
    db.add(setting)
    await db.commit()
    await db.refresh(coin)

    asyncio.create_task(_seed_coin_prices(coin.id, payload.ticker, db))
    return CoinOut.model_validate(coin)


@router.delete("/{ticker}", status_code=204)
async def delete_coin(ticker: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Coin).where(Coin.ticker == ticker))
    coin = result.scalar_one_or_none()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")
    coin.is_active = False
    await db.commit()


def _cache_ready() -> bool:
    from services.coin_data import _coin_cache
    return bool(_coin_cache)


async def _seed_coin_prices(coin_id: int, ticker: str, db: AsyncSession):
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    df = await fetch_coin_ohlcv(ticker, 400)
    if df.empty:
        return
    df = compute_coin_indicators(df)
    async with db.bind.connect() as conn:
        for idx, row in df.iterrows():
            def sf(v):
                try:
                    f = float(v); return None if f != f else f
                except Exception:
                    return None
            stmt = sqlite_insert(CoinPriceSnapshot).values(
                coin_id=coin_id,
                date=idx.date() if hasattr(idx, "date") else idx,
                open=sf(row.get("open")), high=sf(row.get("high")),
                low=sf(row.get("low")), close=float(row["close"]),
                volume=float(row["volume"]),
                ma7=sf(row.get("ma7")), ma20=sf(row.get("ma20")),
                ma25=sf(row.get("ma25")), ma50=sf(row.get("ma50")),
                ma99=sf(row.get("ma99")), ma200=sf(row.get("ma200")),
                volume_ratio=sf(row.get("volume_ratio")),
            ).on_conflict_do_nothing(index_elements=["coin_id", "date"])
            await conn.execute(stmt)
        await conn.commit()
