from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from cachetools import TTLCache
from typing import List

from app.database import get_db
from app.config import get_settings
from app.models.user import User, UserRole
from app.models.score import Score, ScoreSubmission
from app.schemas.score import ScoreSubmit, ScoreResponse, RankingEntry, RankingResponse
from app.security.jwt_handler import get_current_user, require_role
from app.services.audit_service import log_event
from app.services.rate_limit_service import check_score_rate_limit

settings = get_settings()
router = APIRouter()

# 30-second TTL cache for paginated ranking results
# Key will be (page, limit)
ranking_cache = TTLCache(maxsize=100, ttl=settings.RANKING_CACHE_TTL)

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

@router.post("", response_model=ScoreResponse)
def submit_score(
    score_data: ScoreSubmit,
    request: Request,
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """
    Submits a game score.
    - Player ID is fetched exclusively from the JWT.
    - Score is validated in range (1 to 10000).
    - Submissions are rate-limited to 1 per 60 seconds.
    """
    ip = get_client_ip(request)
    
    # Check rate limits
    if check_score_rate_limit(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Por favor espere 1 minuto entre envíos de puntajes para evitar spam."
        )
        
    # Save score and rate-limit marker atomically.
    new_score = Score(
        user_id=current_user.id,
        score=score_data.score,
        level_completed=score_data.level_completed
    )
    submission_marker = ScoreSubmission(user_id=current_user.id)
    
    try:
        db.add(new_score)
        db.add(submission_marker)
        db.commit()
        db.refresh(new_score)
        
        # Invalidate ranking cache since scores changed
        ranking_cache.clear()
        
        log_event(
            db,
            event_type="score_submitted",
            user_id=current_user.id,
            username=current_user.username,
            ip_address=ip,
            details={"score": new_score.score, "level": new_score.level_completed}
        )
        
        return new_score
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el puntaje"
        )

@router.get("/ranking", response_model=RankingResponse)
def get_ranking(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Get global leaderboard.
    - Public access.
    - Paginated and cached for 30s.
    - Returns only username, position, and highest score.
    """
    cache_key = (page, limit)
    cached_result = ranking_cache.get(cache_key)
    if cached_result:
        return cached_result
        
    # Query: Select maximum score grouped by user
    subquery = (
        db.query(
            Score.user_id,
            func.max(Score.score).label("best_score")
        )
        .group_by(Score.user_id)
        .subquery()
    )
    
    total_players = db.query(subquery.c.user_id).count()
    total_pages = max(1, (total_players + limit - 1) // limit)
    
    # Fetch rankings with usernames
    results = (
        db.query(User.username, subquery.c.best_score)
        .join(User, User.id == subquery.c.user_id)
        .filter(User.status == AccountStatus.activo) # only active users in ranking
        .order_by(desc(subquery.c.best_score))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    
    entries = []
    # Determine base position for current page
    base_pos = (page - 1) * limit
    for idx, row in enumerate(results, 1):
        entries.append(
            RankingEntry(
                position=base_pos + idx,
                username=row.username,
                best_score=row.best_score
            )
        )
        
    response_data = RankingResponse(
        entries=entries,
        page=page,
        total_pages=total_pages,
        total_players=total_players
    )
    
    # Save to cache
    ranking_cache[cache_key] = response_data
    return response_data

@router.get("/my", response_model=List[ScoreResponse])
def get_my_scores(
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """Get the authenticated player's score history."""
    scores = (
        db.query(Score)
        .filter(Score.user_id == current_user.id)
        .order_by(desc(Score.recorded_at))
        .all()
    )
    return scores
from app.models.user import AccountStatus # imported here for cleanliness if needed

