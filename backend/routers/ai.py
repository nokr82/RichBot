from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from database import get_db
from models.stock import Stock
from models.disclosure import AiCommentary
from schemas.disclosure import AiCommentaryOut

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/commentary/{ticker}", response_model=AiCommentaryOut | None)
async def get_commentary(ticker: str, target_date: str | None = None, db: AsyncSession = Depends(get_db)):
    stock = await _get_stock(ticker, db)
    d = date.fromisoformat(target_date) if target_date else date.today()
    result = await db.execute(
        select(AiCommentary).where(AiCommentary.stock_id == stock.id, AiCommentary.date == d)
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    return AiCommentaryOut.model_validate(row)


@router.post("/commentary/{ticker}/generate", response_model=AiCommentaryOut)
async def generate_commentary(ticker: str, target_date: str | None = None, db: AsyncSession = Depends(get_db)):
    stock = await _get_stock(ticker, db)
    d = date.fromisoformat(target_date) if target_date else date.today()

    from services.ai_service import generate_stock_commentary
    commentary, model_used = await generate_stock_commentary(stock, d, db)

    from datetime import datetime
    result = await db.execute(
        select(AiCommentary).where(AiCommentary.stock_id == stock.id, AiCommentary.date == d)
    )
    row = result.scalar_one_or_none()
    if row:
        row.commentary = commentary
        row.model_used = model_used
        row.generated_at = datetime.utcnow()
    else:
        row = AiCommentary(stock_id=stock.id, date=d, commentary=commentary, model_used=model_used)
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return AiCommentaryOut.model_validate(row)


async def _get_stock(ticker: str, db: AsyncSession) -> Stock:
    result = await db.execute(select(Stock).where(Stock.ticker == ticker, Stock.is_active == True))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock
