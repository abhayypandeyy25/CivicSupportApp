# Quick Test Guide - 5 Minutes

## Automated Setup (Recommended)

```bash
cd /Users/abhaypandey/Desktop/CivicSupportApp
./setup.sh
```

This will:
- ✅ Check MongoDB
- ✅ Create .env file
- ✅ Install dependencies
- ✅ Initialize database
- ✅ Run verification

**Then follow the on-screen instructions!**

---

## Manual Setup (If Needed)

### 1. Install MongoDB (One-time)

```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### 2. Setup Backend (One-time)

```bash
cd backend

# Create environment file
cp .env.example .env
# Edit .env - set MONGO_URL and DB_NAME

# Install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Initialize database
python3 init_db.py
```

### 3. Start Backend (Every time)

```bash
cd backend
source venv/bin/activate
uvicorn server:app --reload
```

Leave this running! Open new terminal for next steps.

---

## Quick Tests

### Test 1: Server Health

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"healthy",...}`

### Test 2: Insert Test Data

```bash
mongosh civicsense << 'EOF'
db.issues.insertOne({
  id: "test-location-001",
  title: "Test Issue - Connaught Place",
  category: "roads",
  status: "pending",
  location: {
    coordinates: [77.2090, 28.6139],
    latitude: 28.6139,
    longitude: 77.2090
  },
  created_at: new Date()
})
print("✅ Test data inserted")
EOF
```

### Test 3: Query by Location

```bash
curl "http://localhost:8000/api/issues?latitude=28.6139&longitude=77.2090&radius_km=5"
```

Expected: Returns your test issue

### Test 4: Verify Index

```bash
mongosh civicsense --eval "db.issues.getIndexes().find(i => i.name === 'location_2dsphere_idx')"
```

Expected: Shows the geospatial index

---

## Verification Script

```bash
cd backend
python3 verify_features.py
```

This checks everything automatically!

---

## What You Should See

If everything is working:

```
✅ MongoDB: Connected
✅ Geospatial Index: Exists
✅ AI Library: Installed
✅ Dependencies: All installed
✅ Configuration: Complete

AI Classification: READY (or fallback mode)
Location Queries: OPTIMIZED (100x faster)
```

---

## Common Issues

### MongoDB not running
```bash
brew services start mongodb-community
```

### Port 8000 in use
```bash
uvicorn server:app --reload --port 8001
```

### Dependencies missing
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

---

## Full Documentation

- **[SETUP_AND_TEST.md](SETUP_AND_TEST.md)** - Complete step-by-step guide
- **[AI_LOCATION_VERIFICATION.md](AI_LOCATION_VERIFICATION.md)** - Feature verification
- **[QUICKSTART.md](QUICKSTART.md)** - General quickstart

---

## Next: Test in Mobile App

Once backend is running:

```bash
cd frontend
npm install
npm start
```

Then test:
1. Create an issue (AI will auto-classify)
2. Browse nearby issues (location-based search)
3. Import CSV with new hierarchy levels/categories

---

**Questions?** Check the full guides above or run `python3 verify_features.py` for diagnostics.
