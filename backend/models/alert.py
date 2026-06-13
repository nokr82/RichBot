from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base

DEFAULT_PAIRS = ["20_60", "20_120", "50_200", "60_240"]


class CrossEvent(Base):
    __tablename__ = "cross_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    event_type = Column(String, nullable=False)
    short_ma = Column(String, nullable=False)
    long_ma = Column(String, nullable=False)
    short_val = Column(Float, nullable=False)
    long_val = Column(Float, nullable=False)
    occurred_at = Column(DateTime, nullable=False)
    notified = Column(Boolean, default=False)

    stock = relationship("Stock", back_populates="cross_events")


class VolumeSpikeEvent(Base):
    __tablename__ = "volume_spike_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    date = Column(Date, nullable=False)
    current_volume = Column(Integer)
    avg_volume_20 = Column(Integer)
    ratio = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    notified = Column(Boolean, default=False)
    occurred_at = Column(DateTime, default=datetime.utcnow)

    stock = relationship("Stock", back_populates="volume_spike_events")


class AlertSetting(Base):
    __tablename__ = "alert_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, unique=True)
    enabled_pairs = Column(JSON, default=lambda: list(DEFAULT_PAIRS))
    volume_spike = Column(Boolean, default=True)
    volume_threshold = Column(Float, default=2.0)
    push_notify = Column(Boolean, default=True)

    stock = relationship("Stock", back_populates="alert_setting")


class GlobalAlertSetting(Base):
    """단일 행(id=1) 전역 알림 설정."""
    __tablename__ = "global_alert_settings"

    id = Column(Integer, primary_key=True, default=1)
    scan_all_stocks = Column(Boolean, default=False)
    enabled_pairs = Column(JSON, default=lambda: ["20_60"])
    volume_spike = Column(Boolean, default=False)
    volume_threshold = Column(Float, default=3.0)