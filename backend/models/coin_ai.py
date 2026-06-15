from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class CoinAiCommentary(Base):
    __tablename__ = "coin_ai_commentaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    coin_id = Column(Integer, ForeignKey("coins.id"), nullable=False)
    date = Column(Date, nullable=False)
    commentary = Column(Text, nullable=False)
    model_used = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)

    coin = relationship("Coin", back_populates="ai_commentaries")

    __table_args__ = (UniqueConstraint("coin_id", "date", name="uq_coin_ai_date"),)
