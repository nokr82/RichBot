from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import get_db
from models.coin import Coin, CoinCrossEvent, CoinVolumeSpikeEvent, CoinAlertSetting
from schemas.coin import CoinCrossEventOut, CoinVolumeSpikeEventOut, CoinAlertSettingOut, CoinAlertSettingUpdate

router = APIRouter(prefix="/api/coin-alerts", tags=["coin-alerts"])


@router.post("/scan", status_code=200)
async def manual_coin_scan():
    from scheduler.jobs import fetch_coin_prices_job
    await fetch_coin_prices_job()
    return {"ok": True}


@router.get("", response_model=dict)
async def list_coin_alerts(page: int = 1, size: int = 20, db: AsyncSession = Depends(get_db)):
    offset = (page - 1) * size
    cross_res = await db.execute(
        select(CoinCrossEvent, Coin.name, Coin.ticker)
        .join(Coin, CoinCrossEvent.coin_id == Coin.id)
        .order_by(CoinCrossEvent.occurred_at.desc())
        .offset(offset).limit(size)
    )
    vol_res = await db.execute(
        select(CoinVolumeSpikeEvent, Coin.name, Coin.ticker)
        .join(Coin, CoinVolumeSpikeEvent.coin_id == Coin.id)
        .order_by(CoinVolumeSpikeEvent.occurred_at.desc())
        .offset(offset).limit(size)
    )

    cross_events = []
    for event, name, ticker in cross_res:
        d = CoinCrossEventOut.model_validate(event).model_dump()
        d["coin_name"] = name
        d["ticker"] = ticker
        cross_events.append(d)

    vol_events = []
    for event, name, ticker in vol_res:
        d = CoinVolumeSpikeEventOut.model_validate(event).model_dump()
        d["coin_name"] = name
        d["ticker"] = ticker
        vol_events.append(d)

    return {"cross_events": cross_events, "volume_spikes": vol_events}


@router.get("/unread-count")
async def coin_unread_count(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    result = await db.execute(
        select(func.count()).select_from(CoinCrossEvent).where(CoinCrossEvent.notified == False)
    )
    cross_count = result.scalar() or 0
    result2 = await db.execute(
        select(func.count()).select_from(CoinVolumeSpikeEvent).where(CoinVolumeSpikeEvent.notified == False)
    )
    spike_count = result2.scalar() or 0
    return {"count": cross_count + spike_count}


@router.post("/mark-read", status_code=204)
async def mark_coin_read(ids: list[int] | None = None, all: bool = False, db: AsyncSession = Depends(get_db)):
    stmt_cross = update(CoinCrossEvent).values(notified=True)
    stmt_vol = update(CoinVolumeSpikeEvent).values(notified=True)
    if not all and ids:
        stmt_cross = stmt_cross.where(CoinCrossEvent.id.in_(ids))
        stmt_vol = stmt_vol.where(CoinVolumeSpikeEvent.id.in_(ids))
    await db.execute(stmt_cross)
    await db.execute(stmt_vol)
    await db.commit()


@router.get("/settings/{ticker}", response_model=CoinAlertSettingOut)
async def get_coin_settings(ticker: str, db: AsyncSession = Depends(get_db)):
    coin = await _get_coin(ticker, db)
    result = await db.execute(select(CoinAlertSetting).where(CoinAlertSetting.coin_id == coin.id))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Settings not found")
    return CoinAlertSettingOut.model_validate(setting)


@router.put("/settings/{ticker}", response_model=CoinAlertSettingOut)
async def update_coin_settings(ticker: str, payload: CoinAlertSettingUpdate, db: AsyncSession = Depends(get_db)):
    coin = await _get_coin(ticker, db)
    result = await db.execute(select(CoinAlertSetting).where(CoinAlertSetting.coin_id == coin.id))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Settings not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(setting, field, val)
    await db.commit()
    await db.refresh(setting)
    return CoinAlertSettingOut.model_validate(setting)


async def _get_coin(ticker: str, db: AsyncSession) -> Coin:
    result = await db.execute(select(Coin).where(Coin.ticker == ticker, Coin.is_active == True))
    coin = result.scalar_one_or_none()
    if not coin:
        raise HTTPException(status_code=404, detail="Coin not found")
    return coin
