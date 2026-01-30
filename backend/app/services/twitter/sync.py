"""
Main Twitter synchronization service
Orchestrates fetching mentions, parsing, classifying, and storing issues
"""
import base64
import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, List

from supabase import Client

from .client import TwitterClient, RateLimitError, TwitterAPIError
from .parser import TweetParser, ParsedTweet

logger = logging.getLogger(__name__)


class TwitterSyncService:
    """Orchestrates Twitter mention fetching and issue creation"""

    def __init__(
        self,
        supabase: Client,
        twitter_client: TwitterClient,
        civicsense_user_id: str,
        classify_func=None  # AI classification function
    ):
        self.supabase = supabase
        self.twitter = twitter_client
        self.civicsense_user_id = civicsense_user_id
        self.parser = TweetParser()
        self.classify_func = classify_func

    async def sync_mentions(self) -> Dict:
        """
        Main sync method - fetch new mentions and create issues

        Returns:
            Dict with sync statistics:
            {
                "tweets_fetched": int,
                "issues_created": int,
                "duplicates_skipped": int,
                "errors": int,
                "pending_location": int
            }
        """
        stats = {
            "tweets_fetched": 0,
            "issues_created": 0,
            "duplicates_skipped": 0,
            "errors": 0,
            "pending_location": 0
        }

        try:
            # Get sync state
            sync_state = await self._get_sync_state()
            since_id = sync_state.get("last_mention_id")

            # Fetch mentions
            logger.info(f"Fetching mentions since_id={since_id}")
            response = await self.twitter.get_mentions(
                self.civicsense_user_id,
                since_id=since_id
            )

            tweets = response.get("data", [])
            if not tweets:
                logger.info("No new mentions found")
                return stats

            stats["tweets_fetched"] = len(tweets)
            logger.info(f"Found {len(tweets)} new mentions")

            # Build lookup maps for included data
            users_map = {}
            for user in response.get("includes", {}).get("users", []):
                users_map[user["id"]] = user

            media_map = {}
            for media in response.get("includes", {}).get("media", []):
                media_map[media["media_key"]] = media

            # Process each tweet
            newest_id = None
            for tweet in tweets:
                tweet_id = tweet["id"]

                # Track newest for pagination
                if newest_id is None or tweet_id > newest_id:
                    newest_id = tweet_id

                # Check for duplicate
                existing = self.supabase.table('issues')\
                    .select('id')\
                    .eq('twitter_tweet_id', tweet_id)\
                    .execute()

                if existing.data:
                    stats["duplicates_skipped"] += 1
                    logger.debug(f"Skipping duplicate tweet: {tweet_id}")
                    continue

                try:
                    # Get user data
                    author_id = tweet["author_id"]
                    user_data = users_map.get(author_id, {})

                    # Get media data
                    media_data = None
                    if tweet.get("attachments", {}).get("media_keys"):
                        media_data = [
                            media_map[key]
                            for key in tweet["attachments"]["media_keys"]
                            if key in media_map
                        ]

                    # Parse tweet
                    parsed = self.parser.parse_tweet(
                        tweet["text"],
                        tweet,
                        user_data,
                        media_data
                    )

                    # Create issue
                    issue = await self._create_issue_from_tweet(
                        tweet, user_data, parsed
                    )

                    if issue:
                        stats["issues_created"] += 1
                        if issue.get("location_status") == "pending":
                            stats["pending_location"] += 1
                        logger.info(f"Created issue {issue['id']} from tweet {tweet_id}")

                except Exception as e:
                    logger.error(f"Error processing tweet {tweet_id}: {str(e)}", exc_info=True)
                    stats["errors"] += 1

            # Update sync state
            if newest_id:
                await self._update_sync_state(newest_id, stats)

        except RateLimitError:
            logger.warning("Rate limited, will retry later")
        except TwitterAPIError as e:
            logger.error(f"Twitter API error: {str(e)}")
            stats["errors"] += 1
        except Exception as e:
            logger.error(f"Sync error: {str(e)}", exc_info=True)
            stats["errors"] += 1

        return stats

    async def _create_issue_from_tweet(
        self,
        tweet: Dict,
        user_data: Dict,
        parsed: ParsedTweet
    ) -> Optional[Dict]:
        """Create an issue document from parsed tweet"""

        # Build location object
        location_status = "resolved"
        location_latitude = 28.6139  # Default Delhi
        location_longitude = 77.2090
        location_city = parsed.extracted_city or "Delhi"
        location_area = parsed.extracted_location
        location_address = parsed.extracted_location

        # Use parsed coordinates if available
        if parsed.geotag_coords:
            location_latitude = parsed.geotag_coords[0]
            location_longitude = parsed.geotag_coords[1]
        elif parsed.location_confidence == "none":
            # Mark as pending location if we couldn't extract any location info
            location_status = "pending"
            location_area = "Location needed"

        # Get AI classification if available
        category = "general"
        sub_category = None
        ai_suggested_officials = []

        if self.classify_func:
            try:
                # Build a location-like object for classification
                location_obj = type('Location', (), {
                    'latitude': location_latitude,
                    'longitude': location_longitude,
                    'city': location_city,
                    'area': location_area,
                    'address': location_address
                })()

                ai_result = await self.classify_func(
                    parsed.title,
                    parsed.description,
                    location_obj
                )
                category = ai_result.category or "general"
                sub_category = ai_result.sub_category
                ai_suggested_officials = [o.get('id') for o in ai_result.suggested_officials if o.get('id')]
            except Exception as e:
                logger.warning(f"AI classification failed: {e}, using text-based hint")
                # Fallback to text-based category suggestion
                suggested = self.parser.suggest_category_from_text(parsed.description)
                if suggested:
                    category = suggested

        # Download and convert media to base64
        photos = []
        if parsed.media_urls:
            for url in parsed.media_urls[:5]:  # Max 5 photos
                try:
                    image_data = await self.twitter.download_media(url)
                    # Detect image type (simplified)
                    content_type = "image/jpeg"
                    if url.lower().endswith(".png"):
                        content_type = "image/png"
                    base64_image = f"data:{content_type};base64,{base64.b64encode(image_data).decode()}"
                    photos.append(base64_image)
                except Exception as e:
                    logger.warning(f"Failed to download media from {url}: {e}")

        # Parse tweet creation time
        tweet_created_at = datetime.utcnow().isoformat()
        if tweet.get("created_at"):
            try:
                tweet_created_at = datetime.fromisoformat(
                    tweet["created_at"].replace("Z", "+00:00")
                ).isoformat()
            except Exception:
                pass

        # Build display name for the reporter
        reporter_name = user_data.get("name") or f"@{user_data.get('username', 'Twitter User')}"

        # Create issue document for Supabase
        issue_id = str(uuid.uuid4())
        issue_dict = {
            "id": issue_id,
            "user_id": None,  # Twitter users don't have our user IDs
            "user_name": reporter_name,
            "title": parsed.title,
            "description": parsed.description,
            "category": category,
            "sub_category": sub_category,
            "photos": photos,
            "location_latitude": location_latitude,
            "location_longitude": location_longitude,
            "location_address": location_address,
            "location_area": location_area,
            "location_city": location_city,
            "status": "pending",
            "ai_suggested_category": category,
            "ai_suggested_officials": ai_suggested_officials,
            "upvotes": 0,
            "upvoted_by": [],
            # Twitter-specific fields
            "source": "twitter",
            "location_status": location_status,
            "twitter_tweet_id": tweet["id"],
            "twitter_user_id": tweet["author_id"],
            "twitter_username": user_data.get("username", "unknown"),
            "twitter_display_name": user_data.get("name"),
            "twitter_profile_image": user_data.get("profile_image_url"),
            "twitter_tweet_text": tweet["text"],
            "twitter_tweet_url": f"https://twitter.com/{user_data.get('username', 'i')}/status/{tweet['id']}",
            "twitter_tweet_created_at": tweet_created_at,
            "twitter_has_media": len(photos) > 0,
            "twitter_media_urls": parsed.media_urls,
            "twitter_hashtags": parsed.hashtags,
            "twitter_retweet_count": tweet.get("public_metrics", {}).get("retweet_count", 0),
            "twitter_like_count": tweet.get("public_metrics", {}).get("like_count", 0),
            "twitter_reply_count": tweet.get("public_metrics", {}).get("reply_count", 0),
            "twitter_fetched_at": datetime.utcnow().isoformat()
        }

        result = self.supabase.table('issues').insert(issue_dict).execute()

        return result.data[0] if result.data else None

    async def _get_sync_state(self) -> Dict:
        """Get or create sync state document"""
        result = self.supabase.table('twitter_sync_state')\
            .select('*')\
            .eq('id', 'twitter_sync')\
            .execute()

        if not result.data:
            # Create initial state
            state = {
                "id": "twitter_sync",
                "last_mention_id": None,
                "last_sync_at": datetime.utcnow().isoformat(),
                "total_tweets_processed": 0,
                "total_issues_created": 0
            }
            self.supabase.table('twitter_sync_state').insert(state).execute()
            return state

        return result.data[0]

    async def _update_sync_state(self, newest_id: str, stats: Dict):
        """Update sync state after successful sync"""
        # Get current state
        current = await self._get_sync_state()

        new_data = {
            "last_mention_id": newest_id,
            "last_sync_at": datetime.utcnow().isoformat(),
            "total_tweets_processed": current.get("total_tweets_processed", 0) + stats["tweets_fetched"],
            "total_issues_created": current.get("total_issues_created", 0) + stats["issues_created"]
        }

        self.supabase.table('twitter_sync_state')\
            .update(new_data)\
            .eq('id', 'twitter_sync')\
            .execute()

    async def get_sync_stats(self) -> Dict:
        """Get Twitter sync statistics for admin dashboard"""
        sync_state = await self._get_sync_state()

        # Count Twitter-sourced issues
        twitter_issues_result = self.supabase.table('issues')\
            .select('id', count='exact')\
            .eq('source', 'twitter')\
            .execute()
        twitter_issues = twitter_issues_result.count or 0

        pending_twitter_result = self.supabase.table('issues')\
            .select('id', count='exact')\
            .eq('source', 'twitter')\
            .eq('status', 'pending')\
            .execute()
        pending_twitter = pending_twitter_result.count or 0

        pending_location_result = self.supabase.table('issues')\
            .select('id', count='exact')\
            .eq('source', 'twitter')\
            .eq('location_status', 'pending')\
            .execute()
        pending_location = pending_location_result.count or 0

        # Top Twitter reporters - aggregate in Python
        twitter_issues_data = self.supabase.table('issues')\
            .select('twitter_username, twitter_display_name')\
            .eq('source', 'twitter')\
            .execute()

        reporter_counts = {}
        for issue in twitter_issues_data.data:
            username = issue.get('twitter_username')
            if username:
                if username not in reporter_counts:
                    reporter_counts[username] = {
                        'count': 0,
                        'display_name': issue.get('twitter_display_name')
                    }
                reporter_counts[username]['count'] += 1

        top_reporters = sorted(
            [{'username': k, 'display_name': v['display_name'], 'count': v['count']}
             for k, v in reporter_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )[:10]

        return {
            "sync_state": {
                "last_mention_id": sync_state.get("last_mention_id"),
                "last_sync_at": sync_state.get("last_sync_at"),
                "total_tweets_processed": sync_state.get("total_tweets_processed", 0),
                "total_issues_created": sync_state.get("total_issues_created", 0)
            },
            "total_twitter_issues": twitter_issues,
            "pending_twitter_issues": pending_twitter,
            "pending_location_issues": pending_location,
            "top_reporters": top_reporters
        }
