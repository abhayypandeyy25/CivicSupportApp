"""
Government officials endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional

from ...models import GovtOfficial
from ...database import get_database

router = APIRouter(prefix="/officials", tags=["Officials"])


@router.get("/hierarchy")
async def get_officials_by_hierarchy():
    """Get officials grouped by hierarchy level"""
    db = get_database()
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {
            "_id": "$hierarchy_level",
            "designation": {"$first": "$designation"},
            "count": {"$sum": 1},
            "officials": {"$push": {
                "id": "$_id",
                "name": "$name",
                "designation": "$designation",
                "department": "$department",
                "area": "$area"
            }}
        }},
        {"$sort": {"_id": 1}}
    ]

    result = await db.govt_officials.aggregate(pipeline).to_list(10)

    hierarchy_map = {
        1: "Parshad",
        2: "MCD",
        3: "IAS",
        4: "MLA",
        5: "MP",
        6: "CM",
        7: "PM"
    }

    return [
        {
            "level": r['_id'],
            "designation": hierarchy_map.get(r['_id'], r['designation']),
            "count": r['count'],
            "officials": r['officials'][:10]  # Limit to 10 per category for list
        }
        for r in result
    ]


@router.get("/{official_id}", response_model=GovtOfficial)
async def get_official(official_id: str):
    """Get a specific official by ID"""
    db = get_database()
    official = await db.govt_officials.find_one({"id": official_id})
    if not official:
        # Also try with _id field
        official = await db.govt_officials.find_one({"_id": official_id})
    if not official:
        raise HTTPException(status_code=404, detail="Official not found")
    return GovtOfficial(**official)


@router.get("/{official_id}/report-card")
async def get_official_report_card(official_id: str):
    """
    Get performance report card for a government official.

    Returns:
    - Total issues assigned
    - Issues resolved
    - Issues pending
    - Issues in progress
    - Average resolution time
    - Resolution rate
    - Category-wise breakdown
    - Recent activity
    - Performance score
    """
    db = get_database()

    # Find the official
    official = await db.govt_officials.find_one({"_id": official_id})
    if not official:
        official = await db.govt_officials.find_one({"id": official_id})
    if not official:
        raise HTTPException(status_code=404, detail="Official not found")

    # Get all issues assigned to this official
    issues = await db.issues.find({
        "$or": [
            {"assigned_official_id": official_id},
            {"assigned_official_id": official.get("_id")}
        ]
    }).to_list(1000)

    total_assigned = len(issues)
    resolved = len([i for i in issues if i.get("status") == "resolved"])
    in_progress = len([i for i in issues if i.get("status") == "in_progress"])
    pending = len([i for i in issues if i.get("status") == "pending"])

    # Calculate resolution rate
    resolution_rate = round((resolved / total_assigned * 100), 1) if total_assigned > 0 else 0

    # Calculate average resolution time (for resolved issues)
    resolution_times = []
    for issue in issues:
        if issue.get("status") == "resolved":
            created = issue.get("created_at")
            updated = issue.get("updated_at")
            if created and updated:
                delta = (updated - created).days
                resolution_times.append(delta)

    avg_resolution_days = round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else 0

    # Category breakdown
    category_counts = {}
    for issue in issues:
        cat = issue.get("category", "other")
        if cat not in category_counts:
            category_counts[cat] = {"total": 0, "resolved": 0, "pending": 0, "in_progress": 0}
        category_counts[cat]["total"] += 1
        status = issue.get("status", "pending")
        if status in category_counts[cat]:
            category_counts[cat][status] += 1

    categories_breakdown = [
        {
            "category": cat,
            "total": data["total"],
            "resolved": data["resolved"],
            "pending": data["pending"],
            "in_progress": data["in_progress"],
            "resolution_rate": round(data["resolved"] / data["total"] * 100, 1) if data["total"] > 0 else 0
        }
        for cat, data in category_counts.items()
    ]
    categories_breakdown.sort(key=lambda x: -x["total"])

    # Get recent resolved issues
    recent_resolved = [
        {
            "id": i.get("id"),
            "title": i.get("title"),
            "category": i.get("category"),
            "resolved_at": i.get("updated_at").isoformat() if i.get("updated_at") else None,
            "upvotes": i.get("upvotes", 0)
        }
        for i in sorted(
            [i for i in issues if i.get("status") == "resolved"],
            key=lambda x: x.get("updated_at") or x.get("created_at"),
            reverse=True
        )[:5]
    ]

    # Calculate performance score (0-100)
    # Based on: resolution rate (40%), speed (30%), volume (30%)
    rate_score = resolution_rate * 0.4
    speed_score = max(0, (30 - avg_resolution_days) / 30 * 100) * 0.3 if avg_resolution_days > 0 else 30
    volume_score = min(100, total_assigned * 5) * 0.3  # Cap at 20 issues for full score
    performance_score = round(rate_score + speed_score + volume_score, 1)

    # Performance grade
    if performance_score >= 80:
        grade = "A"
        grade_label = "Excellent"
    elif performance_score >= 60:
        grade = "B"
        grade_label = "Good"
    elif performance_score >= 40:
        grade = "C"
        grade_label = "Average"
    elif performance_score >= 20:
        grade = "D"
        grade_label = "Below Average"
    else:
        grade = "F"
        grade_label = "Poor"

    return {
        "official": {
            "id": official.get("id") or official.get("_id"),
            "name": official.get("name"),
            "designation": official.get("designation"),
            "department": official.get("department"),
            "area": official.get("area"),
            "contact_email": official.get("contact_email"),
            "contact_phone": official.get("contact_phone"),
            "categories": official.get("categories", []),
            "hierarchy_level": official.get("hierarchy_level", 1)
        },
        "stats": {
            "total_assigned": total_assigned,
            "resolved": resolved,
            "in_progress": in_progress,
            "pending": pending,
            "resolution_rate": resolution_rate,
            "avg_resolution_days": avg_resolution_days
        },
        "performance": {
            "score": performance_score,
            "grade": grade,
            "grade_label": grade_label
        },
        "categories_breakdown": categories_breakdown,
        "recent_resolved": recent_resolved
    }


@router.get("")
async def get_all_officials_with_stats(
    designation: Optional[str] = None,
    hierarchy_level: Optional[int] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all officials with basic performance stats"""
    db = get_database()
    query = {"is_active": True}

    if designation:
        query["designation"] = designation
    if hierarchy_level:
        query["hierarchy_level"] = hierarchy_level

    officials = await db.govt_officials.find(query).sort("hierarchy_level", 1).skip(skip).limit(limit).to_list(limit)

    result = []
    for official in officials:
        official_id = official.get("_id") or official.get("id")

        # Get issue counts for this official
        total = await db.issues.count_documents({
            "$or": [
                {"assigned_official_id": official_id},
                {"assigned_official_id": official.get("id")}
            ]
        })
        resolved = await db.issues.count_documents({
            "$or": [
                {"assigned_official_id": official_id},
                {"assigned_official_id": official.get("id")}
            ],
            "status": "resolved"
        })

        resolution_rate = round(resolved / total * 100, 1) if total > 0 else 0

        result.append({
            **GovtOfficial(**official).model_dump(),
            "stats": {
                "total_assigned": total,
                "resolved": resolved,
                "resolution_rate": resolution_rate
            }
        })

    return result
