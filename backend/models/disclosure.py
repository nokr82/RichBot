from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class Disclosure(Base):
    __tablename__ = "disclosures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=True)
    dart_rcept_no = Column(String, nullable=False, unique=True)
    corp_name = Column(String, nullable=False)
    report_nm = Column(String, nullable=False)
    rcept_dt = Column(Date, nullable=False)
    raw_url = Column(String)
    summary = Column(Text)
    summary_at = Column(DateTime)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    stock = relationship("Stock", back_populates="disclosures")


class AiCommentary(Base):
    __tablename__ = "ai_commentary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    date = Column(Date, nullable=False)
    commentary = Column(Text, nullable=False)
    model_used = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)

    stock = relationship("Stock", back_populates="ai_commentaries")

    from sqlalchemy import UniqueConstraint
    __table_args__ = (UniqueConstraint("stock_id", "date", name="uq_ai_stock_date"),)
