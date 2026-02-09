"""
Shared dependencies for API routes
"""
from typing import Optional
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

import firebase_admin
from firebase_admin import auth as firebase_auth

from ..database import get_database
from ..models import User

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


async def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify Firebase ID token and return user info"""
    try:
        token = credentials.credentials
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(e)}")


async def get_current_user(token_data: dict = Depends(verify_firebase_token)) -> User:
    """Get current user from database or create if not exists"""
    db = get_database()
    firebase_uid = token_data.get('uid')
    user = await db.users.find_one({"firebase_uid": firebase_uid})

    if not user:
        # Create new user
        new_user = User(
            firebase_uid=firebase_uid,
            phone_number=token_data.get('phone_number'),
            email=token_data.get('email'),
            display_name=token_data.get('name') or token_data.get('email', '').split('@')[0],
            photo_url=token_data.get('picture')
        )
        await db.users.insert_one(new_user.model_dump())
        return new_user

    return User(**user)


async def verify_admin(user: User = Depends(get_current_user)) -> User:
    """Verify user is admin"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# Optional authentication - returns None if no token provided
security_optional = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security_optional)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        decoded_token = firebase_auth.verify_id_token(token)
        db = get_database()
        firebase_uid = decoded_token.get('uid')
        user = await db.users.find_one({"firebase_uid": firebase_uid})
        if user:
            return User(**user)
        return None
    except Exception:
        return None
