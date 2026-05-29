from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User, UserRole
from app.models.shop import ShopItem, PlayerItem, TokenSpend
from app.schemas.payment import SpendRequest, SpendResponse
from app.security.jwt_handler import require_role
from app.services.audit_service import log_event

router = APIRouter()

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

@router.get("/items")
def list_shop_items(db: Session = Depends(get_db)):
    """List all active shop items."""
    return db.query(ShopItem).filter(ShopItem.active == True).all()

@router.post("/buy", response_model=SpendResponse)
def buy_shop_item(
    buy_data: SpendRequest,
    request: Request,
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """
    Buy a cosmetic shop item.
    - Player ID is taken exclusively from the JWT.
    - Price is retrieved from the DB (client cannot send it).
    - SELECT FOR UPDATE on the User record prevents race conditions.
    """
    ip = get_client_ip(request)
    
    # 1. Fetch item
    item = db.query(ShopItem).filter(
        ShopItem.id == buy_data.item_id,
        ShopItem.active == True
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El artículo solicitado no existe o no está activo"
        )
        
    # 3. BEGIN row locking transaction
    db.begin_nested() # transaction savepoint
    try:
        # SELECT FOR UPDATE on User to freeze and lock balance
        locked_user = db.query(User).filter(User.id == current_user.id).with_for_update().one()

        already_owned = db.query(PlayerItem).filter(
            PlayerItem.user_id == locked_user.id,
            PlayerItem.item_id == item.id
        ).first()
        if already_owned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya posee este artículo de juego"
            )
        
        # Verify balance
        if locked_user.token_balance < item.price_tokens:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Saldo de tokens insuficiente. Se requieren {item.price_tokens} tokens."
            )
            
        # Deduct balance
        locked_user.token_balance -= item.price_tokens
        final_balance = locked_user.token_balance
        
        # Add to player inventory
        owned_item = PlayerItem(
            user_id=locked_user.id,
            item_id=item.id
        )
        db.add(owned_item)
        
        # Record spend log
        spend_log = TokenSpend(
            user_id=locked_user.id,
            item_id=item.id,
            tokens_spent=item.price_tokens,
            balance_after=final_balance
        )
        db.add(spend_log)
        
        # Commit transaction
        db.commit()
        
        # Audit log
        log_event(
            db,
            event_type="shop_item_purchased",
            user_id=locked_user.id,
            username=locked_user.username,
            ip_address=ip,
            details={
                "item_id": item.id,
                "item_name": item.name,
                "tokens_spent": item.price_tokens,
                "balance_after": final_balance
            }
        )
        
        return SpendResponse(
            item_name=item.name,
            tokens_spent=item.price_tokens,
            new_balance=final_balance
        )
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al procesar el gasto de tokens"
        )

@router.get("/my-items")
def list_owned_items(
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """List all shop items owned by the logged-in player."""
    owned = (
        db.query(PlayerItem)
        .filter(PlayerItem.user_id == current_user.id)
        .all()
    )
    return [
        {
            "id": it.item.id,
            "name": it.item.name,
            "description": it.item.description,
            "category": it.item.category,
            "image_key": it.item.image_key,
            "acquired_at": it.acquired_at
        }
        for it in owned
    ]

@router.get("/spending")
def get_user_spending(
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """
    Get token spending history for the logged-in player.
    - Returns all shop item purchases with tokens spent.
    """
    spends = (
        db.query(TokenSpend)
        .filter(TokenSpend.user_id == current_user.id)
        .order_by(TokenSpend.spent_at.desc())
        .all()
    )
    
    return [
        {
            "id": spend.id,
            "item_id": spend.item_id,
            "item_name": spend.item.name if spend.item else "Item Desconocido",
            "tokens_spent": spend.tokens_spent,
            "balance_after": spend.balance_after,
            "created_at": spend.spent_at
        }
        for spend in spends
    ]

