import asyncio
import logging
from datetime import datetime

from sqlalchemy import select

from database import AsyncSessionLocal
from models.stock import Stock
from models.alert import CrossEvent, VolumeSpikeEvent, GlobalAlertSetting
from services.stock_data import fetch_ohlcv, get_all_tickers
from services.indicators import compute_indicators, detect_crosses, detect_volume_spike
from services.alert_engine import process_new_events

logger = logging.getLogger(__name__)


async def fetch_prices_job():
    """일봉 마감 후 실행: 전체 KRX 종목 크로스/거래량 급증 감지."""
    async with AsyncSessionLocal() as db:
        gs_res = await db.execute(select(GlobalAlertSetting).where(GlobalAlertSetting.id == 1))
        gs = gs_res.scalar_one_or_none()
        if not gs:
            gs = GlobalAlertSetting(id=1)
            db.add(gs)
            await db.commit()
            await db.refresh(gs)
        enabled_pairs   = gs.enabled_pairs or ["20_60"]
        volume_enabled  = gs.volume_spike
        volume_threshold = gs.volume_threshold

    all_tickers = await asyncio.to_thread(get_all_tickers)
    logger.info("전체종목 스캔 시작: %d종목", len(all_tickers))

    semaphore = asyncio.Semaphore(8)
    tasks = [
        _scan_ticker(t, enabled_pairs, volume_enabled, volume_threshold, semaphore)
        for t in all_tickers
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    errs = sum(1 for r in results if isinstance(r, Exception))
    if errs:
        logger.warning("스캔 오류 %d건", errs)

    async with AsyncSessionLocal() as db:
        await process_new_events(db)


async def _scan_ticker(
    ticker_info: dict,
    enabled_pairs: list[str],
    volume_enabled: bool,
    volume_threshold: float,
    semaphore: asyncio.Semaphore,
):
    async with semaphore:
        ticker = ticker_info["ticker"]
        try:
            df = await asyncio.to_thread(fetch_ohlcv, ticker, 400)
            if df.empty:
                return
            df = compute_indicators(df)

            crosses = [ce for ce in detect_crosses(df)
                       if ce.type.value.split("_", 1)[1] in enabled_pairs]
            spike   = volume_enabled and detect_volume_spike(df, volume_threshold)

            if not crosses and not spike:
                return

            async with AsyncSessionLocal() as db:
                stock_res = await db.execute(select(Stock).where(Stock.ticker == ticker))
                stock = stock_res.scalar_one_or_none()
                if not stock:
                    _MARKET_MAP = {"STK": "KOSPI", "KSQ": "KOSDAQ", "KNX": "KONEX"}
                    raw_market = ticker_info.get("market", "")
                    stock = Stock(
                        ticker=ticker,
                        name=ticker_info.get("name", ticker),
                        market=_MARKET_MAP.get(raw_market, raw_market),
                        is_active=False,
                    )
                    db.add(stock)
                    await db.flush()

                from datetime import date as _date
                today = _date.today()

                for ce in crosses:
                    existing = await db.execute(
                        select(CrossEvent).where(
                            CrossEvent.stock_id == stock.id,
                            CrossEvent.event_type == ce.type.value,
                            CrossEvent.occurred_at >= datetime.combine(ce.occurred_date, datetime.min.time()),
                        )
                    )
                    if existing.scalar_one_or_none() is None:
                        db.add(CrossEvent(
                            stock_id=stock.id,
                            event_type=ce.type.value,
                            short_ma=ce.short_ma,
                            long_ma=ce.long_ma,
                            short_val=ce.short_val,
                            long_val=ce.long_val,
                            occurred_at=datetime.combine(ce.occurred_date, datetime.now().time()),
                        ))

                if spike:
                    existing_spike = await db.execute(
                        select(VolumeSpikeEvent).where(
                            VolumeSpikeEvent.stock_id == stock.id,
                            VolumeSpikeEvent.date == today,
                        )
                    )
                    if existing_spike.scalar_one_or_none() is None:
                        curr = df.iloc[-1]
                        db.add(VolumeSpikeEvent(
                            stock_id=stock.id,
                            date=today,
                            current_volume=int(curr["volume"]),
                            avg_volume_20=int(curr["vol_avg20"]) if _sf(curr.get("vol_avg20")) else None,
                            ratio=float(curr["volume_ratio"]),
                            threshold=volume_threshold,
                        ))

                await db.commit()

        except Exception as exc:
            logger.debug("스캔 오류 %s: %s", ticker, exc)
            raise


async def fetch_disclosures_job():
    async with AsyncSessionLocal() as db:
        from services.dart_service import fetch_watchlist_disclosures
        await fetch_watchlist_disclosures(db)


def _sf(val) -> float | None:
    try:
        f = float(val)
        return None if f != f else f
    except (TypeError, ValueError):
        return None