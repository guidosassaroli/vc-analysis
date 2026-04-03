"""
JWT auth via Supabase.

Supports both HS256 (legacy) and ES256 (current Supabase default).
- HS256: set SUPABASE_JWT_SECRET
- ES256: JWKS URL derived automatically from the token issuer
- Neither set: dev mode, returns a fixed UUID (no login required)
"""

import json
import os
from base64 import b64decode
from typing import Optional

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_security = HTTPBearer(auto_error=False)
_jwks_cache: dict[str, list] = {}


def _decode_segment(segment: str) -> dict:
    padded = segment + "=" * (4 - len(segment) % 4)
    return json.loads(b64decode(padded))


def _fetch_jwks(jwks_url: str) -> list:
    if jwks_url not in _jwks_cache:
        resp = httpx.get(jwks_url, timeout=10)
        resp.raise_for_status()
        _jwks_cache[jwks_url] = resp.json().get("keys", [])
    return _jwks_cache[jwks_url]


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> str:
    """
    Returns the authenticated user's Supabase UUID (sub claim).

    Dev mode (no SUPABASE_JWT_SECRET and no SUPABASE_URL): returns a fixed UUID.
    """
    jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")

    if not jwt_secret and not supabase_url:
        return "00000000-0000-0000-0000-000000000000"

    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")

    token = credentials.credentials
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Malformed token")

    try:
        from jose import jwk, jwt

        header = _decode_segment(parts[0])
        alg = header.get("alg", "HS256")

        if alg == "HS256":
            if not jwt_secret:
                raise HTTPException(status_code=401, detail="HS256 token but SUPABASE_JWT_SECRET not configured")
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")

        elif alg == "ES256":
            # Derive JWKS URL: prefer explicit env var, fall back to issuer in token
            if supabase_url:
                jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            else:
                unverified = _decode_segment(parts[1])
                iss = unverified.get("iss", "").rstrip("/")
                jwks_url = f"{iss}/.well-known/jwks.json"

            kid = header.get("kid")
            keys = _fetch_jwks(jwks_url)
            key = next((k for k in keys if k.get("kid") == kid), None)

            if key is None:
                # Clear cache and retry once (handles key rotation)
                _jwks_cache.pop(jwks_url, None)
                keys = _fetch_jwks(jwks_url)
                key = next((k for k in keys if k.get("kid") == kid), None)

            if key is None:
                raise HTTPException(status_code=401, detail="Unknown signing key")

            public_key = jwk.construct(key, algorithm="ES256")
            payload = jwt.decode(token, public_key, algorithms=["ES256"], audience="authenticated")

        else:
            raise HTTPException(status_code=401, detail=f"Unsupported algorithm: {alg}")

        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")
        return user_id

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
