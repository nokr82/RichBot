from dataclasses import dataclass
from datetime import date
from enum import Enum

import pandas as pd


class CrossType(str, Enum):
    GOLDEN_20_60  = "GOLDEN_20_60"
    DEAD_20_60    = "DEAD_20_60"
    GOLDEN_20_120 = "GOLDEN_20_120"
    DEAD_20_120   = "DEAD_20_120"
    GOLDEN_50_200 = "GOLDEN_50_200"
    DEAD_50_200   = "DEAD_50_200"
    GOLDEN_60_240 = "GOLDEN_60_240"
    DEAD_60_240   = "DEAD_60_240"


@dataclass
class CrossEvent:
    type: CrossType
    short_ma: str
    long_ma: str
    short_val: float
    long_val: float
    occurred_date: date


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add MA20/50/60/120/200/240 and volume ratio columns to an OHLCV DataFrame."""
    df = df.sort_index().copy()
    df["ma20"]  = df["close"].rolling(window=20,  min_periods=20).mean()
    df["ma50"]  = df["close"].rolling(window=50,  min_periods=50).mean()
    df["ma60"]  = df["close"].rolling(window=60,  min_periods=60).mean()
    df["ma120"] = df["close"].rolling(window=120, min_periods=120).mean()
    df["ma200"] = df["close"].rolling(window=200, min_periods=200).mean()
    df["ma240"] = df["close"].rolling(window=240, min_periods=240).mean()
    df["vol_avg20"]    = df["volume"].rolling(window=20, min_periods=20).mean()
    df["volume_ratio"] = df["volume"] / df["vol_avg20"]
    return df


def detect_crosses(df: pd.DataFrame) -> list[CrossEvent]:
    """Return cross events detected from the last two rows."""
    if len(df) < 2:
        return []

    prev = df.iloc[-2]
    curr = df.iloc[-1]
    events: list[CrossEvent] = []

    ma_pairs = [
        ("MA20", "MA60",  "ma20", "ma60"),
        ("MA20", "MA120", "ma20", "ma120"),
        ("MA50", "MA200", "ma50", "ma200"),
        ("MA60", "MA240", "ma60", "ma240"),
    ]

    for short_label, long_label, short_col, long_col in ma_pairs:
        prev_s = prev.get(short_col)
        prev_l = prev.get(long_col)
        curr_s = curr.get(short_col)
        curr_l = curr.get(long_col)

        if any(pd.isna(v) for v in [prev_s, prev_l, curr_s, curr_l]):
            continue

        event_date = curr.name.date() if hasattr(curr.name, "date") else curr.name
        # extract e.g. "20", "60" from "MA20", "MA60"
        s_num = short_label[2:]
        l_num = long_label[2:]

        if prev_s <= prev_l and curr_s > curr_l:
            events.append(CrossEvent(
                type=CrossType[f"GOLDEN_{s_num}_{l_num}"],
                short_ma=short_label, long_ma=long_label,
                short_val=float(curr_s), long_val=float(curr_l),
                occurred_date=event_date,
            ))
        elif prev_s >= prev_l and curr_s < curr_l:
            events.append(CrossEvent(
                type=CrossType[f"DEAD_{s_num}_{l_num}"],
                short_ma=short_label, long_ma=long_label,
                short_val=float(curr_s), long_val=float(curr_l),
                occurred_date=event_date,
            ))

    return events


def detect_volume_spike(df: pd.DataFrame, threshold: float = 2.0) -> bool:
    if len(df) < 20:
        return False
    curr = df.iloc[-1]
    if pd.isna(curr.get("vol_avg20")):
        return False
    ratio = curr.get("volume_ratio", 0)
    return bool(ratio >= threshold)
