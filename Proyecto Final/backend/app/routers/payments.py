from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from app.database import get_db
from app.config import get_settings
from app.models.user import User, UserRole
from app.models.payment import PaymentCard, TokenTransaction, CardType, TransactionResult, RejectionReason
from app.schemas.payment import CardRegister, CardResponse, PurchaseRequest, PurchaseResponse
from app.security.jwt_handler import require_role
from app.security.luhn import luhn_check, detect_card_type
from app.security.tokenizer import generate_card_token
from app.services.payment_service import process_simulated_payment, get_package_info
from app.services.audit_service import log_event

settings = get_settings()
router = APIRouter()

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

@router.post("", response_model=CardResponse)
def add_card(
    card_data: CardRegister,
    request: Request,
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """
    Register a credit card for token transactions.
    - Max 2 cards per account.
    - Luhn validation.
    - Card tokenization: ONLY stores card token, last 4 digits, expiry, card type.
    - CVV and full card number are NEVER stored.
    """
    ip = get_client_ip(request)
    
    # 1. Check max cards per user limit
    card_count = db.query(PaymentCard).filter(PaymentCard.user_id == current_user.id).count()
    if card_count >= settings.MAX_CARDS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Máximo {settings.MAX_CARDS_PER_USER} tarjetas de crédito registradas por cuenta."
        )
        
    # 2. Luhn Check
    if not luhn_check(card_data.card_number):
        log_event(
            db,
            event_type="card_registration_failed_luhn",
            user_id=current_user.id,
            username=current_user.username,
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Número de tarjeta inválido (Fallo de algoritmo de Luhn)"
        )
        
    # 3. Detect card type
    detected_type = detect_card_type(card_data.card_number)
    
    # 4. Tokenize
    card_token = generate_card_token()
    last_four = card_data.card_number[-4:]
    
    new_card = PaymentCard(
        user_id=current_user.id,
        card_token=card_token,
        last_four=last_four,
        card_type=CardType[detected_type],
        expiry_month=card_data.expiry_month,
        expiry_year=card_data.expiry_year
    )
    
    try:
        db.add(new_card)
        db.commit()
        db.refresh(new_card)
        
        # Log event (never log full card number or CVV)
        log_event(
            db,
            event_type="card_registered",
            user_id=current_user.id,
            username=current_user.username,
            ip_address=ip,
            details={"card_token": card_token, "last_four": last_four, "type": detected_type}
        )
        
        return new_card
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar la tarjeta"
        )

@router.get("", response_model=List[CardResponse])
def list_cards(
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """List registered tokenized credit cards for the player."""
    cards = db.query(PaymentCard).filter(PaymentCard.user_id == current_user.id).all()
    return cards

@router.post("/purchase", response_model=PurchaseResponse)
def buy_tokens(
    purchase_data: PurchaseRequest,
    request: Request,
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """
    Purchase a token package.
    - Packages prices and tokens quantities are defined exclusively on the backend.
    - Payment is simulated based on card's last 4 digits.
    - Database transaction with Row Locking (SELECT FOR UPDATE) prevents race conditions.
    """
    ip = get_client_ip(request)
    
    # 1. Fetch card details (verify owner)
    card = db.query(PaymentCard).filter(
        PaymentCard.card_token == purchase_data.card_token,
        PaymentCard.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarjeta de pago registrada no encontrada"
        )
        
    # 2. Get backend-configured price and tokens (prevents price manipulation in payload)
    pkg_info = get_package_info(purchase_data.package_name)
    if not pkg_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El paquete de tokens especificado no es válido"
        )
        
    # 3. Simulate payment
    payment_result = process_simulated_payment(card.last_four, purchase_data.package_name)
    
    # 4. Atomic transaction with SELECT FOR UPDATE row locking
    # This prevents race conditions where dual concurrent requests can read the same starting balance.
    tx_status = TransactionResult.rechazada
    rej_reason = None
    new_balance = current_user.token_balance
    
    db.begin_nested() # Create savepoint for transaction isolation
    try:
        # Lock user row for update
        locked_user = db.query(User).filter(User.id == current_user.id).with_for_update().one()
        
        if payment_result["success"]:
            # Increment tokens
            locked_user.token_balance += payment_result["tokens_amount"]
            new_balance = locked_user.token_balance
            tx_status = TransactionResult.aprobada
        else:
            rej_reason = RejectionReason[payment_result["rejection_reason"]]
            
        # Log transaction to DB
        tx_record = TokenTransaction(
            user_id=current_user.id,
            card_id=card.id,
            package_name=purchase_data.package_name,
            tokens_amount=pkg_info["tokens"],
            price_cop=pkg_info["price_cop"],
            result=tx_status,
            rejection_reason=rej_reason,
            last_four_used=card.last_four
        )
        db.add(tx_record)
        db.commit() # Commits nested & outer
        
        # Log event for audit / SIEM
        log_event(
            db,
            event_type="token_purchase_result",
            user_id=current_user.id,
            username=current_user.username,
            ip_address=ip,
            details={
                "package": purchase_data.package_name,
                "tokens": pkg_info["tokens"],
                "price": pkg_info["price_cop"],
                "result": tx_status.value,
                "rejection_reason": rej_reason.value if rej_reason else None,
                "last_four": card.last_four
            }
        )
        
        if not payment_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=payment_result["message"]
            )
            
        return PurchaseResponse(
            result=tx_status.value,
            tokens_amount=pkg_info["tokens"],
            new_balance=new_balance,
            message=payment_result["message"]
        )
        
    except HTTPException:
        # Re-raise HTTPExceptions without standard fallback
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al procesar la compra de tokens"
        )

@router.get("/transactions")
def get_user_transactions(
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """
    Get transaction history for the logged-in player.
    - Returns all token purchases with dates and results.
    """
    transactions = (
        db.query(TokenTransaction)
        .filter(TokenTransaction.user_id == current_user.id)
        .order_by(TokenTransaction.created_at.desc())
        .all()
    )
    
    return [
        {
            "id": tx.id,
            "package_name": tx.package_name,
            "tokens_amount": tx.tokens_amount,
            "price_cop": tx.price_cop,
            "result": tx.result.value,
            "rejection_reason": tx.rejection_reason.value if tx.rejection_reason else None,
            "last_four_used": tx.last_four_used,
            "created_at": tx.created_at
        }
        for tx in transactions
    ]

@router.delete("/{card_token}")
def delete_card(
    card_token: str,
    request: Request,
    current_user: User = require_role([UserRole.jugador]),
    db: Session = Depends(get_db)
):
    """Delete a registered card. This route stays last so it does not capture fixed paths."""
    ip = get_client_ip(request)
    
    card = db.query(PaymentCard).filter(
        PaymentCard.card_token == card_token,
        PaymentCard.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarjeta no encontrada"
        )
        
    try:
        last_four = card.last_four
        db.delete(card)
        db.commit()
        
        log_event(
            db,
            event_type="card_deleted",
            user_id=current_user.id,
            username=current_user.username,
            ip_address=ip,
            details={"last_four": last_four}
        )
        return {"message": "Tarjeta eliminada correctamente"}
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar la tarjeta"
        )

