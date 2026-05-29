from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://pixelforge:pixelforge_secret_2026@db:5432/pixelforge"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    PARTIAL_TOKEN_EXPIRE_MINUTES: int = 5

    # Fernet key for encrypting TOTP secrets at rest (base64-urlsafe 32 bytes)
    TOTP_ENCRYPTION_KEY: str
    COOKIE_SECURE: bool = False

    # Game rules
    MAX_SCORE: int = 10000

    # Rate limiting
    SCORE_RATE_LIMIT_SECONDS: int = 60
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 10
    MAX_MFA_ATTEMPTS: int = 5
    MFA_LOCKOUT_MINUTES: int = 5
    MAX_CARDS_PER_USER: int = 2

    # Ranking
    RANKING_CACHE_TTL: int = 30
    RANKING_PAGE_SIZE: int = 50

    # Reports
    MAX_REPORT_DAYS: int = 365

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost"

    # OAuth2 MFA with Authorization Code + PKCE.
    # For production/defense, configure these from .env or Docker environment.
    OAUTH2_PROVIDER: str = "google"
    OAUTH2_CLIENT_ID: str = ""
    OAUTH2_CLIENT_SECRET: str = ""
    OAUTH2_AUTH_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
    OAUTH2_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    OAUTH2_USERINFO_URL: str = "https://openidconnect.googleapis.com/v1/userinfo"
    OAUTH2_REDIRECT_URI: str = "http://localhost/api/mfa/oauth2/callback"
    OAUTH2_SCOPES: str = "openid email profile"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
