"""
Twitter Integration Service for CivicSense
Polls Twitter API v2 for mentions of @CivicSupportIN and creates issues from tweets.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

import tweepy

from ..config import settings
from ..database import get_database
from ..models import Issue, ProcessedTweet, TweetParseResult, TimelineEvent
from ..models.issue import calculate_priority_score
from .ai_service import parse_tweet_to_issue, classify_issue_with_ai
from ..models.user import Location

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.6


class TwitterService:
    """Handles Twitter API polling, tweet processing, and issue creation"""

    def __init__(self):
        self.read_client: Optional[tweepy.Client] = None
        self.write_client: Optional[tweepy.Client] = None
        self._init_clients()

    def _init_clients(self):
        """Initialize Tweepy v2 clients"""
        if not settings.TWITTER_BEARER_TOKEN:
            logger.warning("TWITTER_BEARER_TOKEN not configured")
            return

        # Read-only client (bearer token auth)
        self.read_client = tweepy.Client(
            bearer_token=settings.TWITTER_BEARER_TOKEN,
            wait_on_rate_limit=True
        )

        # Write client (OAuth1 for posting replies)
        if all([settings.TWITTER_API_KEY, settings.TWITTER_API_SECRET,
                settings.TWITTER_ACCESS_TOKEN, settings.TWITTER_ACCESS_SECRET]):
            self.write_client = tweepy.Client(
                consumer_key=settings.TWITTER_API_KEY,
                consumer_secret=settings.TWITTER_API_SECRET,
                access_token=settings.TWITTER_ACCESS_TOKEN,
                access_token_secret=settings.TWITTER_ACCESS_SECRET,
                wait_on_rate_limit=True
            )
        else:
            logger.warning("Twitter write credentials incomplete - replies will be disabled")

    async def get_since_id(self) -> Optional[str]:
        """Get the last processed tweet ID from MongoDB"""
        db = get_database()
        config = await db.twitter_config.find_one({"_id": "poll_state"})
        if config:
            return config.get("since_id")
        return None

    async def set_since_id(self, tweet_id: str):
        """Store the latest processed tweet ID"""
        db = get_database()
        await db.twitter_config.update_one(
            {"_id": "poll_state"},
            {"$set": {
                "since_id": tweet_id,
                "last_poll_time": datetime.utcnow()
            }},
            upsert=True
        )

    async def update_stats(self, processed: int = 0, created: int = 0, skipped: int = 0, failed: int = 0):
        """Update polling statistics"""
        db = get_database()
        update = {"$set": {"last_poll_time": datetime.utcnow()}}
        inc = {}
        if processed:
            inc["total_processed"] = processed
        if created:
            inc["total_issues_created"] = created
        if skipped:
            inc["total_skipped"] = skipped
        if failed:
            inc["total_failed"] = failed
        if inc:
            update["$inc"] = inc
        await db.twitter_config.update_one(
            {"_id": "poll_state"},
            update,
            upsert=True
        )

    async def record_error(self, error_message: str):
        """Record the last error"""
        db = get_database()
        await db.twitter_config.update_one(
            {"_id": "poll_state"},
            {"$set": {
                "last_error": error_message,
                "last_error_time": datetime.utcnow()
            }},
            upsert=True
        )

    async def is_duplicate(self, tweet_id: str) -> bool:
        """Check if a tweet has already been processed"""
        db = get_database()
        existing = await db.processed_tweets.find_one({"tweet_id": tweet_id})
        return existing is not None

    async def store_processed_tweet(self, processed_tweet: ProcessedTweet):
        """Store a processed tweet record"""
        db = get_database()
        await db.processed_tweets.insert_one(processed_tweet.model_dump())

    async def create_issue_from_tweet(
        self,
        parse_result: TweetParseResult,
        twitter_handle: str,
        tweet_id: str,
        tweet_text: str,
        media_urls: list = None
    ) -> str:
        """Create an Issue document in MongoDB from parsed tweet data"""
        db = get_database()

        # Build location
        location = Location(
            latitude=28.6139,  # Default Delhi coordinates
            longitude=77.2090,
            area=parse_result.area,
            city=parse_result.city or "Delhi"
        )

        # Run AI classification for official suggestions
        ai_result = await classify_issue_with_ai(
            parse_result.title,
            parse_result.description,
            location
        )

        tweet_url = f"https://twitter.com/{twitter_handle}/status/{tweet_id}"

        new_issue = Issue(
            user_id="twitter_bot",
            user_name=f"@{twitter_handle}",
            title=parse_result.title,
            description=parse_result.description,
            category=parse_result.category,
            sub_category=parse_result.sub_category,
            photos=[],  # No photos required for Twitter issues
            location=location,
            ai_suggested_category=ai_result.category,
            ai_suggested_officials=[o['id'] for o in ai_result.suggested_officials],
            source="twitter",
            source_meta={
                "tweet_id": tweet_id,
                "tweet_url": tweet_url,
                "twitter_handle": twitter_handle,
            }
        )

        issue_dict = new_issue.model_dump()
        issue_dict['location']['coordinates'] = [
            location.longitude,
            location.latitude
        ]

        # Add timeline event
        event = TimelineEvent(
            event_type="created",
            description=f"Issue reported via Twitter by @{twitter_handle}",
            user_id="twitter_bot",
            user_name=f"@{twitter_handle}"
        )
        issue_dict['timeline'] = [event.model_dump()]

        # Calculate priority score
        issue_dict['priority_score'] = calculate_priority_score(issue_dict)

        await db.issues.insert_one(issue_dict)
        logger.info(f"Issue created from tweet {tweet_id}: {new_issue.id}")
        return new_issue.id

    def reply_to_tweet(self, tweet_id: str, handle: str) -> Optional[str]:
        """Reply to a tweet confirming the issue was logged"""
        if not self.write_client:
            logger.warning("Write client not configured, skipping reply")
            return None

        try:
            reply_text = f"Thanks @{handle}! Your civic issue has been logged on CivicSense. We'll track it and push for resolution."
            response = self.write_client.create_tweet(
                text=reply_text,
                in_reply_to_tweet_id=tweet_id
            )
            reply_id = str(response.data['id'])
            logger.info(f"Replied to tweet {tweet_id} with reply {reply_id}")
            return reply_id
        except Exception as e:
            logger.error(f"Failed to reply to tweet {tweet_id}: {str(e)}")
            return None

    async def process_tweet(self, tweet_data: dict, author_handle: str) -> None:
        """Process a single tweet: parse, create issue, reply"""
        tweet_id = str(tweet_data['id'])
        tweet_text = tweet_data['text']

        # Check for duplicates
        if await self.is_duplicate(tweet_id):
            logger.debug(f"Skipping duplicate tweet {tweet_id}")
            return

        try:
            # Parse tweet with AI
            parse_result = await parse_tweet_to_issue(tweet_text, author_handle)

            if not parse_result.is_civic_issue:
                processed = ProcessedTweet(
                    tweet_id=tweet_id,
                    twitter_user_id=str(tweet_data.get('author_id', '')),
                    twitter_handle=author_handle,
                    tweet_text=tweet_text,
                    status="skipped",
                    skip_reason="not_civic_issue"
                )
                await self.store_processed_tweet(processed)
                await self.update_stats(processed=1, skipped=1)
                logger.info(f"Tweet {tweet_id} skipped: not a civic issue")
                return

            if parse_result.confidence < CONFIDENCE_THRESHOLD:
                processed = ProcessedTweet(
                    tweet_id=tweet_id,
                    twitter_user_id=str(tweet_data.get('author_id', '')),
                    twitter_handle=author_handle,
                    tweet_text=tweet_text,
                    status="skipped",
                    skip_reason=f"low_confidence ({parse_result.confidence:.2f})"
                )
                await self.store_processed_tweet(processed)
                await self.update_stats(processed=1, skipped=1)
                logger.info(f"Tweet {tweet_id} skipped: low confidence {parse_result.confidence}")
                return

            # Create the issue
            issue_id = await self.create_issue_from_tweet(
                parse_result=parse_result,
                twitter_handle=author_handle,
                tweet_id=tweet_id,
                tweet_text=tweet_text
            )

            # Reply to the tweet
            reply_id = self.reply_to_tweet(tweet_id, author_handle)

            # Record as processed
            processed = ProcessedTweet(
                tweet_id=tweet_id,
                issue_id=issue_id,
                twitter_user_id=str(tweet_data.get('author_id', '')),
                twitter_handle=author_handle,
                tweet_text=tweet_text,
                status="processed",
                reply_tweet_id=reply_id
            )
            await self.store_processed_tweet(processed)
            await self.update_stats(processed=1, created=1)
            logger.info(f"Tweet {tweet_id} processed → issue {issue_id}")

        except Exception as e:
            logger.error(f"Error processing tweet {tweet_id}: {str(e)}", exc_info=True)
            processed = ProcessedTweet(
                tweet_id=tweet_id,
                twitter_user_id=str(tweet_data.get('author_id', '')),
                twitter_handle=author_handle,
                tweet_text=tweet_text,
                status="failed",
                error_message=str(e)
            )
            await self.store_processed_tweet(processed)
            await self.update_stats(processed=1, failed=1)
            await self.record_error(str(e))

    async def poll_mentions(self):
        """Main polling loop: fetch new mentions and process each"""
        if not self.read_client:
            logger.error("Twitter read client not initialized")
            return

        if not settings.TWITTER_ACCOUNT_ID:
            logger.error("TWITTER_ACCOUNT_ID not configured")
            return

        try:
            since_id = await self.get_since_id()
            logger.info(f"Polling Twitter mentions (since_id={since_id})")

            # Fetch mentions using Twitter API v2
            kwargs = {
                "id": settings.TWITTER_ACCOUNT_ID,
                "tweet_fields": ["created_at", "author_id", "text", "attachments"],
                "user_fields": ["username", "name"],
                "expansions": ["author_id", "attachments.media_keys"],
                "media_fields": ["url", "preview_image_url"],
                "max_results": 10,
            }
            if since_id:
                kwargs["since_id"] = since_id

            response = self.read_client.get_users_mentions(**kwargs)

            if not response.data:
                logger.debug("No new mentions found")
                await self.update_stats()
                return

            # Build author lookup from includes
            authors = {}
            if response.includes and 'users' in response.includes:
                for user in response.includes['users']:
                    authors[str(user.id)] = user.username

            # Process tweets (oldest first to maintain order)
            tweets = list(reversed(response.data))
            newest_id = None

            for tweet in tweets:
                tweet_dict = {
                    'id': str(tweet.id),
                    'text': tweet.text,
                    'author_id': str(tweet.author_id),
                    'created_at': tweet.created_at,
                }
                author_handle = authors.get(str(tweet.author_id), 'unknown')

                await self.process_tweet(tweet_dict, author_handle)
                newest_id = str(tweet.id)

            # Update since_id to newest tweet
            if newest_id:
                await self.set_since_id(newest_id)

            logger.info(f"Processed {len(tweets)} mentions")

        except Exception as e:
            logger.error(f"Twitter polling error: {str(e)}", exc_info=True)
            await self.record_error(str(e))
