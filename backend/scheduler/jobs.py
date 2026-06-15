import asyncio
import logging
from datetime import datetime

from sqlalchemy import select

from database import AsyncSessionLocal
from models.stock import Stock
from models.alert import CrossEvent, VolumeSpikeEvent, GlobalAlertSetting
from models.coin import Coin, CoinCrossEvent, CoinVolumeSpikeEvent, CoinAlertSetting, GlobalCoinAlertSetting
from services.stock_data import fetch_ohlcv, get_all_tickers
from services.indicators import compute_indicators, detect_crosses, detect_volume_spike
from services.coin_data import fetch_coin_ohlcv, get_all_coins
from services.coin_indicators import compute_coin_indicators, detect_coin_crosses, detect_coin_volume_spike
from services.alert_engine import process_new_events
from services.utils import safe_float

logger = logging.getLogger(__name__)

# ── 주식 스케줄 작업 ─────────────────────────────────────────────────────────

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
        enabled_pairs    = gs.enabled_pairs or ["20_60"]
        volume_enabled   = gs.volume_spike
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
                            avg_volume_20=int(curr["vol_avg20"]) if safe_float(curr.get("vol_avg20")) else None,
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


# ── 코인 스케줄 작업 ────────────────────────────────────────────────────────

async def fetch_coin_prices_job():
    """매 시간 정각: 전체 업비트 KRW 코인 크로스/거래량 급증 감지 (주식과 동일 방식)."""
    all_coin_info = await get_all_coins()
    if not all_coin_info:
        logger.warning("업비트 코인 목록 없음 — 캐시 갱신 실패")
        return

    async with AsyncSessionLocal() as db:
        gcs_res = await db.execute(select(GlobalCoinAlertSetting).where(GlobalCoinAlertSetting.id == 1))
        gcs = gcs_res.scalar_one_or_none()
        if not gcs:
            gcs = GlobalCoinAlertSetting(id=1)
            db.add(gcs)
            await db.commit()
            await db.refresh(gcs)
        global_pairs     = gcs.enabled_pairs or ["7_25", "7_99", "25_99", "50_200"]
        global_vol       = gcs.volume_spike
        global_threshold = gcs.volume_threshold

    logger.info("전체코인 스캔 시작: %d개", len(all_coin_info))
    semaphore = asyncio.Semaphore(4)
    tasks = [_scan_coin_ticker(info, global_pairs, global_vol, global_threshold, semaphore) for info in all_coin_info]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    errs = sum(1 for r in results if isinstance(r, Exception))
    if errs:
        logger.warning("코인 스캔 오류 %d건", errs)

    async with AsyncSessionLocal() as db:
        await _process_coin_events(db)


async def _scan_coin_ticker(coin_info: dict, global_pairs: list[str], global_vol: bool, global_threshold: float, semaphore: asyncio.Semaphore):
    """전체 업비트 코인 1개 스캔. 관심목록 코인은 개별 설정 사용, 나머지는 전역 설정."""
    async with semaphore:
        ticker = coin_info["ticker"]
        name   = coin_info.get("name", ticker)
        try:
            df = await fetch_coin_ohlcv(ticker, 400)
            if df.empty:
                return
            df = compute_coin_indicators(df)

            # 관심목록에 있으면 개별 설정 사용, 없으면 기본값
            async with AsyncSessionLocal() as db:
                coin_res = await db.execute(select(Coin).where(Coin.ticker == ticker))
                coin = coin_res.scalar_one_or_none()
                if coin:
                    setting_res = await db.execute(
                        select(CoinAlertSetting).where(CoinAlertSetting.coin_id == coin.id)
                    )
                    s = setting_res.scalar_one_or_none()
                    enabled_pairs    = s.enabled_pairs    if s else global_pairs
                    volume_enabled   = s.volume_spike     if s else global_vol
                    volume_threshold = s.volume_threshold if s else global_threshold
                else:
                    enabled_pairs    = global_pairs
                    volume_enabled   = global_vol
                    volume_threshold = global_threshold

            crosses = detect_coin_crosses(df, enabled_pairs, lookback=30)
            spike   = volume_enabled and detect_coin_volume_spike(df, volume_threshold)

            if not crosses and not spike:
                return

            from datetime import date as _date
            today = _date.today()

            async with AsyncSessionLocal() as db:
                # DB에 없으면 is_active=False 레코드 생성 (주식의 _scan_ticker 패턴과 동일)
                coin_res = await db.execute(select(Coin).where(Coin.ticker == ticker))
                coin = coin_res.scalar_one_or_none()
                if not coin:
                    coin = Coin(ticker=ticker, name=name, is_active=False)
                    db.add(coin)
                    await db.flush()

                for ce in crosses:
                    existing = await db.execute(
                        select(CoinCrossEvent).where(
                            CoinCrossEvent.coin_id == coin.id,
                            CoinCrossEvent.event_type == ce.event_type,
                            CoinCrossEvent.occurred_at >= datetime.combine(
                                ce.occurred_date, datetime.min.time()
                            ),
                        )
                    )
                    if existing.scalar_one_or_none() is None:
                        db.add(CoinCrossEvent(
                            coin_id=coin.id,
                            event_type=ce.event_type,
                            short_ma=ce.short_ma,
                            long_ma=ce.long_ma,
                            short_val=ce.short_val,
                            long_val=ce.long_val,
                            occurred_at=datetime.combine(ce.occurred_date, datetime.now().time()),
                        ))

                if spike:
                    existing_spike = await db.execute(
                        select(CoinVolumeSpikeEvent).where(
                            CoinVolumeSpikeEvent.coin_id == coin.id,
                            CoinVolumeSpikeEvent.date == today,
                        )
                    )
                    if existing_spike.scalar_one_or_none() is None:
                        curr = df.iloc[-1]
                        db.add(CoinVolumeSpikeEvent(
                            coin_id=coin.id,
                            date=today,
                            current_volume=float(curr["volume"]),
                            avg_volume_20=safe_float(curr.get("vol_avg20")),
                            ratio=float(curr["volume_ratio"]),
                            threshold=volume_threshold,
                        ))

                await db.commit()

        except Exception as exc:
            logger.debug("코인 스캔 오류 %s: %s", ticker, exc)
            raise


async def _process_coin_events(db):
    """코인 미알림 이벤트 푸시 발송."""
    from sqlalchemy import update
    from services.push_service import send_push_to_all

    cross_res = await db.execute(
        select(CoinCrossEvent).where(CoinCrossEvent.notified == False)
    )
    for event in cross_res.scalars().all():
        coin_res = await db.execute(select(Coin).where(Coin.id == event.coin_id))
        coin = coin_res.scalar_one_or_none()
        if not coin:
            continue
        direction = "골든크로스" if "GOLDEN" in event.event_type else "데드크로스"
        ma_pair = event.event_type.split("_", 1)[1].replace("_", "/")
        title = f"[코인] {coin.name} {direction} 발생"
        body  = f"MA{ma_pair} 교차 | 단기: {event.short_val:,.0f} 장기: {event.long_val:,.0f}"
        await send_push_to_all(db, title=title, body=body)
        await db.execute(
            update(CoinCrossEvent).where(CoinCrossEvent.id == event.id).values(notified=True)
        )

    vol_res = await db.execute(
        select(CoinVolumeSpikeEvent).where(CoinVolumeSpikeEvent.notified == False)
    )
    for event in vol_res.scalars().all():
        coin_res = await db.execute(select(Coin).where(Coin.id == event.coin_id))
        coin = coin_res.scalar_one_or_none()
        if not coin:
            continue
        title = f"[코인] {coin.name} 거래량 급증"
        body  = f"평균 대비 {event.ratio:.1f}배"
        await send_push_to_all(db, title=title, body=body)
        await db.execute(
            update(CoinVolumeSpikeEvent)
            .where(CoinVolumeSpikeEvent.id == event.id)
            .values(notified=True)
        )

    await db.commit()

