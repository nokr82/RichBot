from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PushSubscriptionIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class NotificationOut(BaseModel):
    id: int
    stock_id: Optional[int] = None
    type: str
    title: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
