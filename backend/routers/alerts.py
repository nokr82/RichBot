from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from database import get_db
from models.stock import Stock
from models.alert import CrossEvent, VolumeSpikeEvent, AlertSetting
from models.notification import Notification
from schemas.alert import CrossEventOut, VolumeSpikeEventOut, AlertSettingOut, AlertSettingUpdate

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=dict)
async def list_alerts(page: int = 1, size: int = 20, db: AsyncSession = Depends(get_db)):
    offset = (page - 1) * size
    cross_res = await db.execute(
        select(CrossEvent).order_by(CrossEvent.occurred_at.desc()).offset(offset).limit(size)
    )
    vol_res = await db.execute(
        select(VolumeSpikeEvent).order_by(VolumeSpikeEvent.occurred_at.desc()).offset(offset).limit(size)
    )
    return {
        "cross_events": [CrossEventOut.model_validate(r) for r in cross_res.scalars().all()],
        "volume_spikes": [VolumeSpikeEventOut.model_validate(r) for r in vol_res.scalars().all()],
    }


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
