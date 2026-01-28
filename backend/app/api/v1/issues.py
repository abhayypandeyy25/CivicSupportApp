"""
Issue endpoints with comments, timeline, search, and priority scoring
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from typing import List, Optional, Literal
from datetime import datetime
import logging
import re

from ...models import (
    Issue, IssueCreate, IssueUpdate, User,
    AIClassificationRequest, AIClassificationResponse,
    Comment, CommentCreate, TimelineEvent, calculate_priority_score
)
from ...database import get_database
from ...services import classify_issue_with_ai
from ..deps import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/issues", tags=["Issues"])


def add_timeline_event(
    issue_dict: dict,
    event_type: str,
    description: str,
    user_id: str = None,
    user_name: str = None,
    old_value: str = None,
    new_value: str = None
) -> dict:
    """Add a timeline event to an issue"""
    event = TimelineEvent(
        event_type=event_type,
        description=description,
        user_id=user_id,
        user_name=user_name,
        old_value=old_value,
        new_value=new_value
    )
    if 'timeline' not in issue_dict:
        issue_dict['timeline'] = []
    issue_dict['timeline'].append(event.model_dump())
    return issue_dict


@router.post("", response_model=Issue)
async def create_issue(
    request: Request,
    issue_data: IssueCreate,
    user: User = Depends(get_current_user)
):
    """Create a new civic issue"""
    try:
        db = get_database()

        # Validate photos (max 5)
        if len(issue_data.photos) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 photos allowed per issue")
        if len(issue_data.photos) < 1:
            raise HTTPException(status_code=400, detail="At least 1 photo is required")

        # Get AI classification
        ai_result = await classify_issue_with_ai(
            issue_data.title,
            issue_data.description,
            issue_data.location
        )

        new_issue = Issue(
            user_id=user.id,
            user_name=user.display_name,
            title=issue_data.title,
            description=issue_data.description,
            category=issue_data.category,
            sub_category=issue_data.sub_category,
            photos=issue_data.photos,
            location=issue_data.location,
            ai_suggested_category=ai_result.category,
            ai_suggested_officials=[o['id'] for o in ai_result.suggested_officials]
        )

        # Convert to dict and add GeoJSON coordinates for geospatial queries
        issue_dict = new_issue.model_dump()
        issue_dict['location']['coordinates'] = [
            issue_data.location.longitude,
            issue_data.location.latitude
        ]

        # Add creation timeline event
        issue_dict = add_timeline_event(
            issue_dict,
            event_type="created",
            description=f"Issue reported by {user.display_name or 'Anonymous'}",
            user_id=user.id,
            user_name=user.display_name
        )

        # Calculate initial priority score
        issue_dict['priority_score'] = calculate_priority_score(issue_dict)

        await db.issues.insert_one(issue_dict)
        logger.info(f"Issue created successfully: {new_issue.id} by user {user.id}")

        return Issue(**issue_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating issue for user {user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create issue. Please try again.")


@router.get("", response_model=List[Issue])
async def get_issues(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 5.0,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = Query(None, min_length=2, max_length=100, description="Search in title and description"),
    sort_by: Literal["newest", "oldest", "upvotes", "priority", "nearest"] = "newest",
    skip: int = 0,
    limit: int = 20
):
    """
    Get issues with optional filtering, search, and sorting.

    Sort options:
    - newest: Most recently created first
    - oldest: Oldest first
    - upvotes: Most upvoted first
    - priority: Highest priority score first
    - nearest: Closest to location first (requires lat/long)
    """
    try:
        db = get_database()
        query = {}

        # Validate radius
        if radius_km > 100:
            raise HTTPException(status_code=400, detail="Radius cannot exceed 100km")

        if category:
            query["category"] = category
        if status:
            query["status"] = status

        # Search in title and description
        if search:
            search_regex = {"$regex": re.escape(search), "$options": "i"}
            query["$or"] = [
                {"title": search_regex},
                {"description": search_regex}
            ]

        # Location-based filtering using MongoDB geospatial queries
        if latitude is not None and longitude is not None:
            radius_in_radians = radius_km / 6371  # Earth's radius in km

            geo_query = {
                "location.coordinates": {
                    "$geoWithin": {
                        "$centerSphere": [[longitude, latitude], radius_in_radians]
                    }
                }
            }

            # Combine with other filters
            if "$or" in query:
                # If we have search, we need to be careful with $and
                query = {"$and": [
                    {"$or": query.pop("$or")},
                    geo_query,
                    query if query else {}
                ]}
            elif query:
                query = {"$and": [query, geo_query]}
            else:
                query = geo_query

        # Determine sort order
        sort_options = {
            "newest": [("created_at", -1)],
            "oldest": [("created_at", 1)],
            "upvotes": [("upvotes", -1), ("created_at", -1)],
            "priority": [("priority_score", -1), ("created_at", -1)],
            "nearest": [("created_at", -1)]  # Nearest requires post-processing
        }
        sort_order = sort_options.get(sort_by, [("created_at", -1)])

        issues = await db.issues.find(query).sort(sort_order).skip(skip).limit(limit).to_list(limit)

        # Update priority scores for returned issues (can be done in background)
        result = []
        for issue in issues:
            issue['priority_score'] = calculate_priority_score(issue)
            result.append(Issue(**issue))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching issues: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch issues")


@router.get("/stats/summary")
async def get_issues_stats():
    """Get summary statistics for issues"""
    try:
        db = get_database()

        total = await db.issues.count_documents({})
        pending = await db.issues.count_documents({"status": "pending"})
        in_progress = await db.issues.count_documents({"status": "in_progress"})
        resolved = await db.issues.count_documents({"status": "resolved"})

        # Get category breakdown
        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        categories = await db.issues.aggregate(pipeline).to_list(20)

        # Get recent activity (last 7 days)
        week_ago = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = week_ago.replace(day=week_ago.day - 7) if week_ago.day > 7 else week_ago
        recent_count = await db.issues.count_documents({"created_at": {"$gte": week_ago}})

        # Get top upvoted issues
        top_issues = await db.issues.find({}).sort("upvotes", -1).limit(5).to_list(5)

        return {
            "total_issues": total,
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved,
            "categories": [{"category": c["_id"], "count": c["count"]} for c in categories],
            "recent_week": recent_count,
            "top_issues": [
                {
                    "id": i["id"],
                    "title": i["title"],
                    "upvotes": i["upvotes"],
                    "category": i["category"],
                    "status": i["status"]
                }
                for i in top_issues
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching issue stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch statistics")


@router.get("/user/me", response_model=List[Issue])
async def get_my_issues(
    user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
):
    """Get issues created by current user"""
    db = get_database()
    issues = await db.issues.find({"user_id": user.id}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [Issue(**issue) for issue in issues]


@router.get("/{issue_id}", response_model=Issue)
async def get_issue(
    issue_id: str,
    user: User = Depends(get_current_user_optional)
):
    """Get a specific issue by ID and increment view count"""
    db = get_database()
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Increment view count
    await db.issues.update_one(
        {"id": issue_id},
        {"$inc": {"view_count": 1}}
    )
    issue['view_count'] = issue.get('view_count', 0) + 1

    # Update priority score
    issue['priority_score'] = calculate_priority_score(issue)

    return Issue(**issue)


@router.get("/{issue_id}/timeline", response_model=List[TimelineEvent])
async def get_issue_timeline(issue_id: str):
    """Get the timeline/history of an issue"""
    db = get_database()
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    timeline = issue.get('timeline', [])
    # Sort by created_at descending (newest first)
    timeline.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return [TimelineEvent(**event) for event in timeline]


@router.put("/{issue_id}", response_model=Issue)
async def update_issue(
    issue_id: str,
    issue_update: IssueUpdate,
    user: User = Depends(get_current_user)
):
    """Update an issue (only by creator or admin)"""
    db = get_database()
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue['user_id'] != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this issue")

    update_data = {k: v for k, v in issue_update.model_dump().items() if v is not None}
    timeline_events = []

    if update_data:
        update_data['updated_at'] = datetime.utcnow()

        # Track status changes in timeline
        if 'status' in update_data and update_data['status'] != issue.get('status'):
            old_status = issue.get('status', 'pending')
            new_status = update_data['status']
            event = TimelineEvent(
                event_type="status_change",
                old_value=old_status,
                new_value=new_status,
                description=f"Status changed from {old_status} to {new_status}",
                user_id=user.id,
                user_name=user.display_name
            )
            timeline_events.append(event.model_dump())

        # If assigning to official, get their name and add timeline event
        if 'assigned_official_id' in update_data:
            official = await db.govt_officials.find_one({"id": update_data['assigned_official_id']})
            if official:
                update_data['assigned_official_name'] = official['name']
                event = TimelineEvent(
                    event_type="assigned",
                    new_value=official['name'],
                    description=f"Assigned to {official['name']} ({official.get('designation', 'Official')})",
                    user_id=user.id,
                    user_name=user.display_name
                )
                timeline_events.append(event.model_dump())

        # Add timeline events
        if timeline_events:
            await db.issues.update_one(
                {"id": issue_id},
                {"$push": {"timeline": {"$each": timeline_events}}}
            )

        await db.issues.update_one({"id": issue_id}, {"$set": update_data})

    updated_issue = await db.issues.find_one({"id": issue_id})
    updated_issue['priority_score'] = calculate_priority_score(updated_issue)
    return Issue(**updated_issue)


@router.post("/{issue_id}/upvote", response_model=Issue)
async def upvote_issue(
    issue_id: str,
    user: Optional[User] = Depends(get_current_user_optional)
):
    """Upvote an issue (works with or without authentication)"""
    db = get_database()
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Use user ID if authenticated, otherwise use a demo user ID based on issue_id
    # This allows demo upvoting while still tracking to prevent duplicate upvotes
    user_id = user.id if user else f"demo-user-{issue_id[-8:]}"

    upvoted_by = issue.get('upvoted_by', [])
    old_upvotes = issue.get('upvotes', 0)

    if user_id in upvoted_by:
        # Remove upvote
        upvoted_by.remove(user_id)
        new_upvotes = max(0, old_upvotes - 1)
    else:
        # Add upvote
        upvoted_by.append(user_id)
        new_upvotes = old_upvotes + 1

    update_ops = {
        "$set": {
            "upvotes": new_upvotes,
            "upvoted_by": upvoted_by,
            "updated_at": datetime.utcnow()
        }
    }

    # Add milestone timeline events
    milestones = [10, 25, 50, 100, 250, 500, 1000]
    for milestone in milestones:
        if old_upvotes < milestone <= new_upvotes:
            event = TimelineEvent(
                event_type="upvote_milestone",
                new_value=str(milestone),
                description=f"Reached {milestone} upvotes!"
            )
            update_ops["$push"] = {"timeline": event.model_dump()}
            break

    await db.issues.update_one({"id": issue_id}, update_ops)

    updated_issue = await db.issues.find_one({"id": issue_id})
    updated_issue['priority_score'] = calculate_priority_score(updated_issue)
    return Issue(**updated_issue)


# ============ COMMENTS ENDPOINTS ============

@router.get("/{issue_id}/comments", response_model=List[Comment])
async def get_comments(issue_id: str):
    """Get all comments for an issue"""
    db = get_database()
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    comments = issue.get('comments', [])
    # Sort by created_at ascending (oldest first for readability)
    comments.sort(key=lambda x: x.get('created_at', ''))
    return [Comment(**comment) for comment in comments]


@router.post("/{issue_id}/comments", response_model=Comment)
async def add_comment(
    issue_id: str,
    comment_data: CommentCreate,
    user: User = Depends(get_current_user)
):
    """Add a comment to an issue"""
    db = get_database()
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Check if user is an official
    is_official = False
    official_designation = None
    official = await db.govt_officials.find_one({"contact_email": user.email})
    if official:
        is_official = True
        official_designation = official.get('designation')

    comment = Comment(
        user_id=user.id,
        user_name=user.display_name or "Anonymous",
        text=comment_data.text,
        is_official=is_official,
        official_designation=official_designation
    )

    # Add comment to issue
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$push": {"comments": comment.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    # Add timeline event for comment
    timeline_event = TimelineEvent(
        event_type="comment_added",
        description=f"{'Official ' if is_official else ''}{user.display_name or 'Someone'} commented",
        user_id=user.id,
        user_name=user.display_name
    )
    await db.issues.update_one(
        {"id": issue_id},
        {"$push": {"timeline": timeline_event.model_dump()}}
    )

    logger.info(f"Comment added to issue {issue_id} by user {user.id}")
    return comment


@router.delete("/{issue_id}/comments/{comment_id}")
async def delete_comment(
    issue_id: str,
    comment_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a comment (only by comment author or admin)"""
    db = get_database()
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    comments = issue.get('comments', [])
    comment_to_delete = None
    for comment in comments:
        if comment.get('id') == comment_id:
            comment_to_delete = comment
            break

    if not comment_to_delete:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment_to_delete.get('user_id') != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    await db.issues.update_one(
        {"id": issue_id},
        {
            "$pull": {"comments": {"id": comment_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    return {"message": "Comment deleted successfully"}


@router.post("/classify", response_model=AIClassificationResponse)
async def classify_issue(
    request: AIClassificationRequest,
    user: User = Depends(get_current_user)
):
    """Classify an issue using AI"""
    return await classify_issue_with_ai(request.title, request.description, request.location)
