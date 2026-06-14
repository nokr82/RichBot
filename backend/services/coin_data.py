import asyncio
import logging
from datetime import datetime
from typing import Any

import httpx
import pandas as pd

logger = logging.getLogger(__name__)

UPBIT_BASE = "https://api.upbit.com/v1"

_coin_cache: list[dict] = []
_cache_built_at: datetime | None = None
_CACHE_TTL_SECONDS = 3600


async def get_all_coins() -> list[dict]:
    """Return KRW-market coins from Upbit with 1-hour in-memory cache."""
    global _coin_cache, _cache_built_at
    now = datetime.utcnow()
    if _cache_built_at and (now - _cache_built_at).total_seconds() < _CACHE_TTL_SECONDS and _coin_cache:
        return _coin_cache

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{UPBIT_BASE}/market/all", params={"isDetails": "false"})
            resp.raise_for_status()
            data = resp.json()
        _coin_cache = [
            {"ticker": m["market"], "name": m["korean_name"]}
            for m in data
            if m["market"].startswith("KRW-")
        ]
        _cache_built_at = now
        logger.info("Upbit 코인 캐시 갱신: %d개", len(_coin_cache))
    except Exception as exc:
        logger.warning("Upbit 코인 목록 조회 실패: %s", exc)

    return _coin_cache


def search_coins(query: str, page: int = 1, size: int = 50) -> dict:
    q = query.strip().lower()
    filtered = [
        c for c in _coin_cache
        if not q or q in c["name"].lower() or q in c["ticker"].lower()
    ]
    total = len(filtered)
    start = (page - 1) * size
    items = filtered[start: start + size]
    return {"total": total, "page": page, "size": size, "items": items}


async def fetch_coin_ohlcv(ticker: str, days: int = 400) -> pd.DataFrame:
    """Fetch daily OHLCV from Upbit. Returns DataFrame indexed by date."""
    rows: list[dict] = []
    count = min(days, 200)
    cursor: str | None = None
    fetched = 0

    async with httpx.AsyncClient(timeout=10) as client:
        while fetched < days:
            params: dict[str, Any] = {"market": ticker, "count": count}
            if cursor:
                params["to"] = cursor
            try:
                resp = await client.get(f"{UPBIT_BASE}/candles/days", params=params)
                resp.raise_for_status()
                data: list[dict] = resp.json()
            except Exception as exc:
                logger.warning("Upbit OHLCV 오류 %s: %s", ticker, exc)
                break
            if not data:
                break
            rows.extend(data)
            fetched += len(data)
            cursor = data[-1]["candle_date_time_utc"]
            if len(data) < count:
                break
            await asyncio.sleep(0.12)  # Upbit: 10 req/sec limit

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["candle_date_time_kst"].str[:10])
    df = df.rename(columns={
        "opening_price":             "open",
        "high_price":                "high",
        "low_price":                 "low",
        "trade_price":               "close",
        "candle_acc_trade_volume":   "volume",
    })
    df = df[["date", "open", "high", "low", "close", "volume"]].set_index("date").sort_index()
    return df


async def fetch_coin_chart(ticker: str, interval: str = "day") -> pd.DataFrame:
    """Fetch OHLCV for chart: day / 60m / week / month."""
    interval_map: dict[str, tuple[str, dict[str, Any]]] = {
        "day":   ("candles/days",       {"market": ticker, "count": 200}),
        "60m":   ("candles/minutes/60", {"market": ticker, "count": 200}),
        "week":  ("candles/weeks",      {"market": ticker, "count": 100}),
        "month": ("candles/months",     {"market": ticker, "count": 60}),
    }
    path, params = interval_map.get(interval, interval_map["day"])

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(f"{UPBIT_BASE}/{path}", params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning("Upbit chart 오류 %s %s: %s", ticker, interval, exc)
            return pd.DataFrame()

    if not data:
        return pd.DataFrame()

    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["candle_date_time_kst"].str[:16])
    df = df.rename(columns={
        "opening_price":           "open",
        "high_price":              "high",
        "low_price":               "low",
        "trade_price":             "close",
        "candle_acc_trade_volume": "volume",
    })
    df = df[["date", "open", "high", "low", "close", "volume"]].set_index("date").sort_index()
    return df
