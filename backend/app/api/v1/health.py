"""
Health check endpoints
"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter(tags=["Health"])


@router.get("/")
async def root():
    """Root endpoint"""
    return {"message": "CivicSense API - Civic Issues Reporting Platform"}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
