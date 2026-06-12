import json
import logging
from pywebpush import webpush, WebPushException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.notification import PushSubscription, Notification
from config import settings

logger = logging.getLogger(__name__)


async def send_push_to_all(db: AsyncSession, title: str, body: str, stock_id: int | None = None):
    """Send a Web Push notification to all active subscriptions and log to DB."""
    result = await db.execute(select(PushSubscription).where(PushSubscription.is_active == True))
    subs = result.scalars().all()

    payload = json.dumps({"title": title, "body": body})

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_admin_email}"},
            )
        except WebPushException as exc:
            logger.warning("Push failed for %s: %s", sub.endpoint[:40], exc)
            if exc.response and exc.response.status_code in (404, 410):
                sub.is_active = False

    notif = Notification(stock_id=stock_id, type="PUSH", title=title, body=body)
    db.add(notif)
    await db.commit()
