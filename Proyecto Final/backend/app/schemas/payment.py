from pydantic import BaseModel, Field, field_validator
from typing import Literal
import re

class CardRegister(BaseModel):
    card_number: str = Field(...)
    cardholder_name: str = Field(..., min_length=2)
    expiry_month: str = Field(...)
    expiry_year: str = Field(...)
    cvv: str = Field(...)

    @field_validator('card_number')
    @classmethod
    def validate_card_number(cls, v: str) -> str:
        clean = re.sub(r"\s+", "", v)
        if not clean.isdigit() or len(clean) != 16:
            raise ValueError('El número de tarjeta debe tener exactamente 16 dígitos')
        return clean

    @field_validator('expiry_month')
    @classmethod
    def validate_month(cls, v: str) -> str:
        if not v.isdigit() or not (1 <= int(v) <= 12):
            raise ValueError('El mes de vencimiento debe estar entre 01 y 12')
        return v.zfill(2)

    @field_validator('expiry_year')
    @classmethod
    def validate_year(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError('El año de vencimiento debe tener 4 dígitos')
        return v

    @field_validator('cvv')
    @classmethod
    def validate_cvv(cls, v: str) -> str:
        clean = re.sub(r"\s+", "", v)
        if not clean.isdigit() or len(clean) not in [3, 4]:
            raise ValueError('El CVV debe tener 3 o 4 dígitos')
        return clean

class CardResponse(BaseModel):
    card_token: str
    last_four: str
    card_type: str
    expiry_month: str
    expiry_year: str

    class Config:
        from_attributes = True

class PurchaseRequest(BaseModel):
    card_token: str
    package_name: Literal['basico', 'estandar', 'premium']

class PurchaseResponse(BaseModel):
    result: str
    tokens_amount: int
    new_balance: int
    message: str

class SpendRequest(BaseModel):
    item_id: int

class SpendResponse(BaseModel):
    item_name: str
    tokens_spent: int
    new_balance: int
