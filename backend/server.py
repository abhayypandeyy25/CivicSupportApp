from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
import base64
import anthropic
import json
import asyncio
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import settings with validation
from config import settings

# Configure logging early (before other modules need it)
logging.basicConfig(
    level=logging.INFO,
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

# Supabase connection
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
logger.info("Supabase client initialized")

# Initialize Firebase Admin SDK (without service account for token verification only)
try:
    firebase_admin.get_app()
except ValueError:
    # Initialize without credentials - will use API for token verification
    firebase_admin.initialize_app(options={
        'projectId': settings.FIREBASE_PROJECT_ID
    })

# Create the main app
app = FastAPI(title="CivicSense API", description="API for Civic Issues Reporting App")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Rate Limiter - Prevent abuse and DoS attacks
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ==================== MODELS ====================

class Location(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude must be between -90 and 90")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude must be between -180 and 180")
    address: Optional[str] = Field(None, max_length=500)
    area: Optional[str] = Field(None, max_length=200)
    city: str = Field("Delhi", max_length=100)

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    firebase_uid: str = Field(..., min_length=1, max_length=128)
    phone_number: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    email: Optional[str] = Field(None, max_length=255)
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    photo_url: Optional[str] = Field(None, max_length=2048)
    location: Optional[Location] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_admin: bool = False

class UserCreate(BaseModel):
    firebase_uid: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    location: Optional[Location] = None

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    location: Optional[Location] = None

class GovtOfficial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    designation: str  # Parshad, MCD, IAS, MLA, MP, CM, PM
    department: str
    area: Optional[str] = None  # Ward/Constituency
    city: str = "Delhi"
    state: str = "Delhi"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    photo_url: Optional[str] = None
    categories: List[str] = []  # Categories they handle: roads, sanitation, etc.
    hierarchy_level: int = 1  # 1-Parshad, 2-MCD, 3-IAS, 4-MLA, 5-MP, 6-CM, 7-PM
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class GovtOfficialCreate(BaseModel):
    name: str
    designation: str
    department: str
    area: Optional[str] = None
    city: str = "Delhi"
    state: str = "Delhi"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    photo_url: Optional[str] = None
    categories: List[str] = []
    hierarchy_level: int = 1

# Twitter Integration Models
class TwitterIssueData(BaseModel):
    """Twitter-specific metadata for issues reported via Twitter"""
    tweet_id: str  # Twitter tweet ID (for deduplication)
    twitter_user_id: str  # Twitter user ID
    twitter_username: str  # @handle (without @)
    twitter_display_name: Optional[str] = None  # User's display name
    twitter_profile_image: Optional[str] = None  # Profile image URL
    tweet_text: str  # Original tweet text
    tweet_url: str  # Link to original tweet
    tweet_created_at: datetime  # When tweet was posted
    has_media: bool = False  # Has attached images
    media_urls: List[str] = []  # Original Twitter media URLs
    hashtags: List[str] = []  # Extracted hashtags
    retweet_count: int = 0  # Engagement metrics
    like_count: int = 0
    reply_count: int = 0
    fetched_at: datetime = Field(default_factory=datetime.utcnow)  # When we fetched this tweet

class Issue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: Optional[str] = None
    title: str
    description: str
    category: str  # roads, sanitation, water, electricity, etc.
    sub_category: Optional[str] = None
    photos: List[str] = []  # Base64 encoded images
    location: Location
    status: str = "pending"  # pending, in_progress, resolved, closed
    ai_suggested_category: Optional[str] = None
    ai_suggested_officials: List[str] = []  # List of official IDs
    assigned_official_id: Optional[str] = None
    assigned_official_name: Optional[str] = None
    upvotes: int = 0
    upvoted_by: List[str] = []  # List of user IDs
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    # Source tracking - where the issue was reported from
    source: str = "app"  # "app" | "twitter"
    location_status: str = "resolved"  # "resolved" | "pending" - for Twitter issues that need location assignment
    # Twitter-specific data (only populated when source="twitter")
    twitter_data: Optional[TwitterIssueData] = None

class IssueCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200, description="Issue title")
    description: str = Field(..., min_length=10, max_length=2000, description="Detailed description")
    category: str = Field(..., min_length=1, max_length=100)
    sub_category: Optional[str] = Field(None, max_length=100)
    photos: List[str] = Field(default=[], min_length=1, max_length=5, description="1-5 base64 encoded images")
    location: Location

    @field_validator('photos')
    @classmethod
    def validate_photo_size(cls, v):
        """Validate each photo is not too large (max ~5MB base64)"""
        max_size = 5_000_000  # ~5MB when base64 encoded
        for idx, photo in enumerate(v):
            if len(photo) > max_size:
                raise ValueError(f'Photo {idx+1} exceeds maximum size of 5MB')
            # Basic base64 validation
            if not photo.startswith('data:image/'):
                raise ValueError(f'Photo {idx+1} must be a valid base64 image with data URI')
        return v

class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    status: Optional[str] = None
    assigned_official_id: Optional[str] = None

class AIClassificationRequest(BaseModel):
    title: str
    description: str
    location: Optional[Location] = None

class AIClassificationResponse(BaseModel):
    category: str
    sub_category: Optional[str] = None
    suggested_officials: List[dict] = []
    confidence: float = 0.0

# ==================== HELPER FUNCTIONS ====================

def db_row_to_user(row: dict) -> User:
    """Convert database row to User model"""
    location = None
    if row.get('location_latitude') is not None:
        location = Location(
            latitude=row['location_latitude'],
            longitude=row['location_longitude'],
            address=row.get('location_address'),
            area=row.get('location_area'),
            city=row.get('location_city', 'Delhi')
        )

    return User(
        id=str(row['id']),
        firebase_uid=row['firebase_uid'],
        phone_number=row.get('phone_number'),
        email=row.get('email'),
        display_name=row.get('display_name'),
        photo_url=row.get('photo_url'),
        location=location,
        created_at=row.get('created_at', datetime.utcnow()),
        updated_at=row.get('updated_at', datetime.utcnow()),
        is_admin=row.get('is_admin', False)
    )

def db_row_to_official(row: dict) -> GovtOfficial:
    """Convert database row to GovtOfficial model"""
    return GovtOfficial(
        id=str(row['id']),
        name=row['name'],
        designation=row['designation'],
        department=row['department'],
        area=row.get('area'),
        city=row.get('city', 'Delhi'),
        state=row.get('state', 'Delhi'),
        contact_email=row.get('contact_email'),
        contact_phone=row.get('contact_phone'),
        photo_url=row.get('photo_url'),
        categories=row.get('categories', []),
        hierarchy_level=row.get('hierarchy_level', 1),
        created_at=row.get('created_at', datetime.utcnow()),
        is_active=row.get('is_active', True)
    )

def db_row_to_issue(row: dict) -> Issue:
    """Convert database row to Issue model"""
    location = Location(
        latitude=row['location_latitude'],
        longitude=row['location_longitude'],
        address=row.get('location_address'),
        area=row.get('location_area'),
        city=row.get('location_city', 'Delhi')
    )

    twitter_data = None
    if row.get('twitter_tweet_id'):
        twitter_data = TwitterIssueData(
            tweet_id=row['twitter_tweet_id'],
            twitter_user_id=row.get('twitter_user_id', ''),
            twitter_username=row.get('twitter_username', ''),
            twitter_display_name=row.get('twitter_display_name'),
            twitter_profile_image=row.get('twitter_profile_image'),
            tweet_text=row.get('twitter_tweet_text', ''),
            tweet_url=row.get('twitter_tweet_url', ''),
            tweet_created_at=row.get('twitter_tweet_created_at', datetime.utcnow()),
            has_media=row.get('twitter_has_media', False),
            media_urls=row.get('twitter_media_urls', []),
            hashtags=row.get('twitter_hashtags', []),
            retweet_count=row.get('twitter_retweet_count', 0),
            like_count=row.get('twitter_like_count', 0),
            reply_count=row.get('twitter_reply_count', 0),
            fetched_at=row.get('twitter_fetched_at', datetime.utcnow())
        )

    return Issue(
        id=str(row['id']),
        user_id=str(row['user_id']) if row.get('user_id') else '',
        user_name=row.get('user_name'),
        title=row['title'],
        description=row['description'],
        category=row['category'],
        sub_category=row.get('sub_category'),
        photos=row.get('photos', []),
        location=location,
        status=row.get('status', 'pending'),
        ai_suggested_category=row.get('ai_suggested_category'),
        ai_suggested_officials=row.get('ai_suggested_officials', []),
        assigned_official_id=str(row['assigned_official_id']) if row.get('assigned_official_id') else None,
        assigned_official_name=row.get('assigned_official_name'),
        upvotes=row.get('upvotes', 0),
        upvoted_by=row.get('upvoted_by', []),
        created_at=row.get('created_at', datetime.utcnow()),
        updated_at=row.get('updated_at', datetime.utcnow()),
        source=row.get('source', 'app'),
        location_status=row.get('location_status', 'resolved'),
        twitter_data=twitter_data
    )

# ==================== AUTH HELPERS ====================

async def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify Firebase ID token and return user info"""
    try:
        token = credentials.credentials
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(e)}")

async def get_current_user(token_data: dict = Depends(verify_firebase_token)) -> User:
    """Get current user from database or create if not exists"""
    firebase_uid = token_data.get('uid')

    # Query Supabase for user
    result = supabase.table('users').select('*').eq('firebase_uid', firebase_uid).execute()

    if not result.data:
        # Create new user
        new_user_data = {
            'firebase_uid': firebase_uid,
            'phone_number': token_data.get('phone_number'),
            'email': token_data.get('email'),
            'display_name': token_data.get('name') or (token_data.get('email', '').split('@')[0] if token_data.get('email') else None),
            'photo_url': token_data.get('picture')
        }
        insert_result = supabase.table('users').insert(new_user_data).execute()
        return db_row_to_user(insert_result.data[0])

    return db_row_to_user(result.data[0])

async def verify_admin(user: User = Depends(get_current_user)) -> User:
    """Verify user is admin"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AI CLASSIFICATION ====================

CLASSIFICATION_SYSTEM_PROMPT = """You are an expert in classifying civic issues in Indian cities.
Your job is to categorize citizen complaints and suggest which government department/official should handle them.

Categories available:
- roads: Potholes, road damage, street lights, traffic signals
- sanitation: Garbage, sewage, drains, cleanliness
- water: Water supply, leakage, contamination
- electricity: Power cuts, streetlights, illegal connections
- encroachment: Illegal construction, footpath blocking
- parks: Park maintenance, playground issues
- public_safety: Crime, harassment, safety concerns
- health: Hospital issues, epidemic concerns
- education: School issues, mid-day meals
- transport: Bus, metro, auto-rickshaw issues
- housing: Building permissions, slum issues
- general: Other issues

Government hierarchy (from local to national):
1. Parshad (Ward Councillor) - Local ward issues
2. MCD (Municipal Corporation) - City level civic issues
3. IAS Officers - Administrative issues
4. MLA (Member of Legislative Assembly) - Constituency level
5. MP (Member of Parliament) - Parliamentary constituency
6. CM (Chief Minister) - State level issues
7. PM (Prime Minister) - National level issues

Respond ONLY with valid JSON in this exact format:
{
    "category": "category_name",
    "sub_category": "optional_sub_category_or_null",
    "suggested_hierarchy_levels": [1, 2],
    "confidence": 0.95
}"""

async def classify_issue_with_ai(title: str, description: str, location: Optional[Location] = None) -> AIClassificationResponse:
    """Use AI to classify the civic issue using Anthropic Claude"""
    try:
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            logger.warning("ANTHROPIC_API_KEY not found, returning default classification")
            return AIClassificationResponse(category="general", confidence=0.5)

        client = anthropic.Anthropic(api_key=api_key)

        location_str = f"\nLocation: {location.area or ''}, {location.city}" if location else ""
        user_message = f"Classify this civic issue:\nTitle: {title}\nDescription: {description}{location_str}\n\nRespond with JSON only."

        model = os.environ.get('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')

        response = client.messages.create(
            model=model,
            max_tokens=200,
            system=CLASSIFICATION_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )

        response_text = response.content[0].text.strip()

        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        try:
            result = json.loads(response_text)

            # Get suggested officials from database
            suggested_officials = []
            hierarchy_levels = result.get('suggested_hierarchy_levels', [1, 2])

            if isinstance(hierarchy_levels, int):
                hierarchy_levels = [hierarchy_levels]

            # Query Supabase for officials
            officials_result = supabase.table('govt_officials')\
                .select('id, name, designation, department')\
                .in_('hierarchy_level', hierarchy_levels)\
                .eq('is_active', True)\
                .limit(5)\
                .execute()

            for official in officials_result.data:
                suggested_officials.append({
                    "id": str(official['id']),
                    "name": official['name'],
                    "designation": official['designation'],
                    "department": official['department']
                })

            return AIClassificationResponse(
                category=result.get('category', 'general'),
                sub_category=result.get('sub_category'),
                suggested_officials=suggested_officials,
                confidence=result.get('confidence', 0.8)
            )
        except json.JSONDecodeError:
            logger.error(f"Failed to parse AI response: {response_text}")
            return AIClassificationResponse(category="general", confidence=0.5)

    except Exception as e:
        logger.error(f"AI classification error: {str(e)}")
        return AIClassificationResponse(category="general", confidence=0.5)

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "CivicSense API - Civic Issues Reporting Platform"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ----- User Routes -----

@api_router.post("/users", response_model=User)
async def create_or_update_user(user_data: UserCreate):
    """Create or update user after Firebase authentication"""
    # Check if user exists
    result = supabase.table('users').select('*').eq('firebase_uid', user_data.firebase_uid).execute()

    if result.data:
        # Update existing user
        update_data = {k: v for k, v in user_data.dict().items() if v is not None and k != 'location'}
        if user_data.location:
            update_data['location_latitude'] = user_data.location.latitude
            update_data['location_longitude'] = user_data.location.longitude
            update_data['location_address'] = user_data.location.address
            update_data['location_area'] = user_data.location.area
            update_data['location_city'] = user_data.location.city

        update_result = supabase.table('users')\
            .update(update_data)\
            .eq('firebase_uid', user_data.firebase_uid)\
            .execute()
        return db_row_to_user(update_result.data[0])

    # Create new user
    insert_data = {k: v for k, v in user_data.dict().items() if v is not None and k != 'location'}
    if user_data.location:
        insert_data['location_latitude'] = user_data.location.latitude
        insert_data['location_longitude'] = user_data.location.longitude
        insert_data['location_address'] = user_data.location.address
        insert_data['location_area'] = user_data.location.area
        insert_data['location_city'] = user_data.location.city

    insert_result = supabase.table('users').insert(insert_data).execute()
    return db_row_to_user(insert_result.data[0])

@api_router.get("/users/me", response_model=User)
async def get_current_user_profile(user: User = Depends(get_current_user)):
    """Get current user profile"""
    return user

@api_router.put("/users/me", response_model=User)
async def update_user_profile(
    user_update: UserUpdate,
    user: User = Depends(get_current_user)
):
    """Update current user profile"""
    update_data = {}
    if user_update.display_name is not None:
        update_data['display_name'] = user_update.display_name
    if user_update.photo_url is not None:
        update_data['photo_url'] = user_update.photo_url
    if user_update.location is not None:
        update_data['location_latitude'] = user_update.location.latitude
        update_data['location_longitude'] = user_update.location.longitude
        update_data['location_address'] = user_update.location.address
        update_data['location_area'] = user_update.location.area
        update_data['location_city'] = user_update.location.city

    if update_data:
        result = supabase.table('users').update(update_data).eq('id', user.id).execute()
        return db_row_to_user(result.data[0])

    return user

@api_router.put("/users/me/location", response_model=User)
async def update_user_location(
    location: Location,
    user: User = Depends(get_current_user)
):
    """Update user's current location"""
    update_data = {
        'location_latitude': location.latitude,
        'location_longitude': location.longitude,
        'location_address': location.address,
        'location_area': location.area,
        'location_city': location.city
    }

    result = supabase.table('users').update(update_data).eq('id', user.id).execute()
    return db_row_to_user(result.data[0])

# ----- Issue Routes -----

@api_router.post("/issues", response_model=Issue)
@limiter.limit("10/minute")  # Stricter limit for issue creation to prevent spam
async def create_issue(
    request: Request,
    issue_data: IssueCreate,
    user: User = Depends(get_current_user)
):
    """Create a new civic issue"""
    try:
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

        issue_id = str(uuid.uuid4())
        issue_dict = {
            'id': issue_id,
            'user_id': user.id,
            'user_name': user.display_name,
            'title': issue_data.title,
            'description': issue_data.description,
            'category': issue_data.category,
            'sub_category': issue_data.sub_category,
            'photos': issue_data.photos,
            'location_latitude': issue_data.location.latitude,
            'location_longitude': issue_data.location.longitude,
            'location_address': issue_data.location.address,
            'location_area': issue_data.location.area,
            'location_city': issue_data.location.city,
            'status': 'pending',
            'ai_suggested_category': ai_result.category,
            'ai_suggested_officials': [o['id'] for o in ai_result.suggested_officials],
            'upvotes': 0,
            'upvoted_by': [],
            'source': 'app',
            'location_status': 'resolved'
        }

        result = supabase.table('issues').insert(issue_dict).execute()
        logger.info(f"Issue created successfully: {issue_id} by user {user.id}")
        return db_row_to_issue(result.data[0])

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error creating issue for user {user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create issue. Please try again.")

@api_router.get("/issues", response_model=List[Issue])
async def get_issues(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 5.0,
    category: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,  # Filter by source: "app" or "twitter"
    location_status: Optional[str] = None,  # Filter by location_status: "resolved" or "pending"
    skip: int = 0,
    limit: int = 20
):
    """Get issues with optional location-based filtering"""
    try:
        # Validate radius
        if radius_km > 100:
            raise HTTPException(status_code=400, detail="Radius cannot exceed 100km")

        # Build query
        query = supabase.table('issues').select('*')

        if category:
            query = query.eq('category', category)
        if status:
            query = query.eq('status', status)
        if source:
            query = query.eq('source', source)
        if location_status:
            query = query.eq('location_status', location_status)

        # Execute query with ordering and pagination
        result = query.order('created_at', desc=True).range(skip, skip + limit - 1).execute()

        issues = [db_row_to_issue(row) for row in result.data]

        # If location filtering requested, filter in Python (Supabase doesn't have built-in geo filtering)
        if latitude is not None and longitude is not None:
            filtered_issues = []
            for issue in issues:
                # Calculate distance using Haversine formula
                dlat = math.radians(issue.location.latitude - latitude)
                dlon = math.radians(issue.location.longitude - longitude)
                a = math.sin(dlat/2)**2 + math.cos(math.radians(latitude)) * math.cos(math.radians(issue.location.latitude)) * math.sin(dlon/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                distance = 6371 * c  # Earth's radius in km

                if distance <= radius_km:
                    filtered_issues.append(issue)
            return filtered_issues

        return issues

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching issues: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch issues")

@api_router.get("/issues/{issue_id}", response_model=Issue)
async def get_issue(issue_id: str):
    """Get a specific issue by ID"""
    result = supabase.table('issues').select('*').eq('id', issue_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Issue not found")
    return db_row_to_issue(result.data[0])

@api_router.put("/issues/{issue_id}", response_model=Issue)
async def update_issue(
    issue_id: str,
    issue_update: IssueUpdate,
    user: User = Depends(get_current_user)
):
    """Update an issue (only by creator or admin)"""
    result = supabase.table('issues').select('*').eq('id', issue_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue = result.data[0]
    if issue['user_id'] != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this issue")

    update_data = {k: v for k, v in issue_update.dict().items() if v is not None}

    if update_data:
        # If assigning to official, get their name
        if 'assigned_official_id' in update_data:
            official_result = supabase.table('govt_officials').select('name').eq('id', update_data['assigned_official_id']).execute()
            if official_result.data:
                update_data['assigned_official_name'] = official_result.data[0]['name']

        result = supabase.table('issues').update(update_data).eq('id', issue_id).execute()

    return db_row_to_issue(result.data[0])

@api_router.post("/issues/{issue_id}/upvote", response_model=Issue)
async def upvote_issue(
    issue_id: str,
    user: User = Depends(get_current_user)
):
    """Upvote an issue"""
    result = supabase.table('issues').select('*').eq('id', issue_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue = result.data[0]
    upvoted_by = issue.get('upvoted_by', []) or []

    if user.id in upvoted_by:
        # Remove upvote
        upvoted_by.remove(user.id)
        new_upvotes = max(0, issue.get('upvotes', 0) - 1)
    else:
        # Add upvote
        upvoted_by.append(user.id)
        new_upvotes = issue.get('upvotes', 0) + 1

    update_result = supabase.table('issues')\
        .update({'upvotes': new_upvotes, 'upvoted_by': upvoted_by})\
        .eq('id', issue_id)\
        .execute()

    return db_row_to_issue(update_result.data[0])

@api_router.get("/issues/user/me", response_model=List[Issue])
async def get_my_issues(
    user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
):
    """Get issues created by current user"""
    result = supabase.table('issues')\
        .select('*')\
        .eq('user_id', user.id)\
        .order('created_at', desc=True)\
        .range(skip, skip + limit - 1)\
        .execute()

    return [db_row_to_issue(row) for row in result.data]

# ----- AI Classification Route -----

@api_router.post("/classify", response_model=AIClassificationResponse)
async def classify_issue(
    request: AIClassificationRequest,
    user: User = Depends(get_current_user)
):
    """Classify an issue using AI"""
    return await classify_issue_with_ai(request.title, request.description, request.location)

# ----- Government Officials Routes -----

@api_router.get("/officials", response_model=List[GovtOfficial])
async def get_officials(
    designation: Optional[str] = None,
    hierarchy_level: Optional[int] = None,
    area: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get list of government officials"""
    query = supabase.table('govt_officials').select('*').eq('is_active', True)

    if designation:
        query = query.eq('designation', designation)
    if hierarchy_level:
        query = query.eq('hierarchy_level', hierarchy_level)
    if area:
        query = query.ilike('area', f'%{area}%')
    if category:
        query = query.contains('categories', [category])

    result = query.order('hierarchy_level').range(skip, skip + limit - 1).execute()
    return [db_row_to_official(row) for row in result.data]

@api_router.get("/officials/hierarchy")
async def get_officials_by_hierarchy():
    """Get officials grouped by hierarchy level"""
    result = supabase.table('govt_officials').select('*').eq('is_active', True).execute()

    # Group by hierarchy level in Python
    hierarchy_groups = {}
    for row in result.data:
        level = row['hierarchy_level']
        if level not in hierarchy_groups:
            hierarchy_groups[level] = {
                'officials': [],
                'designation': row['designation']
            }
        hierarchy_groups[level]['officials'].append({
            'id': str(row['id']),
            'name': row['name'],
            'designation': row['designation'],
            'department': row['department'],
            'area': row.get('area')
        })

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
            "level": level,
            "designation": hierarchy_map.get(level, hierarchy_groups[level]['designation']),
            "count": len(hierarchy_groups[level]['officials']),
            "officials": hierarchy_groups[level]['officials'][:10]
        }
        for level in sorted(hierarchy_groups.keys())
    ]

@api_router.get("/officials/{official_id}", response_model=GovtOfficial)
async def get_official(official_id: str):
    """Get a specific official by ID"""
    result = supabase.table('govt_officials').select('*').eq('id', official_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Official not found")
    return db_row_to_official(result.data[0])

# ----- Admin Routes -----

@api_router.post("/admin/officials", response_model=GovtOfficial)
async def create_official(
    official_data: GovtOfficialCreate,
    user: User = Depends(verify_admin)
):
    """Create a new government official (Admin only)"""
    official_dict = official_data.dict()
    official_dict['id'] = str(uuid.uuid4())

    result = supabase.table('govt_officials').insert(official_dict).execute()
    return db_row_to_official(result.data[0])

@api_router.post("/admin/officials/bulk", response_model=dict)
async def bulk_create_officials(
    officials: List[GovtOfficialCreate],
    user: User = Depends(verify_admin)
):
    """Bulk create government officials (Admin only)"""
    created = []
    for official_data in officials:
        official_dict = official_data.dict()
        official_dict['id'] = str(uuid.uuid4())
        result = supabase.table('govt_officials').insert(official_dict).execute()
        created.append(str(result.data[0]['id']))

    return {"message": f"Created {len(created)} officials", "ids": created}

@api_router.put("/admin/officials/{official_id}", response_model=GovtOfficial)
async def update_official(
    official_id: str,
    official_data: GovtOfficialCreate,
    user: User = Depends(verify_admin)
):
    """Update a government official (Admin only)"""
    existing = supabase.table('govt_officials').select('id').eq('id', official_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Official not found")

    update_data = official_data.dict()
    result = supabase.table('govt_officials').update(update_data).eq('id', official_id).execute()
    return db_row_to_official(result.data[0])

@api_router.delete("/admin/officials/{official_id}")
async def delete_official(
    official_id: str,
    user: User = Depends(verify_admin)
):
    """Delete a government official (Admin only)"""
    result = supabase.table('govt_officials').delete().eq('id', official_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Official not found")
    return {"message": "Official deleted successfully"}

@api_router.post("/admin/make-admin/{firebase_uid}")
async def make_user_admin(
    firebase_uid: str,
    admin: User = Depends(verify_admin)
):
    """Make a user an admin (Super Admin only)"""
    result = supabase.table('users').update({'is_admin': True}).eq('firebase_uid', firebase_uid).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User is now an admin"}

# ----- Twitter Public Routes (for Governance Dashboard) -----

@api_router.get("/twitter/stats")
async def get_twitter_stats_public():
    """Get Twitter integration statistics (Public for dashboard)"""
    try:
        # Get sync state
        sync_state_result = supabase.table('twitter_sync_state').select('*').eq('id', 'twitter_sync').execute()
        sync_state = sync_state_result.data[0] if sync_state_result.data else None

        # Count Twitter-sourced issues
        twitter_issues_result = supabase.table('issues').select('id', count='exact').eq('source', 'twitter').execute()
        twitter_issues = twitter_issues_result.count or 0

        pending_twitter_result = supabase.table('issues').select('id', count='exact').eq('source', 'twitter').eq('status', 'pending').execute()
        pending_twitter = pending_twitter_result.count or 0

        pending_location_result = supabase.table('issues').select('id', count='exact').eq('source', 'twitter').eq('location_status', 'pending').execute()
        pending_location = pending_location_result.count or 0

        # Top Twitter reporters - get all twitter issues and aggregate in Python
        twitter_issues_data = supabase.table('issues')\
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
            "enabled": settings.TWITTER_ENABLED,
            "twitter_handle": f"@{settings.TWITTER_CIVICSENSE_USERNAME}",
            "sync_state": {
                "last_mention_id": sync_state.get("last_mention_id") if sync_state else None,
                "last_sync_at": sync_state.get("last_sync_at") if sync_state else None,
                "total_tweets_processed": sync_state.get("total_tweets_processed", 0) if sync_state else 0,
                "total_issues_created": sync_state.get("total_issues_created", 0) if sync_state else 0
            },
            "total_twitter_issues": twitter_issues,
            "pending_twitter_issues": pending_twitter,
            "pending_location_issues": pending_location,
            "top_reporters": top_reporters
        }
    except Exception as e:
        logger.error(f"Error getting Twitter stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting Twitter stats: {str(e)}")

@api_router.post("/twitter/sync")
async def trigger_twitter_sync_public():
    """Manually trigger a Twitter sync (Public for dashboard)"""
    if not settings.TWITTER_ENABLED:
        raise HTTPException(status_code=400, detail="Twitter integration is disabled")

    try:
        from app.services.twitter.scheduler import trigger_manual_sync
        stats = await trigger_manual_sync()
        return {
            "success": True,
            "stats": stats
        }
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Manual Twitter sync failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

# ----- Twitter Admin Routes -----

@api_router.get("/admin/twitter/stats")
async def get_twitter_stats(admin: User = Depends(verify_admin)):
    """Get Twitter integration statistics (Admin only)"""
    return await get_twitter_stats_public()

@api_router.post("/admin/twitter/sync")
async def trigger_twitter_sync(admin: User = Depends(verify_admin)):
    """Manually trigger a Twitter sync (Admin only)"""
    return await trigger_twitter_sync_public()

@api_router.get("/admin/twitter/issues")
async def get_twitter_issues(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    location_status: Optional[str] = None,
    admin: User = Depends(verify_admin)
):
    """Get issues reported via Twitter (Admin only)"""
    query = supabase.table('issues').select('*').eq('source', 'twitter')

    if status:
        query = query.eq('status', status)
    if location_status:
        query = query.eq('location_status', location_status)

    result = query.order('created_at', desc=True).range(skip, skip + limit - 1).execute()
    return [db_row_to_issue(row) for row in result.data]

@api_router.put("/admin/issues/{issue_id}/location")
async def update_issue_location(
    issue_id: str,
    location: Location,
    admin: User = Depends(verify_admin)
):
    """Update location for an issue (Admin only) - useful for Twitter issues with pending location"""
    existing = supabase.table('issues').select('id').eq('id', issue_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    update_data = {
        'location_latitude': location.latitude,
        'location_longitude': location.longitude,
        'location_address': location.address,
        'location_area': location.area,
        'location_city': location.city,
        'location_status': 'resolved'
    }

    result = supabase.table('issues').update(update_data).eq('id', issue_id).execute()
    return db_row_to_issue(result.data[0])

# ----- Stats Route -----

@api_router.get("/stats")
async def get_stats():
    """Get comprehensive platform statistics for governance dashboard"""
    from datetime import timedelta

    # Get counts using Supabase's count feature
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

    # Get all issues for aggregations
    all_issues_data = supabase.table('issues').select('category, status, location_area, twitter_like_count, twitter_retweet_count, twitter_reply_count').execute()

    # Category breakdown with status
    category_breakdown = {}
    for issue in all_issues_data.data:
        cat = issue['category']
        if cat not in category_breakdown:
            category_breakdown[cat] = {'total': 0, 'pending': 0, 'in_progress': 0, 'resolved': 0}
        category_breakdown[cat]['total'] += 1
        status = issue.get('status', 'pending')
        if status in category_breakdown[cat]:
            category_breakdown[cat][status] += 1

    # Convert to list format for charts
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

    # Twitter engagement totals
    total_likes = sum(issue.get('twitter_like_count') or 0 for issue in all_issues_data.data)
    total_retweets = sum(issue.get('twitter_retweet_count') or 0 for issue in all_issues_data.data)
    total_replies = sum(issue.get('twitter_reply_count') or 0 for issue in all_issues_data.data)

    # Top officials by resolution (get officials with assignments)
    officials_result = supabase.table('govt_officials').select('id, name, designation, department').eq('is_active', True).execute()

    top_officials = []
    for official in officials_result.data[:5]:
        official_id = str(official['id'])
        assigned = supabase.table('issues').select('id', count='exact').eq('assigned_official_id', official_id).execute().count or 0
        resolved_by = supabase.table('issues').select('id', count='exact').eq('assigned_official_id', official_id).eq('status', 'resolved').execute().count or 0
        rate = round((resolved_by / assigned * 100), 1) if assigned > 0 else 0

        # Performance grade
        if rate >= 80:
            grade = 'A'
        elif rate >= 60:
            grade = 'B'
        elif rate >= 40:
            grade = 'C'
        elif rate >= 20:
            grade = 'D'
        else:
            grade = 'F'

        top_officials.append({
            'id': official_id,
            'name': official['name'],
            'designation': official['designation'],
            'department': official['department'],
            'total_assigned': assigned,
            'resolved': resolved_by,
            'resolution_rate': rate,
            'grade': grade
        })

    # Sort by resolution rate
    top_officials.sort(key=lambda x: x['resolution_rate'], reverse=True)

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
        "top_officials": top_officials
    }

# ----- Categories Route -----

@api_router.get("/categories")
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

# Include the router in the main app
app.include_router(api_router)

# CORS Configuration - Whitelist specific origins for security
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.get_allowed_origins(),
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("CivicSense API starting up with Supabase backend")

    # Skip background tasks on Vercel (serverless)
    if os.environ.get("VERCEL"):
        logger.info("Running on Vercel - skipping background scheduler")
        return

    # Initialize Twitter integration if configured
    if settings.TWITTER_ENABLED and settings.TWITTER_BEARER_TOKEN:
        try:
            from app.services.twitter import (
                TwitterClient,
                TwitterSyncService,
                setup_twitter_scheduler
            )

            logger.info("Initializing Twitter integration...")

            twitter_client = TwitterClient(settings.TWITTER_BEARER_TOKEN)

            # Get CivicSense user ID
            civicsense_user_id = await twitter_client.get_user_id(
                settings.TWITTER_CIVICSENSE_USERNAME
            )

            if civicsense_user_id:
                sync_service = TwitterSyncService(
                    supabase=supabase,
                    twitter_client=twitter_client,
                    civicsense_user_id=civicsense_user_id,
                    classify_func=classify_issue_with_ai
                )
                setup_twitter_scheduler(
                    sync_service,
                    poll_interval_minutes=settings.TWITTER_POLL_INTERVAL_MINUTES
                )
                logger.info(f"Twitter integration active for @{settings.TWITTER_CIVICSENSE_USERNAME}")
            else:
                logger.error(f"Could not find Twitter account @{settings.TWITTER_CIVICSENSE_USERNAME}")
        except ImportError as e:
            logger.warning(f"Twitter dependencies not installed: {e}")
        except Exception as e:
            logger.error(f"Failed to initialize Twitter integration: {e}", exc_info=True)
    else:
        if not settings.TWITTER_ENABLED:
            logger.info("Twitter integration is disabled")
        elif not settings.TWITTER_BEARER_TOKEN:
            logger.warning("Twitter integration enabled but TWITTER_BEARER_TOKEN not set")

@app.on_event("shutdown")
async def shutdown_event():
    # Shutdown Twitter scheduler if running
    try:
        from app.services.twitter import shutdown_scheduler
        shutdown_scheduler()
    except ImportError:
        pass

    logger.info("CivicSense API shutting down")
