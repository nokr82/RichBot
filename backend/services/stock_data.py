import json
import logging
import threading
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import requests
import FinanceDataReader as fdr

logger = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).parent.parent / "data"
_cache_lock = threading.Lock()
_memory_cache: list[dict] | None = None

_MARKET_ID_MAP = {"STK": "KOSPI", "KSQ": "KOSDAQ", "KNX": "KONEX"}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_all_tickers() -> list[dict]:
    """캐시에서 전체 종목 목록 반환. {ticker, name, market} 형태."""
    return _get_cache() or []


def search_stocks(query: str, page: int = 1, size: int = 50) -> dict:
    all_stocks = _get_cache()
    if not all_stocks:
        return {"items": [], "total": 0, "building": True}

    q = query.strip().lower()
    matched = (
        [s for s in all_stocks if q in s["name"].lower() or q in s["ticker"]]
        if q else all_stocks
    )
    total = len(matched)
    start = (page - 1) * size
    return {"items": matched[start: start + size], "total": total, "building": False}


def fetch_ohlcv(ticker: str, days: int = 90) -> pd.DataFrame:
    end = datetime.now()
    start = end - timedelta(days=days)
    try:
        df = fdr.DataReader(ticker, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        if df is None or df.empty:
            return pd.DataFrame()
        df = df.rename(columns={"Open": "open", "High": "high", "Low": "low",
                                 "Close": "close", "Volume": "volume"})
        df.index.name = "date"
        df.index = pd.to_datetime(df.index)
        return df[["open", "high", "low", "close", "volume"]].sort_index()
    except Exception as e:
        logger.warning("fetch_ohlcv(%s) 실패: %s", ticker, e)
        return pd.DataFrame()


def fetch_ohlcv_interval(ticker: str, interval: str = "day") -> pd.DataFrame:
    """interval: '15m' | 'day' | 'week' | 'month' | 'year'"""
    if interval == "15m":
        return _fetch_intraday_15m(ticker)

    days_map = {"day": 400, "week": 730, "month": 1825, "year": 7300}
    df = fetch_ohlcv(ticker, days_map.get(interval, 120))
    if df.empty:
        return df

    resample_map = {"week": "W-FRI", "month": "ME", "year": "YE"}
    rule = resample_map.get(interval)
    if rule:
        df = _resample_ohlcv(df, rule)

    return df


def _resample_ohlcv(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    return df.resample(rule).agg(
        open=("open", "first"),
        high=("high", "max"),
        low=("low", "min"),
        close=("close", "last"),
        volume=("volume", "sum"),
    ).dropna(subset=["close"])


def _fetch_intraday_15m(ticker: str) -> pd.DataFrame:
    """Naver Finance 1분봉 -> 15분봉 리샘플링."""
    try:
        url = (
            "https://fchart.stock.naver.com/sise.nhn"
            f"?symbol={ticker}&timeframe=minute&count=500&requestType=0"
        )
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Referer": "https://finance.naver.com/",
        }
        resp = requests.get(url, timeout=15, headers=headers)
        resp.raise_for_status()

        try:
            content = resp.content.decode("euc-kr")
        except UnicodeDecodeError:
            content = resp.text

        root = ET.fromstring(content.encode("utf-8"))
        candles = root.findall(".//candle")
        if not candles:
            return pd.DataFrame()

        today = datetime.now().strftime("%Y%m%d")
        records = []
        for candle in candles:
            time_str = candle.get("time", "")
            if not time_str:
                continue
            try:
                if len(time_str) >= 12:
                    dt = datetime.strptime(time_str[:12], "%Y%m%d%H%M")
                elif len(time_str) in (4, 6):
                    dt = datetime.strptime(f"{today}{time_str[:4]}", "%Y%m%d%H%M")
                else:
                    continue
                records.append({
                    "date":   dt,
                    "open":   float(candle.get("open",   0) or 0),
                    "high":   float(candle.get("high",   0) or 0),
                    "low":    float(candle.get("low",    0) or 0),
                    "close":  float(candle.get("close",  0) or 0),
                    "volume": int(  candle.get("volume", 0) or 0),
                })
            except (ValueError, TypeError):
                continue

        if not records:
            return pd.DataFrame()

        df = pd.DataFrame(records).set_index("date")
        df.index.name = "date"
        df = df.sort_index()
        df = _resample_ohlcv(df, "15min")
        return df[df["close"] > 0]

    except Exception as e:
        logger.warning("15분봉 조회 실패 (%s): %s", ticker, e)
        return pd.DataFrame()


def get_stock_name(ticker: str) -> str | None:
    cache = _get_cache()
    if cache:
        found = next((s["name"] for s in cache if s["ticker"] == ticker), None)
        if found:
            return found
    try:
        listing = fdr.StockListing("KRX")
        row = listing[listing["Code"] == ticker]
        return row.iloc[0]["Name"] if not row.empty else None
    except Exception:
        return None


def ensure_cache_built():
    threading.Thread(target=_build_cache_if_stale, daemon=True).start()


# ---------------------------------------------------------------------------
# Cache internals
# ---------------------------------------------------------------------------

def _cache_path() -> Path:
    today = datetime.now().strftime("%Y%m%d")
    return _CACHE_DIR / f"tickers_{today}.json"


def _get_cache() -> list[dict] | None:
    global _memory_cache
    if _memory_cache is not None:
        return _memory_cache
    for p in sorted(_CACHE_DIR.glob("tickers_*.json"), reverse=True):
        try:
            file_date = datetime.strptime(p.stem.split("_")[1], "%Y%m%d")
            if (datetime.now() - file_date).days <= 7:
                with _cache_lock:
                    if _memory_cache is None:
                        with open(p, encoding="utf-8") as f:
                            _memory_cache = json.load(f)
                return _memory_cache
        except Exception:
            continue
    return None


def _build_cache_if_stale():
    global _memory_cache

    for p in sorted(_CACHE_DIR.glob("tickers_*.json"), reverse=True):
        try:
            file_date = datetime.strptime(p.stem.split("_")[1], "%Y%m%d")
            if (datetime.now() - file_date).days <= 3:
                with _cache_lock:
                    if _memory_cache is None:
                        with open(p, encoding="utf-8") as f:
                            _memory_cache = json.load(f)
                logger.info("종목 캐시 재사용: %s (%d개)", p.name, len(_memory_cache))
                return
        except Exception:
            continue

    for old in _CACHE_DIR.glob("tickers_*.json"):
        old.unlink(missing_ok=True)

    logger.info("전체 종목 캐시 빌드 시작 (FinanceDataReader)...")
    _CACHE_DIR.mkdir(exist_ok=True)

    try:
        listing = fdr.StockListing("KRX")
        results = []
        for _, row in listing.iterrows():
            market = _MARKET_ID_MAP.get(str(row.get("MarketId", "")), "KRX")
            results.append({
                "ticker": str(row["Code"]),
                "name": str(row["Name"]),
                "market": market,
            })

        with open(_cache_path(), "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False)
        with _cache_lock:
            _memory_cache = results
        logger.info("전체 종목 캐시 완료: %d개", len(results))

    except Exception as e:
        logger.error("종목 캐시 빌드 실패: %s", e)

