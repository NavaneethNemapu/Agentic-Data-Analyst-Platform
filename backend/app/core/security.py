import hmac
import hashlib
import secrets
import base64
import json
import time
from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.system_db import SessionLocal, User

def hash_password(password: str) -> tuple[str, str]:
    """Generates salt and PBKDF2-HMAC-SHA256 password hash."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), 100_000)
    return key.hex(), salt

def verify_password(password: str, hashed_password: str, salt: str) -> bool:
    """Verifies password using PBKDF2-HMAC-SHA256 with constant-time comparison."""
    try:
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), 100_000)
        return hmac.compare_digest(hashed_password, key.hex())
    except Exception:
        return False

def _b64encode_str(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _b64decode_str(s: str) -> bytes:
    padding = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + padding).encode('utf-8'))

def create_access_token(data: dict, expires_in_seconds: int = 86400 * 7) -> str:
    """Creates a signed HMAC-SHA256 JWT access token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = data.copy()
    now = int(time.time())
    payload["iat"] = now
    payload["exp"] = now + expires_in_seconds
    
    header_b64 = _b64encode_str(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64encode_str(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    secret = (settings.SECRET_KEY or "agentic-secret-key-fallback").encode('utf-8')
    signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
    sig_b64 = _b64encode_str(signature)
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def decode_access_token(token: str) -> Optional[dict]:
    """Validates signature and expiration of HMAC-SHA256 JWT token."""
    try:
        parts = token.strip().split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        secret = (settings.SECRET_KEY or "agentic-secret-key-fallback").encode('utf-8')
        expected_sig = hmac.new(secret, signing_input, hashlib.sha256).digest()
        actual_sig = _b64decode_str(sig_b64)
        
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
            
        payload = json.loads(_b64decode_str(payload_b64).decode('utf-8'))
        
        # Check expiration
        if payload.get("exp", 0) < int(time.time()):
            return None
            
        return payload
    except Exception:
        return None

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[User]:
    """Extracts user from Authorization: Bearer <token>, returns None if not present/invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == payload["sub"]).first()
        return user
    finally:
        db.close()

def get_current_user_required(authorization: Optional[str] = Header(None)) -> User:
    """Requires valid Bearer token, raises 401 if unauthorized."""
    user = get_current_user_optional(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in or provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
