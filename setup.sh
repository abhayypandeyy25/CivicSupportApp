#!/bin/bash

# CivicSense Setup Script
# This script automates the setup process for backend

set -e  # Exit on error

echo "=========================================="
echo "CivicSense Backend Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to backend directory
cd "$(dirname "$0")/backend"

# Step 1: Check MongoDB
echo "Step 1: Checking MongoDB..."
if command -v mongod &> /dev/null; then
    echo -e "${GREEN}✅ MongoDB is installed${NC}"

    if pgrep -x mongod > /dev/null; then
        echo -e "${GREEN}✅ MongoDB is running${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB is not running${NC}"
        echo "   Start it with: brew services start mongodb-community"
        echo "   Or: mongod --dbpath /usr/local/var/mongodb"
    fi
else
    echo -e "${RED}❌ MongoDB is not installed${NC}"
    echo ""
    echo "Install MongoDB:"
    echo "  brew tap mongodb/brew"
    echo "  brew install mongodb-community"
    echo "  brew services start mongodb-community"
    echo ""
    echo "Or use Docker:"
    echo "  docker run -d -p 27017:27017 --name mongodb mongo:latest"
    echo ""
    exit 1
fi

echo ""

# Step 2: Check Python version
echo "Step 2: Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    echo -e "${GREEN}✅ Python installed: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

echo ""

# Step 3: Create .env file if it doesn't exist
echo "Step 3: Setting up environment file..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found, creating from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env file and set:${NC}"
    echo "   - MONGO_URL=mongodb://localhost:27017"
    echo "   - DB_NAME=civicsense"
    echo "   - EMERGENT_LLM_KEY=your_api_key (optional for AI)"
    echo ""
    echo "Generate JWT secret:"
    echo "   python3 -c \"import secrets; print(secrets.token_urlsafe(32))\""
    echo ""
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

echo ""

# Step 4: Create virtual environment
echo "Step 4: Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${GREEN}✅ Virtual environment exists${NC}"
fi

echo ""

# Step 5: Install dependencies
echo "Step 5: Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip > /dev/null 2>&1
echo "Installing packages (this may take a minute)..."
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo ""

# Step 6: Test MongoDB connection
echo "Step 6: Testing MongoDB connection..."
python3 << 'EOF'
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.getenv('MONGO_URL')
db_name = os.getenv('DB_NAME')

if not mongo_url or not db_name:
    print("❌ MONGO_URL or DB_NAME not set in .env")
    print("   Edit .env file and set these values")
    exit(1)

print(f"✅ Configuration found:")
print(f"   MONGO_URL: {mongo_url}")
print(f"   DB_NAME: {db_name}")

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio

    async def test_connection():
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)
        await client.admin.command('ping')
        print("✅ MongoDB connection successful")
        client.close()

    asyncio.run(test_connection())
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    print("   Make sure MongoDB is running")
    exit(1)
EOF

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Setup cannot continue without database connection${NC}"
    exit 1
fi

echo ""

# Step 7: Initialize database
echo "Step 7: Initializing database (creating indexes)..."
python3 init_db.py

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database initialized successfully${NC}"
else
    echo -e "${RED}❌ Database initialization failed${NC}"
    exit 1
fi

echo ""

# Step 8: Run verification
echo "Step 8: Running feature verification..."
python3 verify_features.py

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start the backend server:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   uvicorn server:app --reload"
echo ""
echo "2. In a new terminal, start the frontend:"
echo "   cd frontend"
echo "   npm install"
echo "   npm start"
echo ""
echo "3. Test the setup:"
echo "   Open http://localhost:8000/docs"
echo ""
echo "For detailed testing instructions, see:"
echo "   SETUP_AND_TEST.md"
echo "   AI_LOCATION_VERIFICATION.md"
echo ""
echo "=========================================="
