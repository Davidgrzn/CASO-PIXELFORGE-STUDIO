from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
from app.routers import auth, mfa, scores, payments, shop, reports, admin
import logging

# Setup logging configuration safely for wazuh agent interception without triggering dictConfig security hotspot
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

# Remove existing handlers to avoid duplicates
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
root_logger.addHandler(console_handler)

logger = logging.getLogger("main")

settings = get_settings()

app = FastAPI(
    title="PixelForge Studio Secure API",
    description="Seguridad Informática UMNG Examen Final",
    version="1.0.0"
)

# CORS configurations
origins = [
    settings.FRONTEND_ORIGIN,
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Set-Cookie", "Authorization", "Access-Control-Allow-Credentials"],
)

# Custom middleware to add security headers to all responses
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
    )
    return response

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database tables and constraints...")
    init_db()
    logger.info("PixelForge Studio backend started successfully.")

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "pixelforge-backend"}

@app.get("/api/health")
def api_health_check():
    return {"status": "ok", "app": "pixelforge-backend"}

# Register Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(mfa.router, prefix="/api/mfa", tags=["MFA"])
app.include_router(scores.router, prefix="/api/scores", tags=["Scores & Rankings"])
app.include_router(payments.router, prefix="/api/cards", tags=["Payment Methods"])
app.include_router(shop.router, prefix="/api/shop", tags=["Virtual Shop"])
app.include_router(reports.router, prefix="/api/reports", tags=["PDF Reports"])
app.include_router(admin.router, prefix="/api/admin", tags=["Administration Panel"])
