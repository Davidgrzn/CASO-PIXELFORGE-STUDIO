from sqlalchemy import CheckConstraint, Column, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class Score(Base):
    __tablename__ = "scores"
    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 10000", name="scores_score_check"),
        CheckConstraint("level_completed >= 1", name="scores_level_completed_check"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score           = Column(Integer, nullable=False)
    level_completed = Column(Integer, nullable=False, default=1)
    recorded_at     = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="scores")


class ScoreSubmission(Base):
    """Rate limit tracking for score submissions (max 1 per 60s per user)."""
    __tablename__ = "score_submissions"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
