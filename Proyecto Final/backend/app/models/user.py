import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, Text,
    Enum, DateTime, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    jugador = "jugador"
    admin_juego = "admin_juego"
    moderador = "moderador"


class AccountStatus(str, enum.Enum):
    activo = "activo"
    suspendido = "suspendido"


class MFAMethod(str, enum.Enum):
    totp = "totp"
    oauth2 = "oauth2"


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    username         = Column(String(50), unique=True, nullable=False, index=True)
    email            = Column(String(255), unique=True, nullable=False, index=True)
    password_hash    = Column(String(255), nullable=False)          # bcrypt only
    role             = Column(Enum(UserRole), nullable=False, default=UserRole.jugador)
    status           = Column(Enum(AccountStatus), nullable=False, default=AccountStatus.activo)
    token_balance    = Column(Integer, nullable=False, default=0)
    mfa_enabled      = Column(Boolean, nullable=False, default=False)
    mfa_method       = Column(Enum(MFAMethod), nullable=True)
    mfa_secret_enc   = Column(Text, nullable=True)                  # Fernet-encrypted
    mfa_temp_secret  = Column(Text, nullable=True)                  # temp during setup
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    scores           = relationship("Score", back_populates="user", cascade="all, delete-orphan")
    payment_cards    = relationship("PaymentCard", back_populates="user", cascade="all, delete-orphan")
    token_transactions = relationship("TokenTransaction", back_populates="user", cascade="all, delete-orphan")
    player_items     = relationship("PlayerItem", back_populates="user", cascade="all, delete-orphan")
    token_spends     = relationship("TokenSpend", back_populates="user", cascade="all, delete-orphan")
    audit_logs       = relationship("AuditLog", back_populates="user")
    mfa_attempts     = relationship("MfaAttempt", back_populates="user", cascade="all, delete-orphan")
