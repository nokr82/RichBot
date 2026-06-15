from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class CoinCreate(BaseModel):
    ticker: str
    name: str


class CoinSearchResult(BaseModel):
    ticker: str
    name: str


class CoinPriceSnapshotOut(BaseModel):
    date: date | datetime
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: float
    ma7: Optional[float] = None
    ma20: Optional[float] = None
    ma25: Optional[float] = None
    ma50: Optional[float] = None
    ma99: Optional[float] = None
    ma200: Optional[float] = None
    volume_ratio: Optional[float] = None

    model_config = {"from_attributes": True}


class CoinOut(BaseModel):
    id: int
    ticker: str
    name: str
    is_active: bool
    added_at: datetime
    latest_price: Optional[CoinPriceSnapshotOut] = None

    model_config = {"from_attributes": True}


class CoinCrossEventOut(BaseModel):
    id: int
    coin_id: int
    coin_name: Optional[str] = None
    ticker: Optional[str] = None
    event_type: str
    short_ma: str
    long_ma: str
    short_val: float
    long_val: float
    occurred_at: datetime
    notified: bool

    model_config = {"from_attributes": True}


class CoinVolumeSpikeEventOut(BaseModel):
    id: int
    coin_id: int
    coin_name: Optional[str] = None
    ticker: Optional[str] = None
    date: date
    current_volume: Optional[float] = None
    avg_volume_20: Optional[float] = None
    ratio: float
    threshold: float
    notified: bool
    occurred_at: datetime

    model_config = {"from_attributes": True}


class CoinAlertSettingOut(BaseModel):
    coin_id: int
    enabled_pairs: list[str]
    volume_spike: bool
    volume_threshold: float
    push_notify: bool

    model_config = {"from_attributes": True}


class CoinAlertSettingUpdate(BaseModel):
    enabled_pairs: Optional[list[str]] = None
    volume_spike: Optional[bool] = None
    volume_threshold: Optional[float] = None
    push_notify: Optional[bool] = None


class CoinAlertsResponse(BaseModel):
    cross_events: list[dict]
    volume_spikes: list[dict]


class GlobalCoinAlertSettingOut(BaseModel):
    id: int
    enabled_pairs: list[str]
    volume_spike: bool
    volume_threshold: float

    model_config = {"from_attributes": True}


class GlobalCoinAlertSettingUpdate(BaseModel):
    enabled_pairs: Optional[list[str]] = None
    volume_spike: Optional[bool] = None
    volume_threshold: Optional[float] = None
