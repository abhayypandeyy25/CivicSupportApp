"""
Database initialization script for CivicSense
Creates indexes and ensures optimal query performance
"""
import asyncio
import os
import logging
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def create_indexes():
    """Create all required database indexes for optimal performance"""

    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')

    if not mongo_url or not db_name:
        raise ValueError("MONGO_URL and DB_NAME environment variables are required")

    logger.info(f"Connecting to MongoDB: {db_name}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        # ==================== USERS COLLECTION ====================
        logger.info("Creating indexes for 'users' collection...")

        # Unique index on firebase_uid for fast user lookup
        await db.users.create_index([("firebase_uid", 1)], unique=True, name="firebase_uid_unique")
        logger.info("✓ Created unique index on users.firebase_uid")

        # Index on email for user search
        await db.users.create_index([("email", 1)], sparse=True, name="email_idx")
        logger.info("✓ Created index on users.email")

        # Index on created_at for sorting
        await db.users.create_index([("created_at", -1)], name="users_created_at_idx")
        logger.info("✓ Created index on users.created_at")


        # ==================== ISSUES COLLECTION ====================
        logger.info("Creating indexes for 'issues' collection...")

        # Compound index for category and status filtering
        await db.issues.create_index(
            [("category", 1), ("status", 1)],
            name="category_status_idx"
        )
        logger.info("✓ Created compound index on issues.category + status")

        # Index on user_id for fetching user's issues
        await db.issues.create_index([("user_id", 1)], name="user_id_idx")
        logger.info("✓ Created index on issues.user_id")

        # Index on created_at for sorting by date
        await db.issues.create_index([("created_at", -1)], name="issues_created_at_idx")
        logger.info("✓ Created index on issues.created_at")

        # Index on status for filtering
        await db.issues.create_index([("status", 1)], name="status_idx")
        logger.info("✓ Created index on issues.status")

        # Geospatial 2dsphere index for location-based queries
        # NOTE: Requires location to be stored as GeoJSON format
        # Format: { "type": "Point", "coordinates": [longitude, latitude] }
        await db.issues.create_index(
            [("location.coordinates", "2dsphere")],
            name="location_2dsphere_idx"
        )
        logger.info("✓ Created 2dsphere index on issues.location.coordinates")

        # Index on upvotes for sorting by popularity
        await db.issues.create_index([("upvotes", -1)], name="upvotes_idx")
        logger.info("✓ Created index on issues.upvotes")

        # Index on assigned_official_id for official's dashboard
        await db.issues.create_index(
            [("assigned_official_id", 1)],
            sparse=True,
            name="assigned_official_idx"
        )
        logger.info("✓ Created index on issues.assigned_official_id")


        # ==================== GOVT_OFFICIALS COLLECTION ====================
        logger.info("Creating indexes for 'govt_officials' collection...")

        # Compound index for hierarchy level and active status
        await db.govt_officials.create_index(
            [("hierarchy_level", 1), ("is_active", 1)],
            name="hierarchy_active_idx"
        )
        logger.info("✓ Created compound index on govt_officials.hierarchy_level + is_active")

        # Index on categories for matching issues
        await db.govt_officials.create_index(
            [("categories", 1)],
            name="categories_idx"
        )
        logger.info("✓ Created index on govt_officials.categories")

        # Index on area for location-based assignment
        await db.govt_officials.create_index(
            [("area", 1)],
            sparse=True,
            name="area_idx"
        )
        logger.info("✓ Created index on govt_officials.area")

        # Index on department for filtering
        await db.govt_officials.create_index(
            [("department", 1)],
            name="department_idx"
        )
        logger.info("✓ Created index on govt_officials.department")


        # ==================== CATEGORIES COLLECTION ====================
        logger.info("Creating indexes for 'categories' collection...")

        # Index on name for fast lookup
        await db.categories.create_index([("name", 1)], unique=True, name="category_name_unique")
        logger.info("✓ Created unique index on categories.name")


        logger.info("\n" + "="*60)
        logger.info("All indexes created successfully!")
        logger.info("="*60)

        # List all indexes for verification
        logger.info("\nVerifying indexes...")
        for collection_name in ['users', 'issues', 'govt_officials', 'categories']:
            indexes = await db[collection_name].index_information()
            logger.info(f"\n{collection_name} indexes:")
            for index_name, index_info in indexes.items():
                logger.info(f"  - {index_name}: {index_info.get('key', [])}")

    except Exception as e:
        logger.error(f"Error creating indexes: {str(e)}", exc_info=True)
        raise
    finally:
        client.close()
        logger.info("\nDatabase connection closed")


async def seed_categories():
    """Seed default categories if they don't exist"""

    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        logger.info("Seeding default categories...")

        default_categories = [
            {"name": "roads", "display_name": "Roads & Infrastructure", "icon": "🛣️"},
            {"name": "sanitation", "display_name": "Sanitation & Cleanliness", "icon": "🧹"},
            {"name": "water", "display_name": "Water Supply", "icon": "💧"},
            {"name": "electricity", "display_name": "Electricity & Streetlights", "icon": "💡"},
            {"name": "drainage", "display_name": "Drainage & Sewage", "icon": "🚰"},
            {"name": "parks", "display_name": "Parks & Green Spaces", "icon": "🌳"},
            {"name": "traffic", "display_name": "Traffic & Transportation", "icon": "🚦"},
            {"name": "pollution", "display_name": "Pollution & Environment", "icon": "🌫️"},
            {"name": "construction", "display_name": "Illegal Construction", "icon": "🏗️"},
            {"name": "other", "display_name": "Other Issues", "icon": "📋"},
        ]

        for category in default_categories:
            existing = await db.categories.find_one({"name": category["name"]})
            if not existing:
                await db.categories.insert_one(category)
                logger.info(f"✓ Added category: {category['name']}")
            else:
                logger.info(f"  Category already exists: {category['name']}")

        logger.info("Categories seeded successfully!")

    except Exception as e:
        logger.error(f"Error seeding categories: {str(e)}", exc_info=True)
        raise
    finally:
        client.close()


async def main():
    """Main initialization function"""
    logger.info("Starting database initialization...\n")

    try:
        await create_indexes()
        await seed_categories()

        logger.info("\n" + "="*60)
        logger.info("Database initialization completed successfully!")
        logger.info("="*60)

    except Exception as e:
        logger.error(f"\nDatabase initialization failed: {str(e)}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
