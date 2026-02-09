"""
Twitter integration admin endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
import logging

from ...database import get_database
from ...config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twitter", tags=["Twitter"])


@router.get("/status")
async def get_twitter_status():
    """Get Twitter integration status and polling stats"""
    db = get_database()
    config = await db.twitter_config.find_one({"_id": "poll_state"})

    return {
        "enabled": settings.TWITTER_ENABLED,
        "account_id": settings.TWITTER_ACCOUNT_ID or "not configured",
        "poll_interval_seconds": settings.TWITTER_POLL_INTERVAL_SECONDS,
        "since_id": config.get("since_id") if config else None,
        "last_poll_time": config.get("last_poll_time") if config else None,
        "total_processed": config.get("total_processed", 0) if config else 0,
        "total_issues_created": config.get("total_issues_created", 0) if config else 0,
        "total_skipped": config.get("total_skipped", 0) if config else 0,
        "total_failed": config.get("total_failed", 0) if config else 0,
        "last_error": config.get("last_error") if config else None,
        "last_error_time": config.get("last_error_time") if config else None,
    }


@router.post("/poll")
async def trigger_poll():
    """Manually trigger a Twitter poll cycle (for testing)"""
    if not settings.TWITTER_ENABLED:
        raise HTTPException(status_code=400, detail="Twitter integration is disabled")

    try:
        from ...services.twitter_service import TwitterService
        service = TwitterService()
        await service.poll_mentions()
        return {"message": "Poll cycle completed", "status": "ok"}
    except Exception as e:
        logger.error(f"Manual poll failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Poll failed: {str(e)}")


@router.get("/processed")
async def get_processed_tweets(
    limit: int = 20,
    status: Optional[str] = None
):
    """List recently processed tweets"""
    db = get_database()
    query = {}
    if status:
        query["status"] = status

    tweets = await db.processed_tweets.find(query).sort(
        "created_at", -1
    ).limit(limit).to_list(limit)

    return [
        {
            "id": t.get("id"),
            "tweet_id": t.get("tweet_id"),
            "twitter_handle": t.get("twitter_handle"),
            "tweet_text": t.get("tweet_text", "")[:200],
            "status": t.get("status"),
            "skip_reason": t.get("skip_reason"),
            "issue_id": t.get("issue_id"),
            "reply_tweet_id": t.get("reply_tweet_id"),
            "error_message": t.get("error_message"),
            "created_at": t.get("created_at"),
        }
        for t in tweets
    ]
