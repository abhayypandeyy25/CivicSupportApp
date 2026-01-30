"""
APScheduler configuration for Twitter polling
Manages background job scheduling for periodic Twitter mention fetching
"""
import logging
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None
_sync_service = None


def setup_twitter_scheduler(sync_service, poll_interval_minutes: int = 2):
    """
    Configure and start the Twitter polling scheduler

    Args:
        sync_service: TwitterSyncService instance
        poll_interval_minutes: How often to poll for new mentions (default: 2 minutes)
    """
    global _scheduler, _sync_service

    _sync_service = sync_service

    # Create scheduler if not exists
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()

    async def run_sync():
        """Execute Twitter sync job"""
        logger.info("Running scheduled Twitter sync...")
        try:
            stats = await _sync_service.sync_mentions()
            logger.info(
                f"Twitter sync complete: "
                f"fetched={stats['tweets_fetched']}, "
                f"created={stats['issues_created']}, "
                f"duplicates={stats['duplicates_skipped']}, "
                f"errors={stats['errors']}"
            )
        except Exception as e:
            logger.error(f"Scheduled sync failed: {e}", exc_info=True)

    # Remove existing job if any
    try:
        _scheduler.remove_job("twitter_mention_sync")
    except Exception:
        pass

    # Schedule the sync job
    _scheduler.add_job(
        run_sync,
        IntervalTrigger(minutes=poll_interval_minutes),
        id="twitter_mention_sync",
        replace_existing=True,
        max_instances=1  # Prevent overlapping syncs
    )

    # Start scheduler if not running
    if not _scheduler.running:
        _scheduler.start()
        logger.info(f"Twitter scheduler started (polling every {poll_interval_minutes} minutes)")


def shutdown_scheduler():
    """Gracefully shutdown scheduler"""
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Twitter scheduler stopped")


async def trigger_manual_sync() -> dict:
    """
    Trigger an immediate sync outside of the schedule

    Returns:
        Sync statistics dict
    """
    global _sync_service

    if _sync_service is None:
        raise RuntimeError("Twitter sync service not initialized")

    logger.info("Triggering manual Twitter sync...")
    return await _sync_service.sync_mentions()


def is_scheduler_running() -> bool:
    """Check if the scheduler is currently running"""
    global _scheduler
    return _scheduler is not None and _scheduler.running


def get_next_run_time():
    """Get the next scheduled sync time"""
    global _scheduler

    if _scheduler is None:
        return None

    job = _scheduler.get_job("twitter_mention_sync")
    if job:
        return job.next_run_time
    return None
