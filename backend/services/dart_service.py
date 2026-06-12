import httpx
import logging
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from models.stock import Stock
from models.disclosure import Disclosure
from config import settings

logger = logging.getLogger(__name__)
DART_BASE = "https://opendart.fss.or.kr/api"


async def fetch_watchlist_disclosures(db: AsyncSession):
    """Fetch last 7 days of disclosures for all watchlist stocks."""
    if not settings.dart_api_key:
        logger.warning("DART API key not configured, skipping disclosure fetch")
        return

    stocks_res = await db.execute(select(Stock).where(Stock.is_active == True))
    stocks = stocks_res.scalars().all()

    end_date = date.today()
    start_date = end_date - timedelta(days=7)

    async with httpx.AsyncClient(timeout=30) as client:
        for stock in stocks:
            try:
                corp_code = await _get_corp_code(client, stock.ticker)
                if not corp_code:
                    continue

                resp = await client.get(f"{DART_BASE}/list.json", params={
                    "crtfc_key": settings.dart_api_key,
                    "corp_code": corp_code,
                    "bgn_de": start_date.strftime("%Y%m%d"),
                    "end_de": end_date.strftime("%Y%m%d"),
                    "pblntf_ty": "A",  # 정기공시
                    "page_count": 10,
                })
                if resp.status_code != 200:
                    continue

                data = resp.json()
                if data.get("status") != "000":
                    continue

                for item in data.get("list", []):
                    rcept_dt = _parse_date(item.get("rcept_dt", ""))
                    if not rcept_dt:
                        continue
                    stmt = sqlite_insert(Disclosure).values(
                        stock_id=stock.id,
                        dart_rcept_no=item["rcept_no"],
                        corp_name=item.get("corp_name", stock.name),
                        report_nm=item.get("report_nm", ""),
                        rcept_dt=rcept_dt,
                        raw_url=f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={item['rcept_no']}",
                    ).on_conflict_do_nothing(index_elements=["dart_rcept_no"])
                    await db.execute(stmt)

            except Exception as exc:
                logger.error("DART fetch error for %s: %s", stock.ticker, exc)

    await db.commit()


async def _get_corp_code(client: httpx.AsyncClient, ticker: str) -> str | None:
    """Get DART corp_code from stock ticker using DART corp search API."""
    try:
        resp = await client.get(f"{DART_BASE}/company.json", params={
            "crtfc_key": settings.dart_api_key,
            "stock_code": ticker,
        })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "000":
                return data.get("corp_code")
    except Exception:
        pass
    return None


def _parse_date(s: str) -> date | None:
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except (ValueError, IndexError):
        return None
