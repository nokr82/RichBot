from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Float, UniqueConstraint, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base

COIN_DEFAULT_PAIRS = ["7_25", "7_99", "25_99", "50_200"]


class Coin(Base):
    __tablename__ = "coins"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, nullable=False, unique=True)  # e.g. KRW-BTC
    name = Column(String, nullable=False)                 # e.g. 비트코인
    is_active = Column(Boolean, default=True)
    added_at = Column(DateTime, default=datetime.utcnow)

    price_snapshots = relationship("CoinPriceSnapshot", back_populates="coin", cascade="all, delete-orphan")
    alert_setting = relationship("CoinAlertSetting", back_populates="coin", uselist=False, cascade="all, delete-orphan")
    cross_events = relationship("CoinCrossEvent", back_populates="coin", cascade="all, delete-orphan")
    volume_spike_events = relationship("CoinVolumeSpikeEvent", back_populates="coin", cascade="all, delete-orphan")
    ai_commentaries = relationship("CoinAiCommentary", back_populates="coin", cascade="all, delete-orphan")


class CoinPriceSnapshot(Base):
    __tablename__ = "coin_price_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False)
    date = Column(Date, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    ma7 = Column(Float)
    ma20 = Column(Float)
    ma25 = Column(Float)
    ma50 = Column(Float)
    ma99 = Column(Float)
    ma200 = Column(Float)
    volume_ratio = Column(Float)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    coin = relationship("Coin", back_populates="price_snapshots")

    __table_args__ = (UniqueConstraint("coin_id", "date", name="uq_coin_date"),)


class CoinCrossEvent(Base):
    __tablename__ = "coin_cross_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False)
    event_type = Column(String, nullable=False)
    short_ma = Column(String, nullable=False)
    long_ma = Column(String, nullable=False)
    short_val = Column(Float, nullable=False)
    long_val = Column(Float, nullable=False)
    occurred_at = Column(DateTime, nullable=False)
    notified = Column(Boolean, default=False)

    coin = relationship("Coin", back_populates="cross_events")


class CoinVolumeSpikeEvent(Base):
    __tablename__ = "coin_volume_spike_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False)
    date = Column(Date, nullable=False)
    current_volume = Column(Float)
    avg_volume_20 = Column(Float)
    ratio = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    notified = Column(Boolean, default=False)
    occurred_at = Column(DateTime, default=datetime.utcnow)

    coin = relationship("Coin", back_populates="volume_spike_events")


class CoinAlertSetting(Base):
    __tablename__ = "coin_alert_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False, unique=True)
    enabled_pairs = Column(JSON, default=lambda: list(COIN_DEFAULT_PAIRS))
    volume_spike = Column(Boolean, default=True)
    volume_threshold = Column(Float, default=2.0)
    push_notify = Column(Boolean, default=True)

    coin = relationship("Coin", back_populates="alert_setting")


class GlobalCoinAlertSetting(Base):
    __tablename__ = "global_coin_alert_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    enabled_pairs = Column(JSON, default=lambda: list(COIN_DEFAULT_PAIRS))
    volume_spike = Column(Boolean, default=True)
    volume_threshold = Column(Float, default=2.0)
