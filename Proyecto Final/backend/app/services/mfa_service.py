import io
import pyotp
import qrcode

def generate_totp_secret() -> str:
    """Generate a random Base32 TOTP secret."""
    return pyotp.random_base32()

def generate_qr_code(secret: str, username: str) -> bytes:
    """
    Generate a QR code image as bytes representing the TOTP provisioning URI.
    Uses 'PixelForge Studio' as the issuer.
    """
    # Create provisioning URI
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(username, issuer_name="PixelForge Studio")
    
    # Generate QR Code image
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to buffer
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

def verify_totp(secret: str, code: str) -> bool:
    """
    Verify a TOTP code against the secret.
    Allows a 30-second skew window (valid_window=1).
    """
    # Clean the code of spaces
    clean_code = "".join(filter(str.isdigit, code))
    if len(clean_code) != 6:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(clean_code, valid_window=1)
