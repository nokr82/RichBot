from dataclasses import dataclass
from datetime import date

import pandas as pd


@dataclass
class CoinCrossSignal:
    event_type: str   # e.g. "GOLDEN_7_25"
    short_ma: str     # e.g. "MA7"
    long_ma: str      # e.g. "MA25"
    short_val: float
    long_val: float
    occurred_date: date


_ALL_PAIRS = [
    ("MA7",  "MA25",  "ma7",  "ma25"),
    ("MA7",  "MA99",  "ma7",  "ma99"),
    ("MA25", "MA99",  "ma25", "ma99"),
    ("MA50", "MA200", "ma50", "ma200"),
]


def compute_coin_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add MA7/20/25/50/99/200 and volume_ratio columns to OHLCV DataFrame."""
    df = df.sort_index().copy()
    df["ma7"]   = df["close"].rolling(window=7,   min_periods=7).mean()
    df["ma20"]  = df["close"].rolling(window=20,  min_periods=20).mean()
    df["ma25"]  = df["close"].rolling(window=25,  min_periods=25).mean()
    df["ma50"]  = df["close"].rolling(window=50,  min_periods=50).mean()
    df["ma99"]  = df["close"].rolling(window=99,  min_periods=99).mean()
    df["ma200"] = df["close"].rolling(window=200, min_periods=200).mean()
    df["vol_avg20"]    = df["volume"].rolling(window=20, min_periods=20).mean()
    df["volume_ratio"] = df["volume"] / df["vol_avg20"]
    return df


def detect_coin_crosses(
    df: pd.DataFrame,
    enabled_pairs: list[str] | None = None,
    lookback: int = 30,
) -> list[CoinCrossSignal]:
    """Return cross events from the last `lookback` rows (sliding window).

    Using 30 days instead of 2 rows so manual scans find recent crosses
    even when no cross happened on the very latest candle.
    Duplicate prevention is handled by the caller via DB unique checks.
    """
    if len(df) < 2:
        return []

    active = (
        set(enabled_pairs)
        if enabled_pairs
        else {f"{s[2:]}_{l[2:]}" for s, l, _, _ in _ALL_PAIRS}
    )
    window = df.tail(lookback)
    events: list[CoinCrossSignal] = []
    seen: set[tuple] = set()

    for i in range(1, len(window)):
        prev = window.iloc[i - 1]
        curr = window.iloc[i]

        for short_label, long_label, short_col, long_col in _ALL_PAIRS:
            pair_key = f"{short_label[2:]}_{long_label[2:]}"
            if pair_key not in active:
                continue

            prev_s = prev.get(short_col)
            prev_l = prev.get(long_col)
            curr_s = curr.get(short_col)
            curr_l = curr.get(long_col)

            if any(pd.isna(v) for v in [prev_s, prev_l, curr_s, curr_l]):
                continue

            event_date = curr.name.date() if hasattr(curr.name, "date") else curr.name

            if prev_s <= prev_l and curr_s > curr_l:
                key = (f"GOLDEN_{pair_key}", event_date)
                if key not in seen:
                    seen.add(key)
                    events.append(CoinCrossSignal(
                        event_type=f"GOLDEN_{pair_key}",
                        short_ma=short_label, long_ma=long_label,
                        short_val=float(curr_s), long_val=float(curr_l),
                        occurred_date=event_date,
                    ))
            elif prev_s >= prev_l and curr_s < curr_l:
                key = (f"DEAD_{pair_key}", event_date)
                if key not in seen:
                    seen.add(key)
                    events.append(CoinCrossSignal(
                        event_type=f"DEAD_{pair_key}",
                        short_ma=short_label, long_ma=long_label,
                        short_val=float(curr_s), long_val=float(curr_l),
                        occurred_date=event_date,
                    ))

    return events


def detect_coin_volume_spike(df: pd.DataFrame, threshold: float = 2.0) -> bool:
    if len(df) < 20:
        return False
    curr = df.iloc[-1]
    if pd.isna(curr.get("vol_avg20")):
        return False
    return bool(curr.get("volume_ratio", 0) >= threshold)
