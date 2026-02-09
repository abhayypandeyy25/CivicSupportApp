"""
Main API v1 router - aggregates all route modules
"""
from fastapi import APIRouter

from . import health, users, issues, officials, admin, categories, twitter

# Create the main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Include all route modules
api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(issues.router)
api_router.include_router(officials.router)
api_router.include_router(admin.router)
api_router.include_router(categories.router)
api_router.include_router(twitter.router)
