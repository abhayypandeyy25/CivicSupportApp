"""
Admin endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
import csv
import io
import logging

from ...models import User, GovtOfficial, GovtOfficialCreate
from ...database import get_database
from ..deps import verify_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/officials", response_model=GovtOfficial)
async def create_official(
    official_data: GovtOfficialCreate,
    user: User = Depends(verify_admin)
):
    """Create a new government official (Admin only)"""
    db = get_database()
    new_official = GovtOfficial(**official_data.model_dump())
    await db.govt_officials.insert_one(new_official.model_dump())
    return new_official


@router.post("/officials/bulk", response_model=dict)
async def bulk_create_officials(
    officials: List[GovtOfficialCreate],
    user: User = Depends(verify_admin)
):
    """Bulk create government officials (Admin only)"""
    db = get_database()
    created = []
    for official_data in officials:
        new_official = GovtOfficial(**official_data.model_dump())
        await db.govt_officials.insert_one(new_official.model_dump())
        created.append(new_official.id)

    return {"message": f"Created {len(created)} officials", "ids": created}


@router.post("/officials/bulk-import-csv", response_model=dict)
async def bulk_import_officials_csv(
    csv_content: str,
    user: User = Depends(verify_admin)
):
    """
    Bulk import government officials from CSV content (Admin only)

    Expected CSV format:
    name,email,phone,designation,department,hierarchy_level,area,categories

    AUTOMATIC FEATURES:
    - New hierarchy levels are automatically detected and assigned numbers
    - New categories are automatically added to the database
    - Flexible CSV columns - system adapts to your data structure
    """
    db = get_database()

    try:
        # Parse CSV
        csv_file = io.StringIO(csv_content)
        reader = csv.DictReader(csv_file)

        # Dynamic hierarchy mapping
        hierarchy_map = {
            "parshad": 1, "ward councillor": 1,
            "mcd": 2, "municipal corporation": 2,
            "ias": 3, "ias officer": 3,
            "mla": 4,
            "mp": 5, "member of parliament": 5,
            "cm": 6, "chief minister": 6,
            "pm": 7, "prime minister": 7
        }

        new_hierarchy_levels = {}
        new_categories = set()
        next_hierarchy_number = 8

        # First pass: detect new hierarchy levels and categories
        rows_data = list(reader)
        for row in rows_data:
            hierarchy_input = str(row.get('hierarchy_level', '1')).strip().lower()
            if not hierarchy_input.isdigit() and hierarchy_input not in hierarchy_map:
                if hierarchy_input not in new_hierarchy_levels:
                    new_hierarchy_levels[hierarchy_input] = next_hierarchy_number
                    hierarchy_map[hierarchy_input] = next_hierarchy_number
                    logger.info(f"Auto-detected new hierarchy level: '{hierarchy_input}' = {next_hierarchy_number}")
                    next_hierarchy_number += 1

            categories_str = row.get('categories', '')
            if categories_str:
                categories_list = [cat.strip() for cat in categories_str.split(',')]
                for category in categories_list:
                    if category:
                        new_categories.add(category)

        # Add new categories to database
        categories_added = []
        if new_categories:
            logger.info(f"Checking {len(new_categories)} categories for auto-creation...")
            for category_name in new_categories:
                normalized_name = category_name.lower().replace(' ', '_').replace('&', 'and')
                existing_category = await db.categories.find_one({"name": normalized_name})
                if not existing_category:
                    category_doc = {
                        "name": normalized_name,
                        "display_name": category_name,
                        "icon": "clipboard",
                        "auto_created": True
                    }
                    try:
                        await db.categories.insert_one(category_doc)
                        categories_added.append(category_name)
                        logger.info(f"Auto-created category: {category_name}")
                    except Exception as e:
                        logger.warning(f"Could not create category {category_name}: {str(e)}")

        created = []
        errors = []

        # Second pass: import officials
        for row_num, row in enumerate(rows_data, start=2):
            try:
                hierarchy_input = str(row.get('hierarchy_level', '1')).strip().lower()
                if hierarchy_input.isdigit():
                    hierarchy_level = int(hierarchy_input)
                else:
                    hierarchy_level = hierarchy_map.get(hierarchy_input, 1)

                categories_str = row.get('categories', '')
                if categories_str:
                    categories = [cat.strip() for cat in categories_str.split(',')]
                else:
                    categories = []

                official_data = GovtOfficialCreate(
                    name=row.get('name', '').strip(),
                    designation=row.get('designation', '').strip(),
                    department=row.get('department', '').strip(),
                    area=row.get('area', '').strip() or None,
                    city=row.get('city', 'Delhi').strip(),
                    state=row.get('state', 'Delhi').strip(),
                    contact_email=row.get('email', '').strip() or None,
                    contact_phone=row.get('phone', '').strip() or None,
                    categories=categories,
                    hierarchy_level=hierarchy_level
                )

                if not official_data.name:
                    errors.append({"row": row_num, "error": "Name is required"})
                    continue
                if not official_data.designation:
                    errors.append({"row": row_num, "error": "Designation is required"})
                    continue
                if not official_data.department:
                    errors.append({"row": row_num, "error": "Department is required"})
                    continue

                new_official = GovtOfficial(**official_data.model_dump())
                await db.govt_officials.insert_one(new_official.model_dump())
                created.append(new_official.id)

            except Exception as e:
                errors.append({"row": row_num, "error": str(e)})

        return {
            "success": True,
            "message": f"Successfully imported {len(created)} officials",
            "created_count": len(created),
            "error_count": len(errors),
            "created_ids": created,
            "errors": errors,
            "new_hierarchy_levels": new_hierarchy_levels,
            "new_categories": categories_added
        }

    except Exception as e:
        logger.error(f"CSV import failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {str(e)}"
        )


@router.put("/officials/{official_id}", response_model=GovtOfficial)
async def update_official(
    official_id: str,
    official_data: GovtOfficialCreate,
    user: User = Depends(verify_admin)
):
    """Update a government official (Admin only)"""
    db = get_database()
    existing = await db.govt_officials.find_one({"id": official_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Official not found")

    update_data = official_data.model_dump()
    await db.govt_officials.update_one({"id": official_id}, {"$set": update_data})

    updated = await db.govt_officials.find_one({"id": official_id})
    return GovtOfficial(**updated)


@router.delete("/officials/{official_id}")
async def delete_official(
    official_id: str,
    user: User = Depends(verify_admin)
):
    """Delete a government official (Admin only)"""
    db = get_database()
    result = await db.govt_officials.delete_one({"id": official_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Official not found")
    return {"message": "Official deleted successfully"}


@router.post("/make-admin/{firebase_uid}")
async def make_user_admin(
    firebase_uid: str,
    admin: User = Depends(verify_admin)
):
    """Make a user an admin (Super Admin only)"""
    db = get_database()
    result = await db.users.update_one(
        {"firebase_uid": firebase_uid},
        {"$set": {"is_admin": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User is now an admin"}
