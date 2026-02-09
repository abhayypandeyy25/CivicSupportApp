# Deployment Guide - CivicSense

Complete guide for deploying CivicSense to production with testing strategies.

---

## Table of Contents
1. [Local Development & Testing](#local-development--testing)
2. [Production Deployment Options](#production-deployment-options)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployment (AWS/GCP/Azure)](#cloud-deployment)
5. [Testing Strategy](#testing-strategy)
6. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Local Development & Testing

### Quick Start

```bash
# Run automated setup
cd /Users/abhaypandey/Desktop/CivicSupportApp
./setup.sh

# Start backend
cd backend
source venv/bin/activate
uvicorn server:app --reload

# Start frontend (new terminal)
cd frontend
npm install
npm start
```

### Manual Testing Checklist

#### Backend Tests

```bash
# 1. Health check
curl http://localhost:8000/health

# 2. API documentation
open http://localhost:8000/docs

# 3. Test geospatial query
curl "http://localhost:8000/api/issues?latitude=28.6139&longitude=77.2090&radius_km=5"

# 4. Test categories endpoint
curl http://localhost:8000/api/categories

# 5. Test officials endpoint
curl http://localhost:8000/api/officials
```

#### Database Tests

```bash
# Connect to MongoDB
mongosh civicsense

# Check indexes
db.issues.getIndexes()

# Verify geospatial index exists
db.issues.getIndexes().find(i => i.name === 'location_2dsphere_idx')

# Check collections
show collections

# Count documents
db.issues.count()
db.users.count()
db.govt_officials.count()
```

#### Frontend Tests

```bash
# Start Expo dev server
cd frontend
npm start

# Test on:
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator
# - Scan QR code for physical device
```

**Test these flows**:
1. ✅ User registration (phone/email/Google)
2. ✅ Create issue with photo and location
3. ✅ Browse nearby issues
4. ✅ Upvote issues
5. ✅ Admin panel access
6. ✅ CSV import with auto-create
7. ✅ View officials by hierarchy

---

## Production Deployment Options

### Option 1: Cloud VPS (DigitalOcean, Linode, AWS EC2)

**Best for**: Small to medium deployments (< 10,000 users)

**Requirements**:
- Ubuntu 22.04 LTS server
- 2GB RAM minimum (4GB recommended)
- 20GB storage
- Public IP address

**Cost**: ~$10-20/month

---

### Option 2: Platform as a Service (Railway, Render, Heroku)

**Best for**: Quick deployment, no DevOps needed

**Pros**:
- Easy deployment
- Auto-scaling
- Built-in SSL
- CI/CD integration

**Cost**: ~$5-30/month

---

### Option 3: Containerized (Docker + Kubernetes)

**Best for**: Large scale (> 10,000 users), multiple regions

**Pros**:
- Highly scalable
- Easy rollbacks
- Multi-region deployment
- Load balancing

**Cost**: Variable ($50-500+/month)

---

## Docker Deployment

### Step 1: Create Docker Configuration

#### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy application
COPY . .

# Expose port
EXPOSE 8081

# Start app
CMD ["npm", "start"]
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: civicsense-mongodb
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: civicsense

  backend:
    build: ./backend
    container_name: civicsense-backend
    restart: always
    ports:
      - "8000:8000"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=civicsense
      - ALLOWED_ORIGINS=http://localhost:8081,https://yourdomain.com
      - ENVIRONMENT=production
    env_file:
      - ./backend/.env
    depends_on:
      - mongodb
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    container_name: civicsense-frontend
    restart: always
    ports:
      - "8081:8081"
    environment:
      - EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
    depends_on:
      - backend

volumes:
  mongodb_data:
```

### Step 2: Deploy with Docker

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Initialize database
docker-compose exec backend python init_db.py

# Stop services
docker-compose down

# Restart a specific service
docker-compose restart backend
```

---

## Cloud Deployment

### AWS Deployment (Using EC2)

#### Step 1: Launch EC2 Instance

```bash
# Instance specs:
- AMI: Ubuntu 22.04 LTS
- Instance Type: t3.medium (2 vCPU, 4GB RAM)
- Storage: 30GB SSD
- Security Group: Open ports 22, 80, 443, 8000
```

#### Step 2: SSH into Server

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

#### Step 3: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose -y

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Step 4: Clone and Deploy

```bash
# Clone repository
git clone https://github.com/yourusername/CivicSupportApp.git
cd CivicSupportApp

# Copy environment file
cd backend
cp .env.example .env
nano .env  # Edit with production values

# Start with Docker
cd ..
docker-compose up -d

# Initialize database
docker-compose exec backend python init_db.py
```

#### Step 5: Setup Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install nginx -y

# Create config
sudo nano /etc/nginx/sites-available/civicsense
```

```nginx
# /etc/nginx/sites-available/civicsense
server {
    listen 80;
    server_name yourdomain.com;

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8000/health;
    }

    # API docs
    location /docs {
        proxy_pass http://localhost:8000/docs;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/civicsense /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: Setup SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is automatic with certbot
```

---

### Railway/Render Deployment (Easiest)

#### Railway Deployment

1. **Sign up**: https://railway.app
2. **New Project** → **Deploy from GitHub**
3. **Add MongoDB**: Click "New" → Database → MongoDB
4. **Configure Environment Variables**:
   ```
   MONGO_URL=${MONGO_URL}  # Auto-provided by Railway
   DB_NAME=civicsense
   ALLOWED_ORIGINS=https://your-frontend-url.railway.app
   EMERGENT_LLM_KEY=your_key
   JWT_SECRET=your_secret
   ENVIRONMENT=production
   ```
5. **Deploy**: Automatic on git push

#### Render Deployment

1. **Sign up**: https://render.com
2. **New Web Service** → Connect GitHub repo
3. **Settings**:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. **Add MongoDB**: Render → New → MongoDB
5. **Environment Variables**: Same as Railway
6. **Deploy**: Automatic

---

## Testing Strategy

### 1. Unit Tests

Create test file:

```python
# backend/tests/test_api.py
import pytest
from httpx import AsyncClient
from server import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_get_categories():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data

@pytest.mark.asyncio
async def test_get_issues_with_location():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/api/issues",
            params={
                "latitude": 28.6139,
                "longitude": 77.2090,
                "radius_km": 5
            }
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
```

Run tests:
```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest tests/
```

### 2. Integration Tests

```python
# backend/tests/test_integration.py
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
import os

@pytest.mark.asyncio
async def test_mongodb_connection():
    """Test MongoDB connection"""
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME")]

    # Test ping
    result = await client.admin.command('ping')
    assert result['ok'] == 1.0

    client.close()

@pytest.mark.asyncio
async def test_geospatial_index_exists():
    """Test that geospatial index is created"""
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME")]

    indexes = await db.issues.index_information()
    assert 'location_2dsphere_idx' in indexes

    client.close()

@pytest.mark.asyncio
async def test_csv_import_auto_create():
    """Test CSV import with auto-create"""
    # Test that new hierarchy levels are created
    # Test that new categories are created
    pass
```

### 3. Load Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test endpoint performance
ab -n 1000 -c 10 http://localhost:8000/health

# Test geospatial queries
ab -n 100 -c 5 "http://localhost:8000/api/issues?latitude=28.6139&longitude=77.2090&radius_km=5"
```

Expected results:
- Health check: > 1000 req/sec
- Geospatial query: > 100 req/sec (with index)

### 4. End-to-End Tests

```bash
# Install Playwright for E2E
cd frontend
npm install -D @playwright/test

# Create test file
# frontend/e2e/app.test.ts
```

```typescript
import { test, expect } from '@playwright/test';

test('user can create issue', async ({ page }) => {
  await page.goto('http://localhost:8081');

  // Login
  await page.click('text=Login');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.click('text=Continue');

  // Create issue
  await page.click('text=Report Issue');
  await page.fill('input[placeholder="Title"]', 'Test Issue');
  await page.fill('textarea[placeholder="Description"]', 'Test description');
  await page.click('text=Submit');

  // Verify success
  await expect(page.locator('text=Issue created')).toBeVisible();
});
```

---

## Monitoring & Maintenance

### 1. Setup Monitoring

#### Sentry (Error Tracking)

```bash
# Already integrated in code!
# Just set in .env:
SENTRY_DSN=your_sentry_dsn
```

Get DSN from: https://sentry.io

#### MongoDB Monitoring

```bash
# Install MongoDB Compass (GUI)
# Download from: https://www.mongodb.com/products/compass

# Or use mongosh
mongosh civicsense

# Check database stats
db.stats()

# Check slow queries
db.system.profile.find().sort({ts:-1}).limit(5)
```

#### Server Monitoring

```bash
# Install htop
sudo apt install htop

# Monitor resources
htop

# Check disk space
df -h

# Check logs
docker-compose logs -f backend
```

### 2. Backup Strategy

```bash
# MongoDB backup script
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"

mkdir -p $BACKUP_DIR

# Backup
mongodump --db civicsense --out $BACKUP_DIR/backup_$DATE

# Compress
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/backup_$DATE
rm -rf $BACKUP_DIR/backup_$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

```bash
# Make executable
chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### 3. Log Management

```bash
# Rotate logs
sudo nano /etc/logrotate.d/civicsense
```

```
/var/log/civicsense/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

### 4. Security Checklist

- [ ] Firewall configured (UFW)
- [ ] SSL certificate installed
- [ ] MongoDB authentication enabled
- [ ] Environment variables secured
- [ ] API rate limiting active
- [ ] Security headers configured
- [ ] Regular security updates
- [ ] Backups automated
- [ ] Monitoring alerts setup

---

## Performance Optimization

### 1. Database Optimization

```javascript
// Ensure indexes exist
db.issues.createIndex({"location.coordinates": "2dsphere"})
db.issues.createIndex({"category": 1, "status": 1})
db.issues.createIndex({"created_at": -1})
db.users.createIndex({"firebase_uid": 1}, {unique: true})
db.govt_officials.createIndex({"hierarchy_level": 1, "is_active": 1})

// Enable profiling
db.setProfilingLevel(1, { slowms: 100 })

// Check slow queries
db.system.profile.find({millis: {$gt: 100}}).sort({ts: -1})
```

### 2. Backend Optimization

```python
# Use connection pooling
# Already configured in Motor driver

# Enable caching (add to server.py)
from functools import lru_cache

@lru_cache(maxsize=128)
async def get_categories():
    # Cache categories for 1 hour
    pass
```

### 3. Frontend Optimization

```bash
# Build optimized production version
cd frontend
expo build:web

# Or for native
expo build:android
expo build:ios
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database initialized with indexes
- [ ] SSL certificate obtained
- [ ] Firewall rules configured
- [ ] Monitoring setup
- [ ] Backup strategy in place

### Deployment

- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Run database migrations
- [ ] Test all endpoints
- [ ] Check error tracking
- [ ] Verify SSL works
- [ ] Test mobile app connection

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify backups running
- [ ] Test critical user flows
- [ ] Monitor server resources
- [ ] Set up alerts

---

## Quick Deploy Commands

### Development
```bash
./setup.sh
cd backend && source venv/bin/activate && uvicorn server:app --reload
```

### Production (Docker)
```bash
docker-compose up -d
docker-compose exec backend python init_db.py
```

### Production (Manual)
```bash
cd backend
gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## Support & Resources

- **Documentation**: See all .md files in project root
- **API Docs**: http://your-domain.com/docs
- **Issues**: https://github.com/yourusername/CivicSupportApp/issues
- **Monitoring**: Sentry dashboard
- **Database**: MongoDB Compass

---

**Ready to deploy?** Start with Docker deployment for easiest experience! 🚀
