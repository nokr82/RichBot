import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from database import AsyncSessionLocal
from models.stock import Stock, PriceSnapshot
from models.alert import CrossEvent, VolumeSpikeEvent, AlertSetting, DEFAULT_PAIRS
from services.stock_data import fetch_ohlcv
from services.indicators import compute_indicators, detect_crosses, detect_volume_spike
from services.alert_engine import process_new_events

logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))


def is_market_open() -> bool:
    now = datetime.now(KST)
    if now.weekday() >= 5:
        return False
    market_open  = now.replace(hour=9,  minute=0,  second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=35, second=0, microsecond=0)
    return market_open <= now <= market_close


async def fetch_prices_job():
    """Fetch OHLCV, compute indicators, detect crosses and volume spikes."""
    if not is_market_open():
        return

    async with AsyncSessionLocal() as db:
        stocks_res = await db.execute(select(Stock).where(Stock.is_active == True))
        stocks = stocks_res.scalars().all()

        for stock in stocks:
            try:
                # Need 400 calendar days to have enough bars for MA240
                df = await asyncio.to_thread(fetch_ohlcv, stock.ticker, 400)
                if df.empty:
                    continue
                df = compute_indicators(df)

                # Upsert latest snapshot
                latest = df.iloc[-1]
                stmt = sqlite_insert(PriceSnapshot).values(
                    stock_id=stock.id,
                    date=latest.name.date(),
                    open=_sf(latest.get("open")),
                    high=_sf(latest.get("high")),
                    low=_sf(latest.get("low")),
                    close=float(latest["close"]),
                    volume=int(latest["volume"]),
                    ma20=_sf(latest.get("ma20")),
                    ma50=_sf(latest.get("ma50")),
                    ma60=_sf(latest.get("ma60")),
                    ma120=_sf(latest.get("ma120")),
                    ma200=_sf(latest.get("ma200")),
                    ma240=_sf(latest.get("ma240")),
                    volume_ratio=_sf(latest.get("volume_ratio")),
                ).on_conflict_do_nothing(index_elements=["stock_id", "date"])
                await db.execute(stmt)

                # Load alert settings to filter which pairs to monitor
                setting_res = await db.execute(
                    select(AlertSetting).where(AlertSetting.stock_id == stock.id)
                )
                setting = setting_res.scalar_one_or_none()
                enabled_pairs = (setting.enabled_pairs or DEFAULT_PAIRS) if setting else DEFAULT_PAIRS

                # Detect cross events, save only enabled pairs
                crosses = detect_crosses(df)
                for ce in crosses:
                    pair_key = ce.type.value.split("_", 1)[1]  # "GOLDEN_20_60" -> "20_60"
                    if pair_key not in enabled_pairs:
                        continue
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

                # Detect volume spike
                threshold = setting.volume_threshold if setting else 2.0
                if setting and setting.volume_spike and detect_volume_spike(df, threshold):
                    from datetime import date
                    today = date.today()
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
                            threshold=threshold,
                        ))

                await db.commit()
                await asyncio.sleep(0.5)

            except Exception as exc:
                logger.error("fetch_prices_job error for %s: %s", stock.ticker, exc)

        await process_new_events(db)


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
