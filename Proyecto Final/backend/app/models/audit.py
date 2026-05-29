from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON, func
from sqlalchemy.orm import relationship
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(50), nullable=True)
    ip_address = Column(String(45), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")

class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(255), nullable=False)  # email or IP address
    attempt_at = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String(45), nullable=True)
    username_tried = Column(String(255), nullable=True)

class MfaAttempt(Base):
    __tablename__ = "mfa_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    attempt_at = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String(45), nullable=True)

    user = relationship("User", back_populates="mfa_attempts")
