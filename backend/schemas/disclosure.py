from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class DisclosureOut(BaseModel):
    id: int
    stock_id: Optional[int] = None
    dart_rcept_no: str
    corp_name: str
    report_nm: str
    rcept_dt: date
    raw_url: Optional[str] = None
    summary: Optional[str] = None
    summary_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AiCommentaryOut(BaseModel):
    id: int
    stock_id: int
    date: date
    commentary: str
    model_used: Optional[str] = None
    generated_at: datetime

    model_config = {"from_attributes": True}


class CoinAiCommentaryOut(BaseModel):
    id: int
    coin_id: int
    date: date
    commentary: str
    model_used: Optional[str] = None
    generated_at: datetime

    model_config = {"from_attributes": True}
