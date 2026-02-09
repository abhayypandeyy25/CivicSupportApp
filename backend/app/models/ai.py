from pydantic import BaseModel
from typing import List, Optional

from .user import Location


class AIClassificationRequest(BaseModel):
    """AI classification request model"""
    title: str
    description: str
    location: Optional[Location] = None


class AIClassificationResponse(BaseModel):
    """AI classification response model"""
    category: str
    sub_category: Optional[str] = None
    suggested_officials: List[dict] = []
    confidence: float = 0.0
