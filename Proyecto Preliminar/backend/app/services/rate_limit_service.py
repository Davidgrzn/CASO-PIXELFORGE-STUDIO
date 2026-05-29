from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.models.audit import LoginAttempt, MfaAttempt
from app.models.score import ScoreSubmission
from app.config import get_settings

settings = get_settings()

def check_login_lockout(db: Session, identifier: str) -> bool:
    """
    Checks if there are 5 consecutive failed login attempts in the last 10 minutes.
    If so, returns True (locked out), else False.
    An identifier can be the email address or the IP address.
    """
    ten_minutes_ago = datetime.utcnow() - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
    
    # Get last 5 attempts for this identifier
    attempts = (
        db.query(LoginAttempt)
        .filter(
            and_(
                LoginAttempt.identifier == identifier,
                LoginAttempt.attempt_at >= ten_minutes_ago
            )
        )
        .order_by(desc(LoginAttempt.attempt_at))
        .limit(settings.MAX_LOGIN_ATTEMPTS)
        .all()
    )
    
    # If we have at least 5 attempts and ALL of them are failed, lock out
    if len(attempts) >= settings.MAX_LOGIN_ATTEMPTS:
        if all(not att.success for att in attempts):
            return True
            
    return False

def record_login_attempt(
    db: Session,
    identifier: str,
    success: bool,
    ip_address: str,
    username_tried: str
) -> LoginAttempt:
    """Record a login attempt in the db."""
    try:
        attempt = LoginAttempt(
            identifier=identifier,
            success=success,
            ip_address=ip_address,
            username_tried=username_tried
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt
    except Exception:
        db.rollback()
        raise

def check_mfa_lockout(db: Session, user_id: int) -> bool:
    """
    Checks if there are 5 consecutive failed MFA attempts in the last 5 minutes.
    If so, returns True (locked out), else False.
    """
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=settings.MFA_LOCKOUT_MINUTES)
    
    attempts = (
        db.query(MfaAttempt)
        .filter(
            and_(
                MfaAttempt.user_id == user_id,
                MfaAttempt.attempt_at >= five_minutes_ago
            )
        )
        .order_by(desc(MfaAttempt.attempt_at))
        .limit(settings.MAX_MFA_ATTEMPTS)
        .all()
    )
    
    if len(attempts) >= settings.MAX_MFA_ATTEMPTS:
        if all(not att.success for att in attempts):
            return True
            
    return False

def record_mfa_attempt(
    db: Session,
    user_id: int,
    success: bool,
    ip_address: str
) -> MfaAttempt:
    """Record an MFA attempt in the db."""
    try:
        attempt = MfaAttempt(
            user_id=user_id,
            success=success,
            ip_address=ip_address
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt
    except Exception:
        db.rollback()
        raise

def check_score_rate_limit(db: Session, user_id: int) -> bool:
    """
    Check if the user has submitted a score in the last 60 seconds.
    Returns True if rate limited (cannot submit), False otherwise.
    """
    one_minute_ago = datetime.utcnow() - timedelta(seconds=settings.SCORE_RATE_LIMIT_SECONDS)
    
    recent_sub = (
        db.query(ScoreSubmission)
        .filter(
            and_(
                ScoreSubmission.user_id == user_id,
                ScoreSubmission.submitted_at >= one_minute_ago
            )
        )
        .first()
    )
    
    return recent_sub is not None

def record_score_submission(db: Session, user_id: int) -> ScoreSubmission:
    """Record a score submission timestamp to enforce rate limiting."""
    try:
        sub = ScoreSubmission(user_id=user_id)
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub
    except Exception:
        db.rollback()
        raise
