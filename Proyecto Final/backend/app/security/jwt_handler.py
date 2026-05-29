from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Request, Depends, HTTPException, status
from fastapi.security import APIKeyCookie
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole, AccountStatus

settings = get_settings()

# We look for token in httpOnly cookie named 'access_token'
cookie_sec = APIKeyCookie(name="access_token", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_partial_token(user_id: int, expires_minutes: Optional[int] = None) -> str:
    """Token with scope 'mfa_only' that only allows MFA verification."""
    expires_min = expires_minutes or settings.PARTIAL_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=expires_min)
    to_encode = {
        "sub": str(user_id),
        "scope": "mfa_only",
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_token_from_req(request: Request) -> str:
    """Helper to extract token from cookie or authorization header."""
    # First check cookie
    token = request.cookies.get("access_token")
    if token:
        return token
    # Fallback to Authorization Header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = get_token_from_req(request)
    payload = decode_token(token)
    
    # Block partial tokens
    if payload.get("scope") == "mfa_only":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Autenticación parcial. Debe completar MFA."
        )
        
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    if user.status == AccountStatus.suspendido:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta suspendida"
        )
        
    return user

def get_partial_token_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Get user from a partial token (mfa_only)."""
    token = get_token_from_req(request)
    payload = decode_token(token)
    
    if payload.get("scope") != "mfa_only":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere un token de autenticación parcial"
        )
        
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
        
    if user.status == AccountStatus.suspendido:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta suspendida"
        )
        
    return user

class RoleChecker:
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para realizar esta acción"
            )
        return current_user

def require_role(roles: List[UserRole]):
    return Depends(RoleChecker(roles))
