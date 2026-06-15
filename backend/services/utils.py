def safe_float(val) -> float | None:
    """NaN-safe float conversion. Returns None for NaN or non-numeric values."""
    try:
        f = float(val)
        return None if f != f else f
    except (TypeError, ValueError):
        return None
