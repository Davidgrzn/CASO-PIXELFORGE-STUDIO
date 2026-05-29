from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from typing import Optional, Any, Dict
import logging
import json
import os

logger = logging.getLogger("audit")
AUDIT_LOG_PATH = os.getenv("AUDIT_LOG_PATH", "/app/logs/security-audit.log")

def _append_security_log(
    event_type: str,
    user_id: Optional[int],
    username: Optional[str],
    ip_address: Optional[str],
    details: Optional[Dict[str, Any]]
) -> None:
    os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)
    payload = {
        "event_type": event_type,
        "user_id": user_id,
        "username": username,
        "ip_address": ip_address,
        "details": details or {}
    }
    with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as log_file:
        log_file.write(f"AUDIT_EVENT {json.dumps(payload, ensure_ascii=False)}\n")

def log_event(
    db: Session,
    event_type: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Log security-relevant events to the audit_logs table.
    This generates structured, queryable logs compatible with wazuh ingestion.
    """
    try:
        log_entry = AuditLog(
            event_type=event_type,
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            details=details or {}
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        
        # Log to standard output/logs as well so a SIEM wazuh agent can monitor container stdout
        logger.info(
            f"AUDIT_EVENT: type={event_type} user_id={user_id} username={username} ip={ip_address} details={details}"
        )
        _append_security_log(event_type, user_id, username, ip_address, details)
        return log_entry
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to write audit log: {e}")
        # Return a transient AuditLog object in case calling code expects one
        return AuditLog(event_type=event_type, details={"error": str(e)})
