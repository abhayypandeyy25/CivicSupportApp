"""
CivicSense API - Main Application Entry Point
"""
from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
from pathlib import Path
from dotenv import load_dotenv

import firebase_admin

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Import after loading env
from .config import settings
from .database import database
from .api.v1.router import api_router
from .middleware.security import SecurityHeadersMiddleware

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Sentry for error tracking (if configured)
if settings.SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=1.0 if settings.is_development else 0.1,
        profiles_sample_rate=1.0 if settings.is_development else 0.1,
    )
    logger.info(f"Sentry initialized for {settings.ENVIRONMENT} environment")
else:
    logger.warning("Sentry DSN not configured - error tracking disabled")

# Initialize Firebase Admin SDK
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(options={
        'projectId': settings.FIREBASE_PROJECT_ID
    })

# Create FastAPI app
app = FastAPI(
    title="CivicSense API",
    description="API for Civic Issues Reporting App",
    version="1.0.0"
)

# Rate Limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include API router
app.include_router(api_router)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.get_allowed_origins(),
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

# Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)


# Twitter polling scheduler (initialized on startup if enabled)
_scheduler = None
_twitter_service = None


@app.on_event("startup")
async def startup():
    """Initialize connections on startup"""
    global _scheduler, _twitter_service

    database.connect()
    logger.info("Database connected")

    # Start Twitter polling if enabled
    if settings.TWITTER_ENABLED:
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from .services.twitter_service import TwitterService

            _twitter_service = TwitterService()
            _scheduler = AsyncIOScheduler()
            _scheduler.add_job(
                _twitter_service.poll_mentions,
                'interval',
                seconds=settings.TWITTER_POLL_INTERVAL_SECONDS,
                id='twitter_poll',
                name='Poll Twitter mentions'
            )
            _scheduler.start()
            logger.info(f"Twitter polling started (every {settings.TWITTER_POLL_INTERVAL_SECONDS}s)")
        except Exception as e:
            logger.error(f"Failed to start Twitter polling: {str(e)}", exc_info=True)
    else:
        logger.info("Twitter integration disabled (TWITTER_ENABLED=false)")


@app.on_event("shutdown")
async def shutdown():
    """Clean up connections on shutdown"""
    global _scheduler

    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("Twitter polling stopped")

    database.close()
    logger.info("Database connection closed")
