"""
Twitter API v2 Client for fetching mentions
Handles authentication and API communication with Twitter
"""
import httpx
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)


class TwitterAPIError(Exception):
    """Generic Twitter API error"""
    pass


class RateLimitError(TwitterAPIError):
    """Twitter API rate limit exceeded"""
    pass


class TwitterClient:
    """Twitter API v2 client for fetching mentions"""

    BASE_URL = "https://api.twitter.com/2"

    def __init__(self, bearer_token: str):
        self.bearer_token = bearer_token
        self.headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }

    async def get_user_id(self, username: str) -> Optional[str]:
        """
        Get Twitter user ID from username

        Args:
            username: Twitter username (without @)

        Returns:
            Twitter user ID or None if not found
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/users/by/username/{username}",
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    user_id = data.get("data", {}).get("id")
                    logger.info(f"Found Twitter user ID for @{username}: {user_id}")
                    return user_id
                elif response.status_code == 404:
                    logger.warning(f"Twitter user @{username} not found")
                    return None
                elif response.status_code == 429:
                    logger.warning("Twitter API rate limited on user lookup")
                    raise RateLimitError("Rate limit exceeded for user lookup")
                else:
                    logger.error(f"Twitter API error: {response.status_code} - {response.text}")
                    return None

            except httpx.TimeoutException:
                logger.error("Twitter API request timed out")
                raise TwitterAPIError("Request timed out")

    async def get_mentions(
        self,
        user_id: str,
        since_id: Optional[str] = None,
        max_results: int = 100
    ) -> Dict:
        """
        Fetch mentions of a Twitter account

        Args:
            user_id: Twitter user ID to fetch mentions for
            since_id: Only return tweets after this ID (for pagination)
            max_results: Maximum number of tweets to return (10-100)

        Returns:
            Dict with tweets, included users, media, and pagination info
            {
                "data": [...tweets...],
                "includes": {"users": [...], "media": [...]},
                "meta": {"newest_id": "...", "oldest_id": "...", "result_count": N}
            }
        """
        params = {
            "max_results": min(max_results, 100),
            "tweet.fields": "created_at,geo,entities,public_metrics,referenced_tweets,attachments,author_id",
            "expansions": "author_id,attachments.media_keys,geo.place_id",
            "user.fields": "name,username,profile_image_url,verified",
            "media.fields": "url,preview_image_url,type,width,height",
            "place.fields": "geo,name,full_name"
        }

        if since_id:
            params["since_id"] = since_id

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/users/{user_id}/mentions",
                    headers=self.headers,
                    params=params,
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    tweet_count = len(data.get("data", []))
                    logger.info(f"Fetched {tweet_count} mentions from Twitter")
                    return data
                elif response.status_code == 429:
                    logger.warning("Twitter API rate limit exceeded")
                    raise RateLimitError("Rate limit exceeded for mentions endpoint")
                else:
                    logger.error(f"Twitter API error: {response.status_code} - {response.text}")
                    raise TwitterAPIError(f"API error: {response.status_code}")

            except httpx.TimeoutException:
                logger.error("Twitter API request timed out")
                raise TwitterAPIError("Request timed out")

    async def download_media(self, media_url: str) -> bytes:
        """
        Download media (image) from Twitter

        Args:
            media_url: URL of the media to download

        Returns:
            Raw bytes of the media file
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(media_url, timeout=60.0)
                if response.status_code == 200:
                    logger.debug(f"Downloaded media from {media_url}")
                    return response.content
                else:
                    logger.warning(f"Failed to download media: {response.status_code}")
                    raise TwitterAPIError(f"Failed to download media: {response.status_code}")

            except httpx.TimeoutException:
                logger.error(f"Media download timed out: {media_url}")
                raise TwitterAPIError("Media download timed out")

    async def get_tweet(self, tweet_id: str) -> Optional[Dict]:
        """
        Get a single tweet by ID

        Args:
            tweet_id: Twitter tweet ID

        Returns:
            Tweet data or None if not found
        """
        params = {
            "tweet.fields": "created_at,geo,entities,public_metrics,referenced_tweets,attachments,author_id",
            "expansions": "author_id,attachments.media_keys",
            "user.fields": "name,username,profile_image_url",
            "media.fields": "url,preview_image_url,type"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/tweets/{tweet_id}",
                    headers=self.headers,
                    params=params,
                    timeout=30.0
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return None
                elif response.status_code == 429:
                    raise RateLimitError("Rate limit exceeded")
                else:
                    logger.error(f"Twitter API error: {response.status_code}")
                    return None

            except httpx.TimeoutException:
                logger.error("Twitter API request timed out")
                return None
