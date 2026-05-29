from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.database import Base

class ShopItem(Base):
    __tablename__ = "shop_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price_tokens = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)  # 'skin', 'trail', 'shield', 'boost'
    image_key = Column(String(100), nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    player_items = relationship("PlayerItem", back_populates="item", cascade="all, delete-orphan")
    token_spends = relationship("TokenSpend", back_populates="item", cascade="all, delete-orphan")

class PlayerItem(Base):
    __tablename__ = "player_items"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_user_item"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("shop_items.id", ondelete="CASCADE"), nullable=False)
    acquired_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="player_items")
    item = relationship("ShopItem", back_populates="player_items")

class TokenSpend(Base):
    __tablename__ = "token_spends"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("shop_items.id", ondelete="CASCADE"), nullable=False)
    tokens_spent = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    spent_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="token_spends")
    item = relationship("ShopItem", back_populates="token_spends")
