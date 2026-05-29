from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date, datetime, timedelta
import io

from app.database import get_db
from app.config import get_settings
from app.models.user import User, UserRole, AccountStatus
from app.models.score import Score
from app.models.payment import TokenTransaction
from app.models.shop import PlayerItem
from app.security.jwt_handler import require_role
from app.services.pdf_service import generate_player_report_pdf, generate_global_stats_pdf, generate_player_data_pdf
from app.services.audit_service import log_event

settings = get_settings()
router = APIRouter()

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

@router.get("/player/{player_id}")
def download_player_report(
    player_id: int,
    request: Request,
    current_user: User = require_role([UserRole.admin_juego, UserRole.moderador]),
    db: Session = Depends(get_db)
):
    """
    Generate PDF report for a player (Admin/Moderator only).
    - In-memory response.
    - Sanitized inputs.
    - Generic output metadata.
    """
    ip = get_client_ip(request)
    
    # 1. Fetch player
    player = db.query(User).filter(User.id == player_id).first()
    if not player:
        # Secure error response (avoid revealing database details)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El jugador solicitado no existe"
        )
        
    # 2. Fetch scores
    scores = db.query(Score).filter(Score.user_id == player.id).order_by(Score.recorded_at.desc()).all()
    
    player_data = {
        "username": player.username,
        "created_at": player.created_at,
        "status": player.status.value,
        "token_balance": player.token_balance
    }
    
    # 3. Generate PDF bytes in-memory
    pdf_bytes = generate_player_report_pdf(player_data, scores, current_user.username)
    
    log_event(
        db,
        event_type="admin_pdf_generated",
        user_id=current_user.id,
        username=current_user.username,
        ip_address=ip,
        details={"target_player_id": player_id, "target_username": player.username}
    )
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=reporte_jugador.pdf"
        }
    )

@router.get("/global")
def download_global_report(
    request: Request,
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = require_role([UserRole.admin_juego]), # Moderador does NOT have access
    db: Session = Depends(get_db)
):
    """
    Generate global stats PDF report (admin_juego only).
    - Limit range to 365 days max.
    - Parameterized queries to avoid SQL Injection.
    """
    ip = get_client_ip(request)
    
    # 1. Date validation
    if (date_to - date_from).days < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de inicio debe ser anterior a la fecha de fin"
        )
        
    if (date_to - date_from).days > settings.MAX_REPORT_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El rango de fechas no puede exceder los {settings.MAX_REPORT_DAYS} días"
        )
        
    # Convert dates to datetime boundaries
    dt_from = datetime.combine(date_from, datetime.min.time())
    dt_to = datetime.combine(date_to, datetime.max.time())
    
    # 2. Query stats (SQLAlchemy ORM automatically uses parameterized queries / bound parameters)
    active_players = (
        db.query(func.count(func.distinct(Score.user_id)))
        .filter(and_(Score.recorded_at >= dt_from, Score.recorded_at <= dt_to))
        .scalar()
    ) or 0
    
    total_games = (
        db.query(func.count(Score.id))
        .filter(and_(Score.recorded_at >= dt_from, Score.recorded_at <= dt_to))
        .scalar()
    ) or 0
    
    average_score = (
        db.query(func.avg(Score.score))
        .filter(and_(Score.recorded_at >= dt_from, Score.recorded_at <= dt_to))
        .scalar()
    ) or 0.0
    
    suspended_accounts = (
        db.query(func.count(User.id))
        .filter(User.status == AccountStatus.suspendido)
        .scalar()
    ) or 0
    
    # Top 10 players by max score within the period
    subquery = (
        db.query(
            Score.user_id,
            func.max(Score.score).label("max_score")
        )
        .filter(and_(Score.recorded_at >= dt_from, Score.recorded_at <= dt_to))
        .group_by(Score.user_id)
        .subquery()
    )
    
    top10_results = (
        db.query(User.username, subquery.c.max_score)
        .join(User, User.id == subquery.c.user_id)
        .order_by(subquery.c.max_score.desc())
        .limit(10)
        .all()
    )
    
    stats_data = {
        "active_players": active_players,
        "total_games": total_games,
        "average_score": average_score,
        "suspended_accounts": suspended_accounts
    }
    
    # 3. Generate PDF
    pdf_bytes = generate_global_stats_pdf(
        stats_data, 
        top10_results, 
        date_from.strftime('%Y-%m-%d'), 
        date_to.strftime('%Y-%m-%d')
    )
    
    log_event(
        db,
        event_type="global_pdf_generated",
        user_id=current_user.id,
        username=current_user.username,
        ip_address=ip,
        details={"date_from": str(date_from), "date_to": str(date_to)}
    )
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=reporte_global.pdf"
        }
    )

@router.get("/my-data")
def download_my_data(
    request: Request,
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """
    Player downloads their own personal details, score history, and transactions.
    - Ley 1581 (Habeas Data) compliance.
    - player_id is taken strictly from JWT (avoids IDOR).
    - Output schemas explicitly filter passwords, keys, and credentials.
    """
    ip = get_client_ip(request)
    
    # 1. Fetch user data (current_user already loaded)
    # 2. Fetch score history
    scores = db.query(Score).filter(Score.user_id == current_user.id).order_by(Score.recorded_at.desc()).all()
    
    # 3. Fetch transaction history
    transactions = db.query(TokenTransaction).filter(TokenTransaction.user_id == current_user.id).order_by(TokenTransaction.created_at.desc()).all()
    
    # 4. Fetch owned items
    items = db.query(PlayerItem).filter(PlayerItem.user_id == current_user.id).all()
    
    user_data = {
        "username": current_user.username,
        "email": current_user.email,
        "created_at": current_user.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        "status": current_user.status.value,
        "token_balance": current_user.token_balance
    }
    
    # 5. Generate personal details PDF
    pdf_bytes = generate_player_data_pdf(user_data, scores, transactions, items)
    
    log_event(
        db,
        event_type="personal_data_exported_pdf",
        user_id=current_user.id,
        username=current_user.username,
        ip_address=ip
    )
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=mis_datos.pdf"
        }
    )

