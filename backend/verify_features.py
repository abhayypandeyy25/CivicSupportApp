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
llm_key = os.getenv('EMERGENT_LLM_KEY')

if mongo_url:
    print(f"   ✅ MONGO_URL: {mongo_url}")
else:
    print("   ❌ MONGO_URL: NOT SET")

if db_name:
    print(f"   ✅ DB_NAME: {db_name}")
else:
    print("   ❌ DB_NAME: NOT SET")

if llm_key:
    print(f"   ✅ EMERGENT_LLM_KEY: ***{llm_key[-8:]} (configured)")
else:
    print("   ⚠️  EMERGENT_LLM_KEY: NOT SET (AI will use fallback)")

# Check 2: Dependencies
print("\n2. Python Dependencies:")
dependencies = [
    ("FastAPI", "fastapi"),
    ("Motor (MongoDB)", "motor"),
    ("Firebase Admin", "firebase_admin"),
    ("EmergentIntegrations (AI)", "emergentintegrations"),
    ("Pydantic", "pydantic"),
    ("SlowAPI (Rate Limiting)", "slowapi")
]

missing = []
for name, module in dependencies:
    try:
        __import__(module)
        print(f"   ✅ {name}: Installed")
    except ImportError:
        print(f"   ❌ {name}: NOT INSTALLED")
        missing.append(module)

if missing:
    print(f"\n   ⚠️  Missing dependencies. Install with:")
    print(f"   pip install -r requirements.txt")

# Check 3: MongoDB Connection (if motor is available)
print("\n3. MongoDB Connection:")
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio

    async def check_mongo():
        if not mongo_url or not db_name:
            print("   ⚠️  Cannot test - MONGO_URL or DB_NAME not set")
            return

        try:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)
            await client.admin.command('ping')
            print(f"   ✅ MongoDB: Connected successfully")

            # Check if indexes exist
            db = client[db_name]
            indexes = await db.issues.index_information()

            if 'location_2dsphere_idx' in indexes:
                print(f"   ✅ Geospatial Index: Exists (location-based queries will be fast)")
            else:
                print(f"   ⚠️  Geospatial Index: Missing (run: python init_db.py)")

            client.close()

        except Exception as e:
            print(f"   ❌ MongoDB: Connection failed - {str(e)}")

    asyncio.run(check_mongo())

except ImportError:
    print("   ⚠️  Motor not installed - cannot test MongoDB connection")

# Check 4: AI Feature
print("\n4. AI Classification Feature:")
try:
    from emergentintegrations.llm.chat import LlmChat
    print(f"   ✅ AI Library: Installed")

    if llm_key:
        print(f"   ✅ API Key: Configured")
        print(f"   ✅ AI Classification: READY")
    else:
        print(f"   ⚠️  API Key: Not configured")
        print(f"   ℹ️  AI will use fallback mode (category='general')")

except ImportError:
    print(f"   ❌ AI Library: Not installed")
    print(f"   ℹ️  Install: pip install emergentintegrations")

# Check 5: Location Feature
print("\n5. Location-based (Geospatial) Feature:")
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    print(f"   ✅ MongoDB Driver: Installed")

    if mongo_url and db_name:
        print(f"   ✅ Database Config: Set")
        print(f"   ℹ️  Run 'python init_db.py' to create geospatial index")
    else:
        print(f"   ⚠️  Database Config: Incomplete")

except ImportError:
    print(f"   ❌ MongoDB Driver: Not installed")

# Summary
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)

if not missing and mongo_url and db_name:
    print("✅ All core dependencies installed")
    print("✅ Database configured")

    if llm_key:
        print("✅ AI feature ready (with API key)")
    else:
        print("⚠️  AI feature in fallback mode (no API key)")

    print("\nNext steps:")
    print("1. Run: python init_db.py (to create indexes)")
    print("2. Run: uvicorn server:app --reload (to start server)")
    print("3. Visit: http://localhost:8000/docs (to test API)")

else:
    print("\n⚠️  Setup incomplete. Please:")
    if missing:
        print("   - Install dependencies: pip install -r requirements.txt")
    if not mongo_url or not db_name:
        print("   - Configure environment: cp .env.example .env")
    print("   - Initialize database: python init_db.py")

print("\nFor detailed instructions, see:")
print("- AI_LOCATION_VERIFICATION.md")
print("- QUICKSTART.md")
print("=" * 60)
