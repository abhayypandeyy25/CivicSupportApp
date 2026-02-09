from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
import uuid
import math

from .user import Location


class Comment(BaseModel):
    """Comment on an issue"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    text: str = Field(..., min_length=1, max_length=1000)
    is_official: bool = False  # True if from a government official
    official_designation: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CommentCreate(BaseModel):
    """Comment creation request"""
    text: str = Field(..., min_length=1, max_length=1000)


class TimelineEvent(BaseModel):
    """Status change or event in issue lifecycle"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # created, status_change, assigned, comment_added, upvote_milestone
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    description: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Issue(BaseModel):
    """Civic issue model"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: Optional[str] = None
    title: str
    description: str
    category: str  # roads, sanitation, water, electricity, etc.
    sub_category: Optional[str] = None
    photos: List[str] = []  # Base64 encoded images
    location: Location
    status: str = "pending"  # pending, in_progress, resolved, closed
    ai_suggested_category: Optional[str] = None
    ai_suggested_officials: List[str] = []  # List of official IDs
    assigned_official_id: Optional[str] = None
    assigned_official_name: Optional[str] = None
    upvotes: int = 0
    upvoted_by: List[str] = []  # List of user IDs
    comments: List[Comment] = []  # Comments on the issue
    timeline: List[TimelineEvent] = []  # Status history/events
    priority_score: float = 0.0  # Calculated priority score
    view_count: int = 0  # Number of views
    source: str = "app"  # "app" or "twitter"
    source_meta: Optional[dict] = None  # {tweet_id, tweet_url, twitter_user, twitter_handle}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


def calculate_priority_score(issue_dict: dict) -> float:
    """Calculate priority score based on various factors"""
    now = datetime.utcnow()
    created_at = issue_dict.get('created_at', now)
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    age_hours = (now - created_at).total_seconds() / 3600

    upvotes = issue_dict.get('upvotes', 0)
    comments = issue_dict.get('comments', [])
    category = issue_dict.get('category', 'general')
    status = issue_dict.get('status', 'pending')

    # Base score from upvotes (logarithmic scale)
    upvote_score = math.log10(max(1, upvotes + 1)) * 20

    # Recency bonus (issues less than 24 hours old get a boost)
    recency_score = max(0, 20 - (age_hours / 24) * 10) if age_hours < 48 else 0

    # Engagement score (comments indicate community interest)
    comment_score = min(15, len(comments) * 3)

    # Urgency boost for certain categories
    urgent_categories = ['public_safety', 'water', 'electricity', 'health']
    category_score = 15 if category in urgent_categories else 0

    # Penalty for old unresolved issues (more than 7 days)
    age_penalty = min(20, (age_hours / 168) * 5) if age_hours > 168 and status == 'pending' else 0

    # Status factor
    status_multipliers = {
        'pending': 1.0,
        'in_progress': 0.8,
        'resolved': 0.3,
        'closed': 0.1
    }
    status_mult = status_multipliers.get(status, 1.0)

    total = (upvote_score + recency_score + comment_score + category_score - age_penalty) * status_mult
    return round(max(0, total), 2)


class IssueCreate(BaseModel):
    """Issue creation request model"""
    title: str = Field(..., min_length=5, max_length=200, description="Issue title")
    description: str = Field(..., min_length=10, max_length=2000, description="Detailed description")
    category: str = Field(..., min_length=1, max_length=100)
    sub_category: Optional[str] = Field(None, max_length=100)
    photos: List[str] = Field(default=[], min_length=1, max_length=5, description="1-5 base64 encoded images")
    location: Location

    @field_validator('photos')
    @classmethod
    def validate_photo_size(cls, v):
        """Validate each photo is not too large (max ~5MB base64)"""
        max_size = 5_000_000  # ~5MB when base64 encoded
        for idx, photo in enumerate(v):
            if len(photo) > max_size:
                raise ValueError(f'Photo {idx+1} exceeds maximum size of 5MB')
            # Basic base64 validation
            if not photo.startswith('data:image/'):
                raise ValueError(f'Photo {idx+1} must be a valid base64 image with data URI')
        return v


class IssueUpdate(BaseModel):
    """Issue update request model"""
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    status: Optional[str] = None
    assigned_official_id: Optional[str] = None
