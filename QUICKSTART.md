# CivicSense - Quick Start Guide

Get CivicSense up and running in 10 minutes!

## Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB 4.4+ (local or cloud)
- Firebase project (for authentication)

## Step 1: Clone & Setup Backend (5 minutes)

```bash
# Navigate to project
cd CivicSupportApp/backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

## Step 2: Configure Environment Variables (2 minutes)

Edit `backend/.env`:

```bash
# REQUIRED - Set these first
MONGO_URL=mongodb://localhost:27017
DB_NAME=civicsense
FIREBASE_PROJECT_ID=your-firebase-project-id

# REQUIRED for production (optional for dev)
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
JWT_SECRET=generate-a-random-secret-here

# OPTIONAL but recommended
SENTRY_DSN=your-sentry-dsn
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### Quick MongoDB Setup Options:

**Option A: Local MongoDB**
```bash
# Install MongoDB: https://www.mongodb.com/docs/manual/installation/
# Start MongoDB
mongod
```

**Option B: MongoDB Atlas (Cloud)**
1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create cluster (free tier available)
3. Get connection string and set as `MONGO_URL`

### Firebase Setup:
1. Go to https://console.firebase.google.com
2. Create a new project (or use existing)
3. Enable Authentication → Phone/Email
4. Copy Project ID to `FIREBASE_PROJECT_ID`

## Step 3: Initialize Database (1 minute)

```bash
# Still in backend directory
python init_db.py
```

This will:
- Create all database indexes
- Seed default categories
- Verify database connection

Expected output:
```
✓ Created unique index on users.firebase_uid
✓ Created compound index on issues.category + status
✓ Created 2dsphere index on issues.location.coordinates
...
Database initialization completed successfully!
```

## Step 4: Start Backend Server (30 seconds)

```bash
# Development mode
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Or for production
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
```

Visit http://localhost:8000/docs to see the API documentation!

## Step 5: Setup Frontend (2 minutes)

```bash
# Open new terminal
cd CivicSupportApp/frontend

# Install dependencies
npm install
# or
yarn install

# Set up environment (if needed)
cp .env.example .env
# Edit with your backend URL and Firebase config
```

## Step 6: Start Frontend (30 seconds)

```bash
# Start Expo development server
npm start
# or
yarn start
```

Choose your platform:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## Step 7: Create First Admin User

After logging in with Firebase:

```javascript
// In MongoDB shell or MongoDB Compass
db.users.updateOne(
  { firebase_uid: "YOUR_FIREBASE_UID" },
  { $set: { is_admin: true } }
)
```

Find your Firebase UID in:
- Firebase Console → Authentication → Users
- Or check the database after first login

## Verification Checklist ✅

Test that everything works:

### Backend Health Check
```bash
curl http://localhost:8000/api/health
# Should return: {"status": "healthy"}
```

### Rate Limiting Test
```bash
# Send 10 rapid requests
for i in {1..10}; do curl http://localhost:8000/api/categories; done
# All should succeed (under 100/min limit)
```

### Database Indexes Check
```javascript
// In MongoDB shell
db.issues.getIndexes()
// Should show 7+ indexes including location_2dsphere_idx
```

### Security Headers Check
```bash
curl -I http://localhost:8000/api/health
# Should see X-Frame-Options, X-Content-Type-Options, etc.
```

## Common Issues & Solutions

### Issue: `ModuleNotFoundError: No module named 'config'`
**Solution**: Make sure you're in the `backend` directory
```bash
cd backend
python -c "from config import settings; print(settings.MONGO_URL)"
```

### Issue: `pymongo.errors.ServerSelectionTimeoutError`
**Solution**: MongoDB not running
```bash
# Start MongoDB
mongod
# Or check your MONGO_URL in .env
```

### Issue: `ValidationError: MONGO_URL field required`
**Solution**: Environment variables not loaded
```bash
# Make sure .env exists and has MONGO_URL
cat backend/.env | grep MONGO_URL
```

### Issue: Frontend can't connect to backend
**Solution**: Check CORS and backend URL
1. Verify `ALLOWED_ORIGINS` includes your frontend URL
2. Check frontend API baseURL matches backend port
3. Ensure backend is running: `curl http://localhost:8000/api/health`

### Issue: `SlowAPI not found`
**Solution**: Install missing dependencies
```bash
pip install slowapi==0.1.9 pydantic-settings==2.1.0 sentry-sdk==2.0.0
```

## Next Steps

Now that you're running:

1. **Test the app**: Create an issue, browse issues nearby
2. **Review security**: See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)
3. **Configure production**: Update `.env` with production values
4. **Set up monitoring**: Configure Sentry DSN
5. **Deploy**: Follow deployment guide

## Development Tips

### Hot Reload
Both backend and frontend support hot reload:
- Backend: `--reload` flag automatically reloads on file changes
- Frontend: Expo automatically reloads on save

### Debugging
```bash
# Backend logs
# All logs go to console with timestamps

# Frontend logs
# Use React Native Debugger or console in Expo Dev Tools
```

### API Testing
Use the interactive API docs:
- Visit http://localhost:8000/docs
- Try out endpoints directly in browser
- See request/response examples

### Database GUI
Use MongoDB Compass for visual database access:
1. Download: https://www.mongodb.com/products/compass
2. Connect with your `MONGO_URL`
3. Browse collections, indexes, and data

## Quick Commands Reference

```bash
# Backend
cd backend
source venv/bin/activate
python init_db.py              # Initialize DB
uvicorn server:app --reload     # Start dev server
pip install -r requirements.txt # Update dependencies

# Frontend
cd frontend
npm start                       # Start Expo
npm run android                 # Run on Android
npm run ios                     # Run on iOS
npm install                     # Update dependencies

# Database
mongod                          # Start MongoDB
mongo                           # MongoDB shell
```

## Architecture Overview

```
CivicSupportApp/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── config.py          # Settings & environment validation
│   ├── init_db.py         # Database initialization
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── app/              # React Native screens
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── services/     # API client
│   │   └── context/      # Auth context
│   └── package.json      # Node dependencies
└── PRODUCTION_READINESS.md
```

## Help & Support

- **API Documentation**: http://localhost:8000/docs
- **Production Guide**: [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)
- **Issues**: Check logs first, then environment variables

---

**You're all set! 🎉**

Start reporting civic issues and making your community better!
