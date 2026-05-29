from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import user, score, payment, shop, audit  # noqa: F401
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    ensure_demo_data()

def ensure_schema_compatibility():
    """Apply small idempotent schema fixes for existing local Docker volumes."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_score_check"))
        conn.execute(text(
            "ALTER TABLE scores ADD CONSTRAINT scores_score_check "
            "CHECK (score >= 0 AND score <= 10000)"
        ))


def ensure_demo_data():
    from app.models.user import User, UserRole, AccountStatus
    from app.models.shop import ShopItem
    from app.security.password import hash_password

    db = SessionLocal()
    try:
        demo_password_hash = hash_password("Admin@2026!")
        demo_users = [
            ("admin", "admin@pixelforge.gg", UserRole.admin_juego),
            ("moderador1", "mod@pixelforge.gg", UserRole.moderador),
        ]

        for username, email, role in demo_users:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                existing.username = username
                existing.role = role
                existing.status = AccountStatus.activo
                existing.password_hash = demo_password_hash
            else:
                db.add(User(
                    username=username,
                    email=email,
                    password_hash=demo_password_hash,
                    role=role,
                    status=AccountStatus.activo,
                    token_balance=0,
                    mfa_enabled=False
                ))

        if db.query(ShopItem).count() == 0:
            db.add_all([
                ShopItem(name="Phoenix Ship", description="Nave con diseño de fénix llameante", price_tokens=30, category="skin", image_key="ship_phoenix"),
                ShopItem(name="Galaxy Ship", description="Nave con acabado galaxia holográfico", price_tokens=50, category="skin", image_key="ship_galaxy"),
                ShopItem(name="Stealth Ship", description="Nave negra mate con stealth coating", price_tokens=80, category="skin", image_key="ship_stealth"),
                ShopItem(name="Fire Trail", description="Estela de fuego detrás de tu nave", price_tokens=20, category="trail", image_key="trail_fire"),
                ShopItem(name="Ice Trail", description="Estela de cristales de hielo", price_tokens=20, category="trail", image_key="trail_ice"),
                ShopItem(name="Rainbow Trail", description="Estela arcoíris animada", price_tokens=35, category="trail", image_key="trail_rainbow"),
                ShopItem(name="Energy Shield", description="Escudo de energía que absorbe 1 impacto", price_tokens=25, category="shield", image_key="shield_energy"),
                ShopItem(name="Plasma Shield", description="Escudo de plasma avanzado, absorbe 2 impactos", price_tokens=45, category="shield", image_key="shield_plasma"),
                ShopItem(name="Score Boost x2", description="Duplica puntaje en la próxima partida", price_tokens=15, category="boost", image_key="boost_score"),
                ShopItem(name="Mega Boost x3", description="Triplica puntaje en la próxima partida", price_tokens=40, category="boost", image_key="boost_mega"),
            ])

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
