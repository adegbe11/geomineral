import hashlib
import hmac
import secrets
import time

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from .db import Session, User, get_db


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    value = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return salt.hex() + ":" + value.hex()


def verify_password(password: str, stored: str) -> bool:
    salt, expected = stored.split(":")
    value = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return hmac.compare_digest(value.hex(), expected)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def current_user(request: Request, db: DBSession = Depends(get_db)) -> User | None:
    authorization = request.headers.get("authorization", "")
    token = (
        authorization[7:]
        if authorization.startswith("Bearer ")
        else request.cookies.get("gm_session")
    )
    session = db.get(Session, token_hash(token)) if token else None
    if session and session.expires_at > time.time():
        return db.get(User, session.user_id)
    return None


def require_user(user: User | None = Depends(current_user)) -> User:
    if not user:
        raise HTTPException(401, "Sign in to save and access private projects.")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Administrator access required.")
    return user
