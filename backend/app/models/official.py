from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid


class GovtOfficial(BaseModel):
    """Government official model"""
    id: str = Field(default=None)

    def __init__(self, **data):
        # Use _id from MongoDB if id not provided
        if 'id' not in data and '_id' in data:
            data['id'] = str(data['_id'])
        elif 'id' not in data:
            data['id'] = str(uuid.uuid4())
        super().__init__(**data)
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
    """Government official creation request model"""
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
