"""
User endpoints
"""
from fastapi import APIRouter, Depends
from datetime import datetime

from ...models import User, UserCreate, UserUpdate, Location
from ...database import get_database
from ..deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=User)
async def create_or_update_user(user_data: UserCreate):
    """Create or update user after Firebase authentication"""
    db = get_database()
    existing_user = await db.users.find_one({"firebase_uid": user_data.firebase_uid})

    if existing_user:
        # Update existing user
        update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        await db.users.update_one(
            {"firebase_uid": user_data.firebase_uid},
            {"$set": update_data}
        )
        updated_user = await db.users.find_one({"firebase_uid": user_data.firebase_uid})
        return User(**updated_user)

    # Create new user
    new_user = User(**user_data.model_dump())
    await db.users.insert_one(new_user.model_dump())
    return new_user


@router.get("/me", response_model=User)
async def get_current_user_profile(user: User = Depends(get_current_user)):
    """Get current user profile"""
    return user


@router.put("/me", response_model=User)
async def update_user_profile(
    user_update: UserUpdate,
    user: User = Depends(get_current_user)
):
    """Update current user profile"""
    db = get_database()
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    if update_data:
        update_data['updated_at'] = datetime.utcnow()
        await db.users.update_one(
            {"id": user.id},
            {"$set": update_data}
        )

    updated_user = await db.users.find_one({"id": user.id})
    return User(**updated_user)


@router.put("/me/location", response_model=User)
async def update_user_location(
    location: Location,
    user: User = Depends(get_current_user)
):
    """Update user's current location"""
    db = get_database()
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"location": location.model_dump(), "updated_at": datetime.utcnow()}}
    )
    updated_user = await db.users.find_one({"id": user.id})
    return User(**updated_user)
