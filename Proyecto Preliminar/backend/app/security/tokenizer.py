import uuid
from cryptography.fernet import Fernet
import base64

def generate_card_token() -> str:
    """Generate a unique secure card token (UUID4)."""
    return f"tok_{uuid.uuid4().hex}"

def _get_fernet(key: str) -> Fernet:
    """Ensure the key is a valid 32-byte base64 Fernet key."""
    try:
        # Check if it's already a valid Fernet key
        return Fernet(key.encode())
    except Exception:
        # Fallback/derive a valid base64 key from whatever string is provided
        # Fernet needs 32 bytes base64 encoded.
        padded_key = key.ljust(32)[:32].encode()
        b64_key = base64.urlsafe_b64encode(padded_key)
        return Fernet(b64_key)

def encrypt_totp_secret(secret: str, key: str) -> str:
    """Encrypt TOTP secret using Fernet."""
    f = _get_fernet(key)
    return f.encrypt(secret.encode()).decode()

def decrypt_totp_secret(encrypted: str, key: str) -> str:
    """Decrypt TOTP secret using Fernet."""
    f = _get_fernet(key)
    return f.decrypt(encrypted.encode()).decode()
