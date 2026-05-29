from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.config import get_settings
from app.models.user import User, UserRole, AccountStatus
from app.models.score import Score
from app.schemas.user import UserRegister, UserLogin, UserProfile, TokenResponse, PartialTokenResponse
from app.security.password import hash_password, verify_password
from app.security.jwt_handler import create_access_token, create_partial_token, get_current_user
from app.services.audit_service import log_event
from app.services.rate_limit_service import check_login_lockout, record_login_attempt

settings = get_settings()
router = APIRouter()

def get_client_ip(request: Request) -> str:
    """Helper to extract the actual client IP (handling reverse proxies)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Get leftmost IP
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "127.0.0.1"

@router.post("/register", response_model=UserProfile)
def register_user(
    user_in: UserRegister,
    request: Request,
    db: Session = Depends(get_db)
):
    ip = get_client_ip(request)
    
    # Check if username or email already exists
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    
    # To prevent user enumeration (OWASP A07), keep the public response generic.
    if existing_username or existing_email:
        log_event(
            db,
            event_type="register_failed_duplicate",
            username=user_in.username,
            ip_address=ip,
            details={"message": "El nombre de usuario o correo ya está registrado"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fue posible completar el registro con los datos suministrados"
        )
        
    # Create the user
    hashed_pwd = hash_password(user_in.password)
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=hashed_pwd,
        role=UserRole.jugador,
        status=AccountStatus.activo,
        token_balance=0,
        mfa_enabled=False
    )
    
    try:
        db.add(new_user)
        db.flush()
        db.add(Score(user_id=new_user.id, score=0, level_completed=1))
        db.commit()
        db.refresh(new_user)
        
        # Log successful registration
        log_event(
            db,
            event_type="player_register",
            user_id=new_user.id,
            username=new_user.username,
            ip_address=ip,
            details={"email": new_user.email}
        )
        return new_user
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar el usuario"
        )

@router.post("/login")
def login(
    credentials: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    ip = get_client_ip(request)
    login_identifier = credentials.identifier

    # Accept either email or username without revealing which one matched.
    user = (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == login_identifier,
                func.lower(User.username) == login_identifier
            )
        )
        .first()
    )
    account_identifier = f"user:{user.id}" if user else login_identifier
    
    # Check rate limit lockout (5 attempts / 10 minutes)
    if check_login_lockout(db, account_identifier) or check_login_lockout(db, ip):
        log_event(
            db,
            event_type="lockout_triggered",
            ip_address=ip,
            details={"identifier": login_identifier, "reason": "Fuerza bruta detectada"}
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Su cuenta o IP está bloqueada por 10 minutos."
        )
    
    # Generic credential validation error (OWASP A07)
    if not user or not verify_password(credentials.password, user.password_hash):
        record_login_attempt(db, account_identifier, success=False, ip_address=ip, username_tried=login_identifier)
        record_login_attempt(db, ip, success=False, ip_address=ip, username_tried=login_identifier)
        
        log_event(
            db,
            event_type="login_failed",
            ip_address=ip,
            details={"identifier": login_identifier}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )
        
    # Account status check
    if user.status == AccountStatus.suspendido:
        log_event(
            db,
            event_type="login_failed_suspended",
            user_id=user.id,
            username=user.username,
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta suspendida"
        )
        
    # Clear lockout status on successful login by recording successful attempt
    record_login_attempt(db, account_identifier, success=True, ip_address=ip, username_tried=login_identifier)
    record_login_attempt(db, ip, success=True, ip_address=ip, username_tried=user.username)

    if user.mfa_enabled:
        # Issue partial JWT (mfa_only scope)
        partial_token = create_partial_token(user.id)
        
        log_event(
            db,
            event_type="login_step1_mfa_required",
            user_id=user.id,
            username=user.username,
            ip_address=ip
        )
        return PartialTokenResponse(
            partial_token=partial_token,
            mfa_method=user.mfa_method.value if user.mfa_method else "totp"
        )
    else:
        # Issue full access JWT
        access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
        
        # Set as HttpOnly Cookie
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite="lax",
            secure=settings.COOKIE_SECURE,
            path="/"
        )
        
        log_event(
            db,
            event_type="login_success",
            user_id=user.id,
            username=user.username,
            ip_address=ip
        )
        return TokenResponse(
            role=user.role,
            username=user.username
        )

@router.post("/logout")
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    # Try to log logout event
    try:
        current_user = get_current_user(request, db)
        ip = get_client_ip(request)
        log_event(db, event_type="logout", user_id=current_user.id, username=current_user.username, ip_address=ip)
    except Exception:
        pass
        
    response.delete_cookie(key="access_token", path="/")
    return {"message": "Sesión cerrada correctamente"}

@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
