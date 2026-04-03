"""
JWT-based auth via Supabase.

If SUPABASE_JWT_SECRET is not set (local dev), returns a fixed "dev_user" so
the app works without any auth configuration.
"""

import os
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> str:
    """
    Returns the authenticated user's Supabase UUID (sub claim).

    Dev mode (SUPABASE_JWT_SECRET not set): always returns "dev_user".
    """
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        return "00000000-0000-0000-0000-000000000000"

    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        from jose import JWTError, jwt

        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")
        return user_id
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
