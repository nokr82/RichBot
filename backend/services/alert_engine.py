import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.alert import CrossEvent, VolumeSpikeEvent
from models.notification import Notification
from models.stock import Stock
from services.push_service import send_push_to_all

logger = logging.getLogger(__name__)

CROSS_LABELS = {
    "GOLDEN": "골든크로스",
    "DEAD":   "데드크로스",
}


async def process_new_events(db: AsyncSession):
    """Find unnotified cross + volume events, send pushes, mark as notified."""
    # Cross events
    cross_res = await db.execute(
        select(CrossEvent).where(CrossEvent.notified == False)
    )
    for event in cross_res.scalars().all():
        stock_res = await db.execute(select(Stock).where(Stock.id == event.stock_id))
        stock = stock_res.scalar_one_or_none()
        if not stock:
            continue
        direction = "GOLDEN" if "GOLDEN" in event.event_type else "DEAD"
        label = CROSS_LABELS[direction]
        ma_pair = event.event_type.replace(direction + "_", "").replace("_", "/")
        title = f"{stock.name} {label} 발생"
        body  = f"MA{ma_pair} 교차 | 단기: {event.short_val:,.0f} 장기: {event.long_val:,.0f}"
        await send_push_to_all(db, title=title, body=body, stock_id=stock.id)
        await db.execute(update(CrossEvent).where(CrossEvent.id == event.id).values(notified=True))

    # Volume spike events
    vol_res = await db.execute(
        select(VolumeSpikeEvent).where(VolumeSpikeEvent.notified == False)
    )
    for event in vol_res.scalars().all():
        stock_res = await db.execute(select(Stock).where(Stock.id == event.stock_id))
        stock = stock_res.scalar_one_or_none()
        if not stock:
            continue
        title = f"{stock.name} 거래량 급증"
        body  = f"평균 대비 {event.ratio:.1f}배 ({event.ratio * 100:.0f}%)"
        await send_push_to_all(db, title=title, body=body, stock_id=stock.id)
        await db.execute(update(VolumeSpikeEvent).where(VolumeSpikeEvent.id == event.id).values(notified=True))

    await db.commit()
