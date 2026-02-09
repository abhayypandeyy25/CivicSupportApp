"""
Categories and stats endpoints
"""
from fastapi import APIRouter

from ...database import get_database

router = APIRouter(tags=["Categories"])


@router.get("/categories")
async def get_categories():
    """Get available issue categories"""
    return {
        "categories": [
            {"id": "roads", "name": "Roads & Traffic", "icon": "road"},
            {"id": "sanitation", "name": "Sanitation & Garbage", "icon": "trash"},
            {"id": "water", "name": "Water Supply", "icon": "water"},
            {"id": "electricity", "name": "Electricity", "icon": "bolt"},
            {"id": "encroachment", "name": "Encroachment", "icon": "building"},
            {"id": "parks", "name": "Parks & Playgrounds", "icon": "tree"},
            {"id": "public_safety", "name": "Public Safety", "icon": "shield"},
            {"id": "health", "name": "Health & Hospitals", "icon": "medkit"},
            {"id": "education", "name": "Education", "icon": "school"},
            {"id": "transport", "name": "Public Transport", "icon": "bus"},
            {"id": "housing", "name": "Housing", "icon": "home"},
            {"id": "general", "name": "General", "icon": "info-circle"}
        ]
    }


@router.get("/stats")
async def get_stats():
    """Get platform statistics"""
    db = get_database()
    total_issues = await db.issues.count_documents({})
    pending_issues = await db.issues.count_documents({"status": "pending"})
    resolved_issues = await db.issues.count_documents({"status": "resolved"})
    total_users = await db.users.count_documents({})
    total_officials = await db.govt_officials.count_documents({"is_active": True})

    # Category breakdown
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    category_stats = await db.issues.aggregate(pipeline).to_list(20)

    return {
        "total_issues": total_issues,
        "pending_issues": pending_issues,
        "resolved_issues": resolved_issues,
        "total_users": total_users,
        "total_officials": total_officials,
        "categories": {stat['_id']: stat['count'] for stat in category_stats}
    }
