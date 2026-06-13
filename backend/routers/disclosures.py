from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.disclosure import Disclosure, AiCommentary
from models.stock import Stock
from schemas.disclosure import DisclosureOut

router = APIRouter(prefix="/api/disclosures", tags=["disclosures"])


@router.post("/refresh")
async def refresh_disclosures(db: AsyncSession = Depends(get_db)):
    """관심종목 공시를 즉시 수집합니다 (스케줄러 대기 없이)."""
    from services.dart_service import fetch_watchlist_disclosures
    await fetch_watchlist_disclosures(db)
    return {"ok": True}


@router.get("", response_model=list[DisclosureOut])
async def list_disclosures(ticker: str | None = None, days: int = 30, db: AsyncSession = Depends(get_db)):
    from datetime import date, timedelta
    since = date.today() - timedelta(days=days)
    query = select(Disclosure).where(Disclosure.rcept_dt >= since).order_by(Disclosure.rcept_dt.desc())
    if ticker:
        stock_res = await db.execute(select(Stock).where(Stock.ticker == ticker))
        stock = stock_res.scalar_one_or_none()
        if stock:
            query = query.where(Disclosure.stock_id == stock.id)
    result = await db.execute(query.limit(50))
    return [DisclosureOut.model_validate(r) for r in result.scalars().all()]


@router.post("/{rcept_no}/summarize")
async def summarize_disclosure(rcept_no: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Disclosure).where(Disclosure.dart_rcept_no == rcept_no))
    disc = result.scalar_one_or_none()
    if not disc:
        raise HTTPException(status_code=404, detail="Disclosure not found")
    from services.ai_service import summarize_disclosure
    summary = await summarize_disclosure(disc)
    disc.summary = summary
    from datetime import datetime
    disc.summary_at = datetime.utcnow()
    await db.commit()
    return {"summary": summary}
