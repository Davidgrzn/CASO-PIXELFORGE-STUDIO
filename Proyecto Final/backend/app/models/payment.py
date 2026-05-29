import enum
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, func
from sqlalchemy.orm import relationship
from app.database import Base


class CardType(str, enum.Enum):
    visa = "visa"
    mastercard = "mastercard"


class TransactionResult(str, enum.Enum):
    aprobada = "aprobada"
    rechazada = "rechazada"


class RejectionReason(str, enum.Enum):
    fondos_insuficientes = "fondos_insuficientes"
    tarjeta_vencida = "tarjeta_vencida"
    otro = "otro"


class PaymentCard(Base):
    """
    Stores ONLY tokenized card data.
    Full card number and CVV are NEVER persisted.
    """
    __tablename__ = "payment_cards"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    card_token   = Column(String(64), unique=True, nullable=False)   # internal UUID token
    last_four    = Column(String(4), nullable=False)                 # last 4 digits only
    card_type    = Column(Enum(CardType), nullable=False)
    expiry_month = Column(String(2), nullable=False)
    expiry_year  = Column(String(4), nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    user         = relationship("User", back_populates="payment_cards")
    transactions = relationship("TokenTransaction", back_populates="card")


class TokenTransaction(Base):
    __tablename__ = "token_transactions"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    card_id          = Column(Integer, ForeignKey("payment_cards.id"), nullable=True)
    package_name     = Column(String(50), nullable=False)
    tokens_amount    = Column(Integer, nullable=False)
    price_cop        = Column(Integer, nullable=False)
    result           = Column(Enum(TransactionResult), nullable=False)
    rejection_reason = Column(Enum(RejectionReason), nullable=True)
    last_four_used   = Column(String(4), nullable=True)   # never full number
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="token_transactions")
    card = relationship("PaymentCard", back_populates="transactions")
