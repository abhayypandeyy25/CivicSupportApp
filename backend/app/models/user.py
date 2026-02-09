from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class Location(BaseModel):
    """Geographic location model"""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude must be between -90 and 90")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude must be between -180 and 180")
    address: Optional[str] = Field(None, max_length=500)
    area: Optional[str] = Field(None, max_length=200)
    city: str = Field("Delhi", max_length=100)


class User(BaseModel):
    """User model"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    firebase_uid: str = Field(..., min_length=1, max_length=128)
    phone_number: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    email: Optional[str] = Field(None, max_length=255)
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    photo_url: Optional[str] = Field(None, max_length=2048)
    location: Optional[Location] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_admin: bool = False


class UserCreate(BaseModel):
    """User creation request model"""
    firebase_uid: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    location: Optional[Location] = None


class UserUpdate(BaseModel):
    """User update request model"""
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    location: Optional[Location] = None
