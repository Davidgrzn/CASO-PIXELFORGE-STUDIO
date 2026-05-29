import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.models.user import UserRole, AccountStatus, MFAMethod

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres')
        if not re.search(r"[A-Z]", v):
            raise ValueError('La contraseña debe contener al menos una mayúscula')
        if not re.search(r"\d", v):
            raise ValueError('La contraseña debe contener al menos un número')
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError('La contraseña debe contener al menos un carácter especial')
        return v

class UserLogin(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=255)
    password: str

    @model_validator(mode="before")
    @classmethod
    def accept_email_or_identifier(cls, data):
        if isinstance(data, dict) and "identifier" not in data and "email" in data:
            data = {**data, "identifier": data["email"]}
        return data

    @field_validator('identifier')
    @classmethod
    def normalize_identifier(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean:
            raise ValueError('Debe ingresar correo electrónico o nombre de usuario')
        return clean

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    status: AccountStatus
    token_balance: int
    mfa_enabled: bool
    mfa_method: Optional[MFAMethod] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserProfile(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    status: AccountStatus
    token_balance: int
    mfa_enabled: bool
    mfa_method: Optional[MFAMethod] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PublicUserResponse(BaseModel):
    username: str

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    role: UserRole
    username: str

class PartialTokenResponse(BaseModel):
    partial_token: str
    requires_mfa: bool = True
    mfa_method: Optional[str] = None

class MFAVerify(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)

class ChangePassword(BaseModel):
    old_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres')
        if not re.search(r"[A-Z]", v):
            raise ValueError('La contraseña debe contener al menos una mayúscula')
        if not re.search(r"\d", v):
            raise ValueError('La contraseña debe contener al menos un número')
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError('La contraseña debe contener al menos un carácter especial')
        return v
