# Testing Guide - CivicSense

Complete testing strategy from development to production.

---

## Table of Contents
1. [Quick Test (5 Minutes)](#quick-test-5-minutes)
2. [Manual Testing](#manual-testing)
3. [Automated Testing](#automated-testing)
4. [Performance Testing](#performance-testing)
5. [Security Testing](#security-testing)
6. [Mobile App Testing](#mobile-app-testing)

---

## Quick Test (5 Minutes)

### Prerequisites
```bash
# Backend running
cd backend
source venv/bin/activate
uvicorn server:app --reload
```

### Test Suite

```bash
# 1. Health Check
curl http://localhost:8000/health
# Expected: {"status":"healthy","timestamp":"..."}

# 2. API Documentation
open http://localhost:8000/docs
# Expected: Interactive API documentation

# 3. Categories Endpoint
curl http://localhost:8000/api/categories
# Expected: List of issue categories

# 4. Database Connection
mongosh civicsense --eval "db.stats()"
# Expected: Database statistics

# 5. Geospatial Index
mongosh civicsense --eval "db.issues.getIndexes().find(i => i.name === 'location_2dsphere_idx')"
# Expected: Index details

# 6. Verify Feature Script
cd backend
python3 verify_features.py
# Expected: All green checkmarks
```

✅ If all pass, your setup is correct!

---

## Manual Testing

### Backend API Testing

#### Test 1: Create Test User

```bash
# Using MongoDB directly
mongosh civicsense << 'EOF'
db.users.insertOne({
  id: "test-user-001",
  firebase_uid: "test-firebase-uid",
  email: "test@civicsense.com",
  display_name: "Test User",
  phone_number: "+919876543210",
  is_admin: true,
  created_at: new Date()
})
print("✅ Test user created")
EOF
```

#### Test 2: Insert Test Issues

```bash
mongosh civicsense << 'EOF'
db.issues.insertMany([
  {
    id: "issue-001",
    user_id: "test-user-001",
    title: "Pothole on Main Road",
    description: "Large pothole causing accidents near Connaught Place",
    category: "roads",
    status: "pending",
    location: {
      coordinates: [77.2090, 28.6139],
      latitude: 28.6139,
      longitude: 77.2090,
      address: "Connaught Place, New Delhi"
    },
    photos: [],
    upvotes: 5,
    created_at: new Date(),
    ai_suggested_category: "roads"
  },
  {
    id: "issue-002",
    user_id: "test-user-001",
    title: "Garbage Pile",
    description: "Garbage not collected for 5 days",
    category: "sanitation",
    status: "pending",
    location: {
      coordinates: [77.2250, 28.6200],
      latitude: 28.6200,
      longitude: 77.2250,
      address: "Khan Market, New Delhi"
    },
    photos: [],
    upvotes: 12,
    created_at: new Date()
  },
  {
    id: "issue-003",
    user_id: "test-user-001",
    title: "Street Light Broken",
    description: "Dark street at night",
    category: "electricity",
    status: "in_progress",
    location: {
      coordinates: [77.1900, 28.6100],
      latitude: 28.6100,
      longitude: 77.1900,
      address: "Patel Nagar, New Delhi"
    },
    photos: [],
    upvotes: 3,
    created_at: new Date()
  }
])
print("✅ Test issues created")
EOF
```

#### Test 3: Query Issues

```bash
# Get all issues
curl http://localhost:8000/api/issues | jq

# Get issues near Connaught Place (5km radius)
curl "http://localhost:8000/api/issues?latitude=28.6139&longitude=77.2090&radius_km=5" | jq

# Filter by category
curl "http://localhost:8000/api/issues?category=roads" | jq

# Filter by status
curl "http://localhost:8000/api/issues?status=pending" | jq

# Combined filters
curl "http://localhost:8000/api/issues?latitude=28.6139&longitude=77.2090&radius_km=10&category=roads&status=pending" | jq
```

#### Test 4: Test Officials Endpoints

```bash
# Get all officials
curl http://localhost:8000/api/officials | jq

# Get officials by hierarchy
curl http://localhost:8000/api/officials/hierarchy | jq

# Filter by hierarchy level
curl "http://localhost:8000/api/officials?hierarchy_level=1" | jq

# Filter by area
curl "http://localhost:8000/api/officials?area=Dwarka" | jq
```

#### Test 5: CSV Import (Auto-Create Feature)

```bash
# Create test CSV with NEW hierarchy levels and categories
cat > /tmp/test_import.csv << 'EOF'
name,email,phone,designation,department,hierarchy_level,area,categories
Test Officer,test@gov.in,+919999999999,District Officer,Test Department,District Officer,"Test Area","New Category 1,New Category 2"
EOF

# Read CSV content
CSV_CONTENT=$(cat /tmp/test_import.csv)

# Import (requires authentication - use admin token)
curl -X POST http://localhost:8000/api/admin/officials/bulk-import-csv \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"csv_content\": \"$(echo "$CSV_CONTENT" | sed 's/"/\\"/g' | tr '\n' '\\n')\"}" | jq

# Expected: Shows new hierarchy level "District Officer" = 8
# Expected: Shows new categories created
```

#### Test 6: Performance - Geospatial Query

```bash
# Time the query
time curl "http://localhost:8000/api/issues?latitude=28.6139&longitude=77.2090&radius_km=5"

# Expected: < 50ms with index
# If > 500ms, index is missing!
```

---

## Automated Testing

### Setup Test Environment

```bash
cd backend

# Install test dependencies
pip install pytest pytest-asyncio pytest-cov httpx

# Create tests directory
mkdir -p tests
```

### Unit Tests

Create `backend/tests/test_api.py`:

```python
import pytest
from httpx import AsyncClient
from server import app

@pytest.mark.asyncio
async def test_health_endpoint():
    """Test health check endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data

@pytest.mark.asyncio
async def test_root_endpoint():
    """Test root endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/")
        assert response.status_code == 200
        assert "message" in response.json()

@pytest.mark.asyncio
async def test_categories_endpoint():
    """Test categories endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0

@pytest.mark.asyncio
async def test_issues_query_validation():
    """Test issues endpoint with invalid parameters"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test with too large radius
        response = await client.get("/api/issues?latitude=28.6139&longitude=77.2090&radius_km=150")
        assert response.status_code == 400

@pytest.mark.asyncio
async def test_geospatial_query():
    """Test geospatial query works"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/issues?latitude=28.6139&longitude=77.2090&radius_km=5")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
```

### Database Tests

Create `backend/tests/test_database.py`:

```python
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

@pytest.mark.asyncio
async def test_mongodb_connection():
    """Test MongoDB connection"""
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"), serverSelectionTimeoutMS=3000)
    try:
        result = await client.admin.command('ping')
        assert result['ok'] == 1.0
    finally:
        client.close()

@pytest.mark.asyncio
async def test_geospatial_index_exists():
    """Test that 2dsphere index exists"""
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME")]

    try:
        indexes = await db.issues.index_information()
        assert 'location_2dsphere_idx' in indexes

        index_info = indexes['location_2dsphere_idx']
        assert '2dsphere' in str(index_info['key'])
    finally:
        client.close()

@pytest.mark.asyncio
async def test_required_indexes_exist():
    """Test all required indexes exist"""
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME")]

    try:
        # Check issues indexes
        issues_indexes = await db.issues.index_information()
        assert 'category_status_idx' in issues_indexes
        assert 'user_id_idx' in issues_indexes
        assert 'location_2dsphere_idx' in issues_indexes

        # Check users indexes
        users_indexes = await db.users.index_information()
        assert 'firebase_uid_unique' in users_indexes

        # Check govt_officials indexes
        officials_indexes = await db.govt_officials.index_information()
        assert 'hierarchy_active_idx' in officials_indexes
    finally:
        client.close()
```

### Run Tests

```bash
cd backend

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html

# Run specific test file
pytest tests/test_api.py -v

# Run specific test
pytest tests/test_api.py::test_health_endpoint -v
```

---

## Performance Testing

### Apache Bench (Load Testing)

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test health endpoint (light)
ab -n 1000 -c 10 http://localhost:8000/health

# Expected Results:
# Requests per second: > 1000
# Time per request: < 10ms

# Test issues endpoint (medium)
ab -n 500 -c 10 "http://localhost:8000/api/issues"

# Expected Results:
# Requests per second: > 200
# Time per request: < 50ms

# Test geospatial query (heavy)
ab -n 100 -c 5 "http://localhost:8000/api/issues?latitude=28.6139&longitude=77.2090&radius_km=5"

# Expected Results (WITH index):
# Requests per second: > 100
# Time per request: < 50ms

# Expected Results (WITHOUT index):
# Requests per second: < 10 (SLOW!)
# Time per request: > 500ms
```

### Database Performance

```javascript
// In mongosh
use civicsense

// Enable profiling
db.setProfilingLevel(1, { slowms: 100 })

// Run some queries...

// Check slow queries
db.system.profile.find({millis: {$gt: 100}}).sort({ts: -1}).limit(10)

// Explain query to check index usage
db.issues.find({
  "location.coordinates": {
    $geoWithin: {
      $centerSphere: [[77.2090, 28.6139], 5/6371]
    }
  }
}).explain("executionStats")

// Look for:
// - "stage": "IXSCAN" (good - using index)
// - NOT "stage": "COLLSCAN" (bad - full scan)
// - "executionTimeMillis": < 10 (fast)
```

---

## Security Testing

### 1. Rate Limiting Test

```bash
# Test rate limiting (should block after 100 requests/minute)
for i in {1..150}; do
  curl -w "\n" http://localhost:8000/health
  sleep 0.1
done

# Expected: First 100 succeed, rest get 429 Too Many Requests
```

### 2. CORS Test

```bash
# Test CORS from unauthorized origin
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS http://localhost:8000/api/issues

# Expected: No Access-Control-Allow-Origin header (blocked)

# Test from authorized origin
curl -H "Origin: http://localhost:8081" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS http://localhost:8000/api/issues

# Expected: Access-Control-Allow-Origin: http://localhost:8081
```

### 3. Input Validation Test

```bash
# Test with oversized input (should fail validation)
curl -X POST http://localhost:8000/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Short",
    "description": "Too short",
    "category": "roads"
  }'

# Expected: 400 Bad Request with validation errors
```

### 4. Security Headers Test

```bash
# Check security headers
curl -I http://localhost:8000/health

# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000
```

---

## Mobile App Testing

### Expo Development Testing

```bash
cd frontend

# Start Expo dev server
npm start

# Test on:
# - Press 'a' for Android
# - Press 'i' for iOS
# - Scan QR for physical device
```

### Test Flows

#### 1. User Authentication
- [ ] Email login works
- [ ] Phone login works
- [ ] Google login works
- [ ] User persists after restart
- [ ] Logout works

#### 2. Issue Creation
- [ ] Can take photo
- [ ] Can add title (5-200 chars)
- [ ] Can add description (10-2000 chars)
- [ ] Location auto-detected
- [ ] Can select category
- [ ] Submission succeeds
- [ ] AI classification shows (if enabled)

#### 3. Issue Browsing
- [ ] See nearby issues on map
- [ ] Filter by category works
- [ ] Filter by status works
- [ ] Distance calculation correct
- [ ] Can upvote issues
- [ ] Pull to refresh works

#### 4. Admin Panel
- [ ] Admin users see admin tab
- [ ] Can add official manually
- [ ] Can import CSV
- [ ] Auto-create features work
- [ ] Shows import results
- [ ] Officials list updates

### Network Testing

```bash
# Test with slow network
# In Chrome DevTools:
# Network tab → Throttling → Slow 3G

# Expected:
# - App shows loading states
# - Requests timeout gracefully
# - Error messages are clear
```

---

## CI/CD Testing (GitHub Actions)

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run tests
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: civicsense_test
        run: |
          cd backend
          pytest tests/ -v --cov

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Test Checklist

### Before Deployment

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Database indexes verified
- [ ] Performance tests acceptable
- [ ] Security tests pass
- [ ] Manual smoke tests done
- [ ] Mobile app tested on real devices

### After Deployment

- [ ] Health check succeeds
- [ ] API documentation accessible
- [ ] Test user can login
- [ ] Can create/view issues
- [ ] Geospatial queries fast (< 50ms)
- [ ] CSV import works
- [ ] Auto-create features work
- [ ] Error tracking active
- [ ] Monitoring dashboards working

---

## Troubleshooting Tests

### Tests Fail with "Connection Refused"
```bash
# Make sure MongoDB is running
brew services start mongodb-community

# Or start manually
mongod --dbpath /usr/local/var/mongodb
```

### Tests Fail with "Index Not Found"
```bash
# Reinitialize database
python3 backend/init_db.py
```

### Slow Performance Tests
```bash
# Check if index exists
mongosh civicsense --eval "db.issues.getIndexes()"

# Recreate index if missing
mongosh civicsense --eval 'db.issues.createIndex({"location.coordinates": "2dsphere"})'
```

### Rate Limiting Blocks Tests
```bash
# Wait 1 minute or restart server
# Or temporarily increase limits in server.py
```

---

## Quick Test Commands Reference

```bash
# Health check
curl http://localhost:8000/health

# Run all tests
cd backend && pytest tests/ -v

# Load test
ab -n 1000 -c 10 http://localhost:8000/health

# Verify features
python3 backend/verify_features.py

# Check database
mongosh civicsense --eval "db.stats()"

# Check indexes
mongosh civicsense --eval "db.issues.getIndexes()"
```

---

**Ready to test?** Start with the Quick Test section! ✅
