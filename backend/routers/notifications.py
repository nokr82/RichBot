from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import get_db
from models.notification import PushSubscription, Notification
from schemas.notification import PushSubscriptionIn, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.post("/subscribe", status_code=201)
async def subscribe(payload: PushSubscriptionIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint))
    sub = result.scalar_one_or_none()
    if sub:
        sub.p256dh = payload.p256dh
        sub.auth = payload.auth
        sub.is_active = True
    else:
        sub = PushSubscription(endpoint=payload.endpoint, p256dh=payload.p256dh, auth=payload.auth)
        db.add(sub)
    await db.commit()
    return {"status": "subscribed"}


@router.delete("/unsubscribe", status_code=204)
async def unsubscribe(endpoint: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
    sub = result.scalar_one_or_none()
    if sub:
        sub.is_active = False
        await db.commit()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(page: int = 1, size: int = 30, db: AsyncSession = Depends(get_db)):
    offset = (page - 1) * size
    result = await db.execute(
        select(Notification).order_by(Notification.created_at.desc()).offset(offset).limit(size)
    )
    return [NotificationOut.model_validate(r) for r in result.scalars().all()]


@router.post("/test-push")
async def test_push(db: AsyncSession = Depends(get_db)):
    from services.push_service import send_push_to_all
    await send_push_to_all(db, title="RichBot 테스트", body="알림이 정상 작동합니다.")
    return {"status": "sent"}
