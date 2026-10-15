import base64
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from app.core.config import settings

# Initialize Argon2 password hasher
password_hasher = PasswordHash((Argon2Hasher(),))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the stored Argon2 hash."""
    return password_hasher.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return password_hasher.hash(password)


def create_access_token(
    subject: str,
    role: str,
    jti: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str, datetime]:
    """
    Create a signed JWT access token containing subject (user_id), role, and a unique jti.
    Returns (token_string, jti, expire_datetime).
    """
    if jti is None:
        jti = str(uuid.uuid4())

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "jti": jti,
        "iat": now,
        "exp": expire,
    }

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    return encoded_jwt, jti, expire


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


def _get_encryption_key() -> bytes:
    """Derive 256-bit symmetric key from backend-only environment key."""
    return hashlib.sha256(settings.ROOM_ENCRYPTION_KEY.encode("utf-8")).digest()


def encrypt_credential(plaintext: str) -> str:
    """
    Encrypt plaintext string using AES-256-GCM authenticated encryption.
    Generates a cryptographically secure 12-byte nonce for each encryption.
    Returns base64-encoded string containing (12-byte nonce + ciphertext + 16-byte tag).
    """
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_credential(ciphertext_b64: str) -> str:
    """
    Decrypt and authenticate ciphertext using AES-256-GCM.
    Raises ValueError or cryptography.exceptions.InvalidTag if ciphertext or tag was tampered with.
    """
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    try:
        raw_data = base64.b64decode(ciphertext_b64.encode("utf-8"))
    except Exception as e:
        raise ValueError("Invalid base64 encoding for credential.") from e

    if len(raw_data) < 28:  # 12 bytes nonce + at least 16 bytes auth tag
        raise ValueError("Ciphertext payload is too short.")

    nonce = raw_data[:12]
    ciphertext = raw_data[12:]
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted_bytes.decode("utf-8")
