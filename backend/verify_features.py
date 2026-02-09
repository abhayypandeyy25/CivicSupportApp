"""
Quick verification script for AI and Location features
Run this to check if everything is set up correctly
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

print("=" * 60)
print("CivicSense Feature Verification")
print("=" * 60)

# Check 1: Environment Variables
print("\n1. Environment Variables:")
mongo_url = os.getenv('MONGO_URL')
db_name = os.getenv('DB_NAME')
anthropic_key = os.getenv('ANTHROPIC_API_KEY')
anthropic_model = os.getenv('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')

if mongo_url:
    print(f"   MONGO_URL: {mongo_url}")
else:
    print("   MONGO_URL: NOT SET")

if db_name:
    print(f"   DB_NAME: {db_name}")
else:
    print("   DB_NAME: NOT SET")

if anthropic_key:
    print(f"   ANTHROPIC_API_KEY: ***{anthropic_key[-8:]} (configured)")
    print(f"   ANTHROPIC_MODEL: {anthropic_model}")
else:
    print("   ANTHROPIC_API_KEY: NOT SET (AI will use fallback)")

# Check 2: Dependencies
print("\n2. Python Dependencies:")
dependencies = [
    ("FastAPI", "fastapi"),
    ("Motor (MongoDB)", "motor"),
    ("Firebase Admin", "firebase_admin"),
    ("Anthropic", "anthropic"),
    ("Pydantic", "pydantic"),
    ("SlowAPI (Rate Limiting)", "slowapi")
]

missing = []
for name, module in dependencies:
    try:
        __import__(module)
        print(f"   {name}: Installed")
    except ImportError:
        print(f"   {name}: NOT INSTALLED")
        missing.append(module)

if missing:
    print(f"\n   Missing dependencies. Install with:")
    print(f"   pip install -r requirements.txt")

# Check 3: MongoDB Connection (if motor is available)
print("\n3. MongoDB Connection:")
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio

    async def check_mongo():
        if not mongo_url or not db_name:
            print("   Cannot test - MONGO_URL or DB_NAME not set")
            return

        try:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)
            await client.admin.command('ping')
            print(f"   MongoDB: Connected successfully")

            # Check if indexes exist
            db = client[db_name]
            indexes = await db.issues.index_information()

            if 'location_2dsphere_idx' in indexes:
                print(f"   Geospatial Index: Exists (location-based queries will be fast)")
            else:
                print(f"   Geospatial Index: Missing (run: python scripts/init_db.py)")

            client.close()

        except Exception as e:
            print(f"   MongoDB: Connection failed - {str(e)}")

    asyncio.run(check_mongo())

except ImportError:
    print("   Motor not installed - cannot test MongoDB connection")

# Check 4: AI Feature
print("\n4. AI Classification Feature:")
try:
    import anthropic
    print(f"   Anthropic Library: Installed")

    if anthropic_key:
        print(f"   API Key: Configured")
        print(f"   Model: {anthropic_model}")
        print(f"   AI Classification: READY")
    else:
        print(f"   API Key: Not configured")
        print(f"   AI will use fallback mode (category='general')")

except ImportError:
    print(f"   Anthropic Library: Not installed")
    print(f"   Install: pip install anthropic")

# Check 5: Location Feature
print("\n5. Location-based (Geospatial) Feature:")
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    print(f"   MongoDB Driver: Installed")

    if mongo_url and db_name:
        print(f"   Database Config: Set")
        print(f"   Run 'python scripts/init_db.py' to create geospatial index")
    else:
        print(f"   Database Config: Incomplete")

except ImportError:
    print(f"   MongoDB Driver: Not installed")

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)

if not missing and mongo_url and db_name:
    print("All core dependencies installed")
    print("Database configured")

    if anthropic_key:
        print(f"AI feature ready (using {anthropic_model})")
    else:
        print("AI feature in fallback mode (no API key)")

    print("\nNext steps:")
    print("1. Run: python scripts/init_db.py (to create indexes)")
    print("2. Run: uvicorn app.main:app --reload (to start server)")
    print("3. Visit: http://localhost:8000/docs (to test API)")

else:
    print("\nSetup incomplete. Please:")
    if missing:
        print("   - Install dependencies: pip install -r requirements.txt")
    if not mongo_url or not db_name:
        print("   - Configure environment: cp .env.example .env")
    print("   - Initialize database: python scripts/init_db.py")

print("\nFor detailed instructions, see:")
print("- QUICKSTART.md")
print("- DEPLOYMENT_GUIDE.md")
print("=" * 60)
