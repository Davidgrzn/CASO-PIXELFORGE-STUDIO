-- ============================================================
-- PixelForge Studio — Database Schema
-- Seguridad Informática · UMNG · 2026-I
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('jugador', 'admin_juego', 'moderador');
CREATE TYPE account_status AS ENUM ('activo', 'suspendido');
CREATE TYPE mfa_method AS ENUM ('totp', 'oauth2');
CREATE TYPE card_type AS ENUM ('visa', 'mastercard');
CREATE TYPE transaction_result AS ENUM ('aprobada', 'rechazada');
CREATE TYPE rejection_reason_type AS ENUM ('fondos_insuficientes', 'tarjeta_vencida', 'otro');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt (rounds=12)
    role            user_role    NOT NULL DEFAULT 'jugador',
    status          account_status NOT NULL DEFAULT 'activo',
    token_balance   INTEGER      NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
    mfa_enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
    mfa_method      mfa_method,
    mfa_secret_enc  TEXT,                            -- Fernet-encrypted TOTP secret
    mfa_temp_secret TEXT,                            -- temp before confirmation
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SCORES
-- ============================================================
CREATE TABLE scores (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 10000),
    level_completed INTEGER NOT NULL DEFAULT 1 CHECK (level_completed >= 1),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_user_id    ON scores(user_id);
CREATE INDEX idx_scores_score_desc ON scores(score DESC);

-- ============================================================
-- RATE LIMITING — LOGIN ATTEMPTS
-- ============================================================
CREATE TABLE login_attempts (
    id             SERIAL PRIMARY KEY,
    identifier     VARCHAR(255) NOT NULL,   -- email or IP
    attempt_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    success        BOOLEAN      NOT NULL DEFAULT FALSE,
    ip_address     VARCHAR(45),
    username_tried VARCHAR(255)
);

CREATE INDEX idx_login_attempts_id_time ON login_attempts(identifier, attempt_at);

-- ============================================================
-- RATE LIMITING — MFA ATTEMPTS
-- ============================================================
CREATE TABLE mfa_attempts (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success    BOOLEAN     NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45)
);

CREATE INDEX idx_mfa_attempts_user_time ON mfa_attempts(user_id, attempt_at);

-- ============================================================
-- PAYMENT CARDS (tokenized — NO full number, NO CVV)
-- ============================================================
CREATE TABLE payment_cards (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_token   VARCHAR(64)  UNIQUE NOT NULL,   -- internal UUID token
    last_four    CHAR(4)      NOT NULL,
    card_type    card_type    NOT NULL,
    expiry_month CHAR(2)      NOT NULL,
    expiry_year  CHAR(4)      NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cards_user_id ON payment_cards(user_id);

-- ============================================================
-- TOKEN TRANSACTIONS
-- ============================================================
CREATE TABLE token_transactions (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id          INTEGER            REFERENCES payment_cards(id),
    package_name     VARCHAR(50)        NOT NULL,
    tokens_amount    INTEGER            NOT NULL,
    price_cop        INTEGER            NOT NULL,
    result           transaction_result NOT NULL,
    rejection_reason rejection_reason_type,
    last_four_used   CHAR(4),           -- never full card number
    created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON token_transactions(user_id);

-- ============================================================
-- SHOP CATALOG
-- ============================================================
CREATE TABLE shop_items (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    price_tokens INTEGER      NOT NULL CHECK (price_tokens > 0),
    category     VARCHAR(50)  NOT NULL,   -- 'skin', 'trail', 'shield', 'boost'
    image_key    VARCHAR(100),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ============================================================
-- PLAYER-OWNED ITEMS
-- ============================================================
CREATE TABLE player_items (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id     INTEGER NOT NULL REFERENCES shop_items(id),
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- ============================================================
-- TOKEN SPEND HISTORY
-- ============================================================
CREATE TABLE token_spends (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id       INTEGER NOT NULL REFERENCES shop_items(id),
    tokens_spent  INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    spent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG (Wazuh-compatible structured events)
-- ============================================================
CREATE TABLE audit_logs (
    id         SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id    INTEGER REFERENCES users(id),
    username   VARCHAR(50),
    ip_address VARCHAR(45),
    details    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_event   ON audit_logs(event_type);

-- ============================================================
-- SCORE RATE LIMIT TRACKING
-- ============================================================
CREATE TABLE score_submissions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_score_sub_user ON score_submissions(user_id, submitted_at);

-- ============================================================
-- SEED: Admin users (password: Admin@2026!)
-- Hash generated with bcrypt rounds=12
-- ============================================================
INSERT INTO users (username, email, password_hash, role) VALUES
    ('admin',      'admin@pixelforge.gg', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'admin_juego'),
    ('moderador1', 'mod@pixelforge.gg',   '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'moderador');

-- ============================================================
-- SEED: Shop items
-- ============================================================
INSERT INTO shop_items (name, description, price_tokens, category, image_key) VALUES
    ('Phoenix Ship',   'Nave con diseño de fénix llameante',             30, 'skin',   'ship_phoenix'),
    ('Galaxy Ship',    'Nave con acabado galaxia holográfico',            50, 'skin',   'ship_galaxy'),
    ('Stealth Ship',   'Nave negra mate con stealth coating',             80, 'skin',   'ship_stealth'),
    ('Fire Trail',     'Estela de fuego detrás de tu nave',               20, 'trail',  'trail_fire'),
    ('Ice Trail',      'Estela de cristales de hielo',                    20, 'trail',  'trail_ice'),
    ('Rainbow Trail',  'Estela arcoíris animada',                         35, 'trail',  'trail_rainbow'),
    ('Energy Shield',  'Escudo de energía que absorbe 1 impacto',         25, 'shield', 'shield_energy'),
    ('Plasma Shield',  'Escudo de plasma avanzado, absorbe 2 impactos',   45, 'shield', 'shield_plasma'),
    ('Score Boost x2', 'Duplica puntaje en la próxima partida',           15, 'boost',  'boost_score'),
    ('Mega Boost x3',  'Triplica puntaje en la próxima partida',          40, 'boost',  'boost_mega');
