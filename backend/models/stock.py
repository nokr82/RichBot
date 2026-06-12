from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Float, UniqueConstraint, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False)
    market = Column(String, nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    price_snapshots = relationship("PriceSnapshot", back_populates="stock", cascade="all, delete-orphan")
    alert_setting = relationship("AlertSetting", back_populates="stock", uselist=False, cascade="all, delete-orphan")
    cross_events = relationship("CrossEvent", back_populates="stock", cascade="all, delete-orphan")
    volume_spike_events = relationship("VolumeSpikeEvent", back_populates="stock", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="stock", cascade="all, delete-orphan")
    disclosures = relationship("Disclosure", back_populates="stock")
    ai_commentaries = relationship("AiCommentary", back_populates="stock", cascade="all, delete-orphan")


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    date = Column(Date, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float, nullable=False)
    volume = Column(Integer, nullable=False)
    ma20 = Column(Float)
    ma50 = Column(Float)
    ma60 = Column(Float)
    ma120 = Column(Float)
    ma200 = Column(Float)
    ma240 = Column(Float)
    volume_ratio = Column(Float)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    stock = relationship("Stock", back_populates="price_snapshots")

    __table_args__ = (UniqueConstraint("stock_id", "date", name="uq_stock_date"),)
