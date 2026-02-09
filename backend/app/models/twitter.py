"""
Twitter integration models for CivicSense
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class ProcessedTweet(BaseModel):
    """Tracks processed Twitter mentions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tweet_id: str  # Twitter's tweet ID (unique, used for dedup)
    issue_id: Optional[str] = None  # Created issue ID (null if skipped)
    twitter_user_id: str  # Author's Twitter user ID
    twitter_handle: str  # Author's @handle
    tweet_text: str  # Original tweet text
    media_urls: list = []  # Media attachment URLs from tweet
    status: str = "pending"  # "processed", "skipped", "failed"
    skip_reason: Optional[str] = None  # e.g. "not_civic_issue", "duplicate", "low_confidence"
    reply_tweet_id: Optional[str] = None  # Our reply tweet ID
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TwitterConfig(BaseModel):
    """Polling state for Twitter integration"""
    since_id: Optional[str] = None  # Last processed tweet ID
    last_poll_time: Optional[datetime] = None
    total_processed: int = 0
    total_issues_created: int = 0
    total_skipped: int = 0
    total_failed: int = 0
    last_error: Optional[str] = None
    last_error_time: Optional[datetime] = None


class TweetParseResult(BaseModel):
    """Result of AI parsing a tweet into issue data"""
    is_civic_issue: bool = False
    title: str = ""
    description: str = ""
    category: str = "general"
    sub_category: Optional[str] = None
    area: Optional[str] = None
    city: str = "Delhi"
    confidence: float = 0.0
