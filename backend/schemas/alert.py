from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class CrossEventOut(BaseModel):
    id: int
    stock_id: int
    event_type: str
    short_ma: str
    long_ma: str
    short_val: float
    long_val: float
    occurred_at: datetime
    notified: bool

    model_config = {"from_attributes": True}


class VolumeSpikeEventOut(BaseModel):
    id: int
    stock_id: int
    date: date
    current_volume: Optional[int] = None
    avg_volume_20: Optional[int] = None
    ratio: float
    threshold: float
    notified: bool
    occurred_at: datetime

    model_config = {"from_attributes": True}


class AlertSettingOut(BaseModel):
    stock_id: int
    enabled_pairs: list[str]
    volume_spike: bool
    volume_threshold: float
    push_notify: bool

    model_config = {"from_attributes": True}


class AlertSettingUpdate(BaseModel):
    enabled_pairs: Optional[list[str]] = None
    volume_spike: Optional[bool] = None
    volume_threshold: Optional[float] = None
    push_notify: Optional[bool] = None
