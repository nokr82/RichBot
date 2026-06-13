from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from database import get_db
from models.stock import Stock
from models.alert import CrossEvent, VolumeSpikeEvent, AlertSetting, GlobalAlertSetting
from models.notification import Notification
from schemas.alert import (
    CrossEventOut, VolumeSpikeEventOut,
    AlertSettingOut, AlertSettingUpdate,
    GlobalAlertSettingOut, GlobalAlertSettingUpdate,
)

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# ── 전역 알림 설정 ──────────────────────────────────────────────────────────

@router.get("/global-settings", response_model=GlobalAlertSettingOut)
async def get_global_settings(db: AsyncSession = Depends(get_db)):
    setting = await _get_or_create_global(db)
    return GlobalAlertSettingOut.model_validate(setting)


@router.put("/global-settings", response_model=GlobalAlertSettingOut)
async def update_global_settings(payload: GlobalAlertSettingUpdate, db: AsyncSession = Depends(get_db)):
    setting = await _get_or_create_global(db)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(setting, field, val)
    await db.commit()
    await db.refresh(setting)
    return GlobalAlertSettingOut.model_validate(setting)


async def _get_or_create_global(db: AsyncSession) -> GlobalAlertSetting:
    result = await db.execute(select(GlobalAlertSetting).where(GlobalAlertSetting.id == 1))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = GlobalAlertSetting(id=1)
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    return setting


# ── 수동 수집 ───────────────────────────────────────────────────────────────

@router.post("/scan", status_code=200)
async def manual_scan():
    """골든/데드크로스 수동 수집 — fetch_prices_job 즉시 실행."""
    from scheduler.jobs import fetch_prices_job
    await fetch_prices_job()
    return {"ok": True}


# ── 알림 목록 ───────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_alerts(page: int = 1, size: int = 20, db: AsyncSession = Depends(get_db)):
    offset = (page - 1) * size
    cross_res = await db.execute(
        select(CrossEvent, Stock.name, Stock.ticker, Stock.market)
        .join(Stock, CrossEvent.stock_id == Stock.id)
        .order_by(CrossEvent.occurred_at.desc())
        .offset(offset).limit(size)
    )
    vol_res = await db.execute(
        select(VolumeSpikeEvent, Stock.name, Stock.ticker, Stock.market)
        .join(Stock, VolumeSpikeEvent.stock_id == Stock.id)
        .order_by(VolumeSpikeEvent.occurred_at.desc())
        .offset(offset).limit(size)
    )

    cross_events = []
    for event, name, ticker, market in cross_res:
        d = CrossEventOut.model_validate(event).model_dump()
        d["stock_name"] = name
        d["ticker"] = ticker
        d["market"] = market
        cross_events.append(d)

    vol_events = []
    for event, name, ticker, market in vol_res:
        d = VolumeSpikeEventOut.model_validate(event).model_dump()
        d["stock_name"] = name
        d["ticker"] = ticker
        d["market"] = market
        vol_events.append(d)

    return {"cross_events": cross_events, "volume_spikes": vol_events}


@router.get("/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(func.count()).select_from(Notification).where(Notification.is_read == False)
    )
    return {"count": result.scalar()}


@router.post("/mark-read", status_code=204)
async def mark_read(ids: list[int] | None = None, all: bool = False, db: AsyncSession = Depends(get_db)):
    stmt = update(Notification).values(is_read=True)
    if not all and ids:
        stmt = stmt.where(Notification.id.in_(ids))
    await db.execute(stmt)
    await db.commit()


# ── 종목별 알림 설정 ─────────────────────────────────────────────────────────

@router.get("/settings/{ticker}", response_model=AlertSettingOut)
async def get_settings(ticker: str, db: AsyncSession = Depends(get_db)):
    stock = await _get_stock(ticker, db)
    result = await db.execute(select(AlertSetting).where(AlertSetting.stock_id == stock.id))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Settings not found")
    return AlertSettingOut.model_validate(setting)


@router.put("/settings/{ticker}", response_model=AlertSettingOut)
async def update_settings(ticker: str, payload: AlertSettingUpdate, db: AsyncSession = Depends(get_db)):
    stock = await _get_stock(ticker, db)
    result = await db.execute(select(AlertSetting).where(AlertSetting.stock_id == stock.id))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Settings not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(setting, field, val)
    await db.commit()
    await db.refresh(setting)
    return AlertSettingOut.model_validate(setting)


async def _get_stock(ticker: str, db: AsyncSession) -> Stock:
    result = await db.execute(select(Stock).where(Stock.ticker == ticker, Stock.is_active == True))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock