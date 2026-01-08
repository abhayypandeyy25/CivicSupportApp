from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize Firebase Admin SDK (without service account for token verification only)
try:
    firebase_admin.get_app()
except ValueError:
    # Initialize without credentials - will use API for token verification
    firebase_admin.initialize_app(options={
        'projectId': os.environ.get('FIREBASE_PROJECT_ID', 'civicsense-451d1')
    })

# Create the main app
app = FastAPI(title="CivicSense API", description="API for Civic Issues Reporting App")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class Location(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    area: Optional[str] = None
    city: str = "Delhi"

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    firebase_uid: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
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

class IssueCreate(BaseModel):
    title: str
    description: str
    category: str
    sub_category: Optional[str] = None
    photos: List[str] = []  # Base64 encoded images
    location: Location

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
    user = await db.users.find_one({"firebase_uid": firebase_uid})
    
    if not user:
        # Create new user
        new_user = User(
            firebase_uid=firebase_uid,
            phone_number=token_data.get('phone_number'),
            email=token_data.get('email'),
            display_name=token_data.get('name') or token_data.get('email', '').split('@')[0],
            photo_url=token_data.get('picture')
        )
        await db.users.insert_one(new_user.dict())
        return new_user
    
    return User(**user)

async def verify_admin(user: User = Depends(get_current_user)) -> User:
    """Verify user is admin"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AI CLASSIFICATION ====================

async def classify_issue_with_ai(title: str, description: str, location: Optional[Location] = None) -> AIClassificationResponse:
    """Use AI to classify the civic issue"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            logger.warning("EMERGENT_LLM_KEY not found, returning default classification")
            return AIClassificationResponse(category="general", confidence=0.5)
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"classify-{uuid.uuid4()}",
            system_message="""You are an expert in classifying civic issues in Indian cities. 
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
            
            Respond in JSON format:
            {
                "category": "category_name",
                "sub_category": "optional_sub_category",
                "suggested_hierarchy_levels": [1, 2],
                "confidence": 0.95
            }"""
        )
        
        location_str = f" Location: {location.area or ''}, {location.city}" if location else ""
        user_message = UserMessage(
            text=f"Classify this civic issue:\nTitle: {title}\nDescription: {description}{location_str}\n\nRespond only with valid JSON."
        )
        
        response = await chat.send_message(user_message)
        
        # Parse the response
        import json
        try:
            # Extract JSON from response
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            result = json.loads(response_text)
            
            # Get suggested officials from database
            suggested_officials = []
            hierarchy_levels = result.get('suggested_hierarchy_levels', [1, 2])
            
            # Find officials matching the category and hierarchy
            officials_cursor = db.govt_officials.find({
                "hierarchy_level": {"$in": hierarchy_levels},
                "is_active": True
            }).limit(5)
            
            async for official in officials_cursor:
                suggested_officials.append({
                    "id": official['id'],
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
            logger.error(f"Failed to parse AI response: {response}")
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
    existing_user = await db.users.find_one({"firebase_uid": user_data.firebase_uid})
    
    if existing_user:
        # Update existing user
        update_data = {k: v for k, v in user_data.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        await db.users.update_one(
            {"firebase_uid": user_data.firebase_uid},
            {"$set": update_data}
        )
        updated_user = await db.users.find_one({"firebase_uid": user_data.firebase_uid})
        return User(**updated_user)
    
    # Create new user
    new_user = User(**user_data.dict())
    await db.users.insert_one(new_user.dict())
    return new_user

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
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    if update_data:
        update_data['updated_at'] = datetime.utcnow()
        await db.users.update_one(
            {"id": user.id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": user.id})
    return User(**updated_user)

@api_router.put("/users/me/location", response_model=User)
async def update_user_location(
    location: Location,
    user: User = Depends(get_current_user)
):
    """Update user's current location"""
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"location": location.dict(), "updated_at": datetime.utcnow()}}
    )
    updated_user = await db.users.find_one({"id": user.id})
    return User(**updated_user)

# ----- Issue Routes -----

@api_router.post("/issues", response_model=Issue)
async def create_issue(
    issue_data: IssueCreate,
    user: User = Depends(get_current_user)
):
    """Create a new civic issue"""
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
    
    await db.issues.insert_one(new_issue.dict())
    return new_issue

@api_router.get("/issues", response_model=List[Issue])
async def get_issues(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 5.0,
    category: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get issues with optional location-based filtering"""
    query = {}
    
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    
    # Location-based filtering using simple distance calculation
    if latitude is not None and longitude is not None:
        # Get all issues and filter by distance (for MVP - can be optimized with geospatial index later)
        all_issues = await db.issues.find(query).sort("created_at", -1).to_list(1000)
        
        def calculate_distance(lat1, lon1, lat2, lon2):
            """Calculate distance between two points using Haversine formula"""
            R = 6371  # Earth's radius in km
            lat1_rad = math.radians(lat1)
            lat2_rad = math.radians(lat2)
            delta_lat = math.radians(lat2 - lat1)
            delta_lon = math.radians(lon2 - lon1)
            
            a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            return R * c
        
        filtered_issues = []
        for issue in all_issues:
            issue_lat = issue.get('location', {}).get('latitude')
            issue_lon = issue.get('location', {}).get('longitude')
            if issue_lat and issue_lon:
                distance = calculate_distance(latitude, longitude, issue_lat, issue_lon)
                if distance <= radius_km:
                    filtered_issues.append(issue)
        
        return [Issue(**issue) for issue in filtered_issues[skip:skip+limit]]
    
    issues = await db.issues.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [Issue(**issue) for issue in issues]

@api_router.get("/issues/{issue_id}", response_model=Issue)
async def get_issue(issue_id: str):
    """Get a specific issue by ID"""
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return Issue(**issue)

@api_router.put("/issues/{issue_id}", response_model=Issue)
async def update_issue(
    issue_id: str,
    issue_update: IssueUpdate,
    user: User = Depends(get_current_user)
):
    """Update an issue (only by creator or admin)"""
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    if issue['user_id'] != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this issue")
    
    update_data = {k: v for k, v in issue_update.dict().items() if v is not None}
    if update_data:
        update_data['updated_at'] = datetime.utcnow()
        
        # If assigning to official, get their name
        if 'assigned_official_id' in update_data:
            official = await db.govt_officials.find_one({"id": update_data['assigned_official_id']})
            if official:
                update_data['assigned_official_name'] = official['name']
        
        await db.issues.update_one({"id": issue_id}, {"$set": update_data})
    
    updated_issue = await db.issues.find_one({"id": issue_id})
    return Issue(**updated_issue)

@api_router.post("/issues/{issue_id}/upvote", response_model=Issue)
async def upvote_issue(
    issue_id: str,
    user: User = Depends(get_current_user)
):
    """Upvote an issue"""
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    upvoted_by = issue.get('upvoted_by', [])
    
    if user.id in upvoted_by:
        # Remove upvote
        upvoted_by.remove(user.id)
        new_upvotes = max(0, issue.get('upvotes', 0) - 1)
    else:
        # Add upvote
        upvoted_by.append(user.id)
        new_upvotes = issue.get('upvotes', 0) + 1
    
    await db.issues.update_one(
        {"id": issue_id},
        {"$set": {"upvotes": new_upvotes, "upvoted_by": upvoted_by, "updated_at": datetime.utcnow()}}
    )
    
    updated_issue = await db.issues.find_one({"id": issue_id})
    return Issue(**updated_issue)

@api_router.get("/issues/user/me", response_model=List[Issue])
async def get_my_issues(
    user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
):
    """Get issues created by current user"""
    issues = await db.issues.find({"user_id": user.id}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [Issue(**issue) for issue in issues]

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
    query = {"is_active": True}
    
    if designation:
        query["designation"] = designation
    if hierarchy_level:
        query["hierarchy_level"] = hierarchy_level
    if area:
        query["area"] = {"$regex": area, "$options": "i"}
    if category:
        query["categories"] = category
    
    officials = await db.govt_officials.find(query).sort("hierarchy_level", 1).skip(skip).limit(limit).to_list(limit)
    return [GovtOfficial(**official) for official in officials]

@api_router.get("/officials/hierarchy")
async def get_officials_by_hierarchy():
    """Get officials grouped by hierarchy level"""
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {
            "_id": "$hierarchy_level",
            "designation": {"$first": "$designation"},
            "count": {"$sum": 1},
            "officials": {"$push": {
                "id": "$id",
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

@api_router.get("/officials/{official_id}", response_model=GovtOfficial)
async def get_official(official_id: str):
    """Get a specific official by ID"""
    official = await db.govt_officials.find_one({"id": official_id})
    if not official:
        raise HTTPException(status_code=404, detail="Official not found")
    return GovtOfficial(**official)

# ----- Admin Routes -----

@api_router.post("/admin/officials", response_model=GovtOfficial)
async def create_official(
    official_data: GovtOfficialCreate,
    user: User = Depends(verify_admin)
):
    """Create a new government official (Admin only)"""
    new_official = GovtOfficial(**official_data.dict())
    await db.govt_officials.insert_one(new_official.dict())
    return new_official

@api_router.post("/admin/officials/bulk", response_model=dict)
async def bulk_create_officials(
    officials: List[GovtOfficialCreate],
    user: User = Depends(verify_admin)
):
    """Bulk create government officials (Admin only)"""
    created = []
    for official_data in officials:
        new_official = GovtOfficial(**official_data.dict())
        await db.govt_officials.insert_one(new_official.dict())
        created.append(new_official.id)
    
    return {"message": f"Created {len(created)} officials", "ids": created}

@api_router.put("/admin/officials/{official_id}", response_model=GovtOfficial)
async def update_official(
    official_id: str,
    official_data: GovtOfficialCreate,
    user: User = Depends(verify_admin)
):
    """Update a government official (Admin only)"""
    existing = await db.govt_officials.find_one({"id": official_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Official not found")
    
    update_data = official_data.dict()
    await db.govt_officials.update_one({"id": official_id}, {"$set": update_data})
    
    updated = await db.govt_officials.find_one({"id": official_id})
    return GovtOfficial(**updated)

@api_router.delete("/admin/officials/{official_id}")
async def delete_official(
    official_id: str,
    user: User = Depends(verify_admin)
):
    """Delete a government official (Admin only)"""
    result = await db.govt_officials.delete_one({"id": official_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Official not found")
    return {"message": "Official deleted successfully"}

@api_router.post("/admin/make-admin/{firebase_uid}")
async def make_user_admin(
    firebase_uid: str,
    admin: User = Depends(verify_admin)
):
    """Make a user an admin (Super Admin only)"""
    result = await db.users.update_one(
        {"firebase_uid": firebase_uid},
        {"$set": {"is_admin": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User is now an admin"}

# ----- Stats Route -----

@api_router.get("/stats")
async def get_stats():
    """Get platform statistics"""
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
