from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class StockCreate(BaseModel):
    ticker: str
    name: str
    market: str


class PriceSnapshotOut(BaseModel):
    date: datetime
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: int
    ma20: Optional[float] = None
    ma50: Optional[float] = None
    ma60: Optional[float] = None
    ma120: Optional[float] = None
    ma200: Optional[float] = None
    ma240: Optional[float] = None
    volume_ratio: Optional[float] = None

    model_config = {"from_attributes": True}


class StockOut(BaseModel):
    id: int
    ticker: str
    name: str
    market: str
    added_at: datetime
    is_active: bool
    latest_price: Optional[PriceSnapshotOut] = None

    model_config = {"from_attributes": True}


class StockSearchResult(BaseModel):
    ticker: str
    name: str
    market: str
