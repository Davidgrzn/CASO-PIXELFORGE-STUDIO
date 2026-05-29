from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.user import User, UserRole, AccountStatus
from app.models.score import Score
from app.schemas.user import UserResponse
from app.security.jwt_handler import require_role
from app.services.audit_service import log_event

router = APIRouter()

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

@router.get("/players", response_model=List[UserResponse])
def list_players(
    current_user: User = require_role([UserRole.admin_juego, UserRole.moderador]),
    db: Session = Depends(get_db)
):
    """
    Get all registered players.
    - Admin or Moderator only.
    - Does NOT reveal password hashes, secret keys, etc. (handled by response_model schemas)
    """
    players = (
        db.query(User)
        .filter(User.role == UserRole.jugador)
        .order_by(User.created_at.desc())
        .all()
    )
    return players

@router.patch("/players/{player_id}/status", response_model=UserResponse)
def update_player_status(
    player_id: int,
    request: Request,
    current_user: User = require_role([UserRole.admin_juego, UserRole.moderador]),
    db: Session = Depends(get_db)
):
    """
    Toggle player account status between 'activo' and 'suspendido'.
    - Admin or Moderator only.
    """
    ip = get_client_ip(request)
    
    # Fetch player
    player = db.query(User).filter(User.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jugador no encontrado"
        )
        
    # Block admins/moderators changing status of other admins/mods here
    if player.role != UserRole.jugador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se permite cambiar el estado de cuentas del equipo técnico"
        )
        
    # Toggle status
    old_status = player.status.value
    new_status = AccountStatus.suspendido if player.status == AccountStatus.activo else AccountStatus.activo
    player.status = new_status
    db.commit()
    db.refresh(player)
    
    log_event(
        db,
        event_type="player_status_updated",
        user_id=current_user.id,
        username=current_user.username,
        ip_address=ip,
        details={
            "target_player_id": player_id,
            "target_username": player.username,
            "old_status": old_status,
            "new_status": new_status.value
        }
    )
    
    return player

@router.get("/stats")
def get_dashboard_stats(
    current_user: User = require_role([UserRole.admin_juego]), # Admin only, not moderators
    db: Session = Depends(get_db)
):
    """
    General game metrics dashboard (admin_juego only).
    """
    total_players = db.query(User).filter(User.role == UserRole.jugador).count()
    total_scores = db.query(Score).count()
    max_score = db.query(func.max(Score.score)).scalar() or 0
    
    # Count unique active players in last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    active_last_7d = (
        db.query(func.count(func.distinct(Score.user_id)))
        .filter(Score.recorded_at >= seven_days_ago)
        .scalar()
    ) or 0
    
    return {
        "total_players": total_players,
        "total_scores": total_scores,
        "max_score": max_score,
        "active_last_7d": active_last_7d
    }

