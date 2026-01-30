# Vercel serverless entry point - simplified FastAPI
import os
os.environ["VERCEL"] = "1"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from datetime import datetime, timedelta

# Request models
class UpdateStatusRequest(BaseModel):
    status: str

class AssignOfficialRequest(BaseModel):
    official_id: str

# Initialize app
app = FastAPI(title="CivicSense API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/")
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "supabase_connected": supabase is not None
    }

@app.get("/api/stats")
def get_stats():
    """Get platform statistics"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Get counts
    total_issues = supabase.table('issues').select('id', count='exact').execute().count or 0
    pending_issues = supabase.table('issues').select('id', count='exact').eq('status', 'pending').execute().count or 0
    in_progress_issues = supabase.table('issues').select('id', count='exact').eq('status', 'in_progress').execute().count or 0
    resolved_issues = supabase.table('issues').select('id', count='exact').eq('status', 'resolved').execute().count or 0
    total_users = supabase.table('users').select('id', count='exact').execute().count or 0
    total_officials = supabase.table('govt_officials').select('id', count='exact').eq('is_active', True).execute().count or 0

    # Source breakdown
    app_issues = supabase.table('issues').select('id', count='exact').eq('source', 'app').execute().count or 0
    twitter_issues = supabase.table('issues').select('id', count='exact').eq('source', 'twitter').execute().count or 0
    pending_location_issues = supabase.table('issues').select('id', count='exact').eq('location_status', 'pending').execute().count or 0

    # Issues this week
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    issues_this_week = supabase.table('issues').select('id', count='exact').gte('created_at', week_ago).execute().count or 0

    # Resolution rate
    resolution_rate = round((resolved_issues / total_issues * 100), 1) if total_issues > 0 else 0

    # Get category and area breakdowns
    all_issues_data = supabase.table('issues').select('category, status, location_area, twitter_like_count, twitter_retweet_count, twitter_reply_count').execute()

    # Category breakdown
    category_breakdown = {}
    for issue in all_issues_data.data:
        cat = issue['category']
        if cat not in category_breakdown:
            category_breakdown[cat] = {'total': 0, 'pending': 0, 'in_progress': 0, 'resolved': 0}
        category_breakdown[cat]['total'] += 1
        status = issue.get('status', 'pending')
        if status in category_breakdown[cat]:
            category_breakdown[cat][status] += 1

    categories_list = [
        {'category': cat, **counts}
        for cat, counts in sorted(category_breakdown.items(), key=lambda x: x[1]['total'], reverse=True)
    ]

    # Area breakdown
    area_breakdown = {}
    for issue in all_issues_data.data:
        area = issue.get('location_area') or 'Unknown'
        if area not in area_breakdown:
            area_breakdown[area] = {'total': 0, 'pending': 0, 'resolved': 0}
        area_breakdown[area]['total'] += 1
        status = issue.get('status', 'pending')
        if status == 'pending':
            area_breakdown[area]['pending'] += 1
        elif status == 'resolved':
            area_breakdown[area]['resolved'] += 1

    areas_list = [
        {'area': area, **counts}
        for area, counts in sorted(area_breakdown.items(), key=lambda x: x[1]['total'], reverse=True)[:10]
    ]

    # Twitter engagement
    total_likes = sum(issue.get('twitter_like_count') or 0 for issue in all_issues_data.data)
    total_retweets = sum(issue.get('twitter_retweet_count') or 0 for issue in all_issues_data.data)
    total_replies = sum(issue.get('twitter_reply_count') or 0 for issue in all_issues_data.data)

    return {
        "total_issues": total_issues,
        "pending_issues": pending_issues,
        "in_progress_issues": in_progress_issues,
        "resolved_issues": resolved_issues,
        "resolution_rate": resolution_rate,
        "issues_this_week": issues_this_week,
        "total_users": total_users,
        "total_officials": total_officials,
        "categories": categories_list,
        "areas": areas_list,
        "issues_by_source": {
            "app": app_issues,
            "twitter": twitter_issues
        },
        "pending_location_issues": pending_location_issues,
        "twitter_engagement": {
            "total_likes": total_likes,
            "total_retweets": total_retweets,
            "total_replies": total_replies
        },
        "top_officials": []
    }

@app.get("/api/issues")
def get_issues(
    source: str = None,
    status: str = None,
    limit: int = 50,
    skip: int = 0
):
    """Get issues"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    query = supabase.table('issues').select('*')

    if source:
        query = query.eq('source', source)
    if status:
        query = query.eq('status', status)

    result = query.order('created_at', desc=True).range(skip, skip + limit - 1).execute()

    # Transform data
    issues = []
    for row in result.data:
        issue = {
            "id": str(row['id']),
            "user_id": str(row.get('user_id', '')),
            "user_name": row.get('user_name'),
            "title": row['title'],
            "description": row['description'],
            "category": row['category'],
            "photos": row.get('photos', []),
            "location": {
                "latitude": row.get('location_latitude', 0),
                "longitude": row.get('location_longitude', 0),
                "address": row.get('location_address'),
                "area": row.get('location_area'),
                "city": row.get('location_city', 'Delhi')
            },
            "status": row.get('status', 'pending'),
            "upvotes": row.get('upvotes', 0),
            "created_at": row.get('created_at'),
            "source": row.get('source', 'app'),
            "location_status": row.get('location_status', 'resolved')
        }

        # Add Twitter data if present
        if row.get('twitter_tweet_id'):
            issue["twitter_data"] = {
                "tweet_id": row['twitter_tweet_id'],
                "twitter_username": row.get('twitter_username', ''),
                "twitter_display_name": row.get('twitter_display_name'),
                "twitter_profile_image": row.get('twitter_profile_image'),
                "tweet_text": row.get('twitter_tweet_text', ''),
                "like_count": row.get('twitter_like_count', 0),
                "retweet_count": row.get('twitter_retweet_count', 0),
                "reply_count": row.get('twitter_reply_count', 0)
            }

        issues.append(issue)

    return issues

@app.get("/api/issues/{issue_id}")
def get_issue(issue_id: str):
    """Get a single issue by ID"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    result = supabase.table('issues').select('*').eq('id', issue_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    row = result.data[0]
    issue = {
        "id": str(row['id']),
        "user_id": str(row.get('user_id', '')),
        "user_name": row.get('user_name'),
        "title": row['title'],
        "description": row['description'],
        "category": row['category'],
        "photos": row.get('photos', []),
        "location": {
            "latitude": row.get('location_latitude', 0),
            "longitude": row.get('location_longitude', 0),
            "address": row.get('location_address'),
            "area": row.get('location_area'),
            "city": row.get('location_city', 'Delhi')
        },
        "status": row.get('status', 'pending'),
        "upvotes": row.get('upvotes', 0),
        "created_at": row.get('created_at'),
        "source": row.get('source', 'app'),
        "location_status": row.get('location_status', 'resolved'),
        "assigned_official_id": row.get('assigned_official_id'),
    }

    # Add Twitter data if present
    if row.get('twitter_tweet_id'):
        issue["twitter_data"] = {
            "tweet_id": row['twitter_tweet_id'],
            "twitter_username": row.get('twitter_username', ''),
            "twitter_display_name": row.get('twitter_display_name'),
            "twitter_profile_image": row.get('twitter_profile_image'),
            "tweet_text": row.get('twitter_tweet_text', ''),
            "like_count": row.get('twitter_like_count', 0),
            "retweet_count": row.get('twitter_retweet_count', 0),
            "reply_count": row.get('twitter_reply_count', 0)
        }

    return issue

@app.patch("/api/issues/{issue_id}/status")
def update_issue_status(issue_id: str, request: UpdateStatusRequest):
    """Update the status of an issue"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    valid_statuses = ['pending', 'in_progress', 'resolved', 'rejected']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    # Check if issue exists
    existing = supabase.table('issues').select('id').eq('id', issue_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Update status
    update_data = {
        'status': request.status,
        'updated_at': datetime.utcnow().isoformat()
    }

    # If resolved, set resolved_at
    if request.status == 'resolved':
        update_data['resolved_at'] = datetime.utcnow().isoformat()

    result = supabase.table('issues').update(update_data).eq('id', issue_id).execute()

    return {"success": True, "status": request.status, "issue_id": issue_id}

@app.patch("/api/issues/{issue_id}/assign")
def assign_official(issue_id: str, request: AssignOfficialRequest):
    """Assign an official to an issue"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Check if issue exists
    existing = supabase.table('issues').select('id').eq('id', issue_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Check if official exists
    official = supabase.table('govt_officials').select('id, name').eq('id', request.official_id).execute()
    if not official.data:
        raise HTTPException(status_code=404, detail="Official not found")

    # Update issue with assigned official
    update_data = {
        'assigned_official_id': request.official_id,
        'status': 'in_progress',  # Auto-set to in_progress when assigned
        'updated_at': datetime.utcnow().isoformat()
    }

    result = supabase.table('issues').update(update_data).eq('id', issue_id).execute()

    return {
        "success": True,
        "issue_id": issue_id,
        "assigned_official_id": request.official_id,
        "official_name": official.data[0]['name']
    }

@app.get("/api/officials")
def get_officials():
    """Get list of active government officials"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    result = supabase.table('govt_officials').select('*').eq('is_active', True).execute()

    officials = []
    for row in result.data:
        officials.append({
            "id": str(row['id']),
            "name": row.get('name', ''),
            "designation": row.get('designation', ''),
            "department": row.get('department', ''),
            "area": row.get('area', ''),
            "email": row.get('email', ''),
            "phone": row.get('phone', ''),
        })

    return officials
