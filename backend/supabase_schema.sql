-- CivicSense Supabase Schema
-- Run this in the Supabase SQL Editor to create the necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== USERS TABLE ==================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    display_name VARCHAR(100),
    photo_url VARCHAR(2048),
    location_latitude DOUBLE PRECISION,
    location_longitude DOUBLE PRECISION,
    location_address VARCHAR(500),
    location_area VARCHAR(200),
    location_city VARCHAR(100) DEFAULT 'Delhi',
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ================== GOVT OFFICIALS TABLE ==================
CREATE TABLE IF NOT EXISTS govt_officials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(200) NOT NULL,
    area VARCHAR(200),
    city VARCHAR(100) DEFAULT 'Delhi',
    state VARCHAR(100) DEFAULT 'Delhi',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    photo_url VARCHAR(2048),
    categories TEXT[] DEFAULT '{}',
    hierarchy_level INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officials_hierarchy ON govt_officials(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_officials_designation ON govt_officials(designation);
CREATE INDEX IF NOT EXISTS idx_officials_is_active ON govt_officials(is_active);

-- ================== ISSUES TABLE ==================
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(100),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    photos TEXT[] DEFAULT '{}',
    location_latitude DOUBLE PRECISION NOT NULL,
    location_longitude DOUBLE PRECISION NOT NULL,
    location_address VARCHAR(500),
    location_area VARCHAR(200),
    location_city VARCHAR(100) DEFAULT 'Delhi',
    status VARCHAR(50) DEFAULT 'pending',
    ai_suggested_category VARCHAR(100),
    ai_suggested_officials TEXT[] DEFAULT '{}',
    assigned_official_id UUID REFERENCES govt_officials(id),
    assigned_official_name VARCHAR(200),
    upvotes INTEGER DEFAULT 0,
    upvoted_by TEXT[] DEFAULT '{}',
    source VARCHAR(20) DEFAULT 'app',
    location_status VARCHAR(20) DEFAULT 'resolved',
    -- Twitter-specific fields (populated when source='twitter')
    twitter_tweet_id VARCHAR(50),
    twitter_user_id VARCHAR(50),
    twitter_username VARCHAR(100),
    twitter_display_name VARCHAR(200),
    twitter_profile_image VARCHAR(2048),
    twitter_tweet_text TEXT,
    twitter_tweet_url VARCHAR(500),
    twitter_tweet_created_at TIMESTAMP WITH TIME ZONE,
    twitter_has_media BOOLEAN DEFAULT FALSE,
    twitter_media_urls TEXT[] DEFAULT '{}',
    twitter_hashtags TEXT[] DEFAULT '{}',
    twitter_retweet_count INTEGER DEFAULT 0,
    twitter_like_count INTEGER DEFAULT 0,
    twitter_reply_count INTEGER DEFAULT 0,
    twitter_fetched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_source ON issues(source);
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_location ON issues(location_latitude, location_longitude);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_twitter_tweet_id ON issues(twitter_tweet_id) WHERE twitter_tweet_id IS NOT NULL;

-- ================== TWITTER SYNC STATE TABLE ==================
CREATE TABLE IF NOT EXISTS twitter_sync_state (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'twitter_sync',
    last_mention_id VARCHAR(50),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    total_tweets_processed INTEGER DEFAULT 0,
    total_issues_created INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial sync state row
INSERT INTO twitter_sync_state (id) VALUES ('twitter_sync') ON CONFLICT (id) DO NOTHING;

-- ================== CATEGORIES TABLE ==================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT '📋',
    auto_created BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, display_name, icon) VALUES
    ('roads', 'Roads & Traffic', '🛣️'),
    ('sanitation', 'Sanitation & Garbage', '🗑️'),
    ('water', 'Water Supply', '💧'),
    ('electricity', 'Electricity', '⚡'),
    ('encroachment', 'Encroachment', '🏗️'),
    ('parks', 'Parks & Playgrounds', '🌳'),
    ('public_safety', 'Public Safety', '🛡️'),
    ('health', 'Health & Hospitals', '🏥'),
    ('education', 'Education', '🏫'),
    ('transport', 'Public Transport', '🚌'),
    ('housing', 'Housing', '🏠'),
    ('general', 'General', 'ℹ️')
ON CONFLICT (name) DO NOTHING;

-- ================== ROW LEVEL SECURITY (RLS) ==================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE govt_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (for demo/dev mode)
-- Note: In production, you'd want more restrictive policies

-- Users: Allow read for authenticated, allow insert/update for own records
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own record" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own record" ON users FOR UPDATE USING (true);

-- Officials: Public read access
CREATE POLICY "Officials are viewable by everyone" ON govt_officials FOR SELECT USING (true);
CREATE POLICY "Officials can be managed by service role" ON govt_officials FOR ALL USING (true);

-- Issues: Public read, authenticated write
CREATE POLICY "Issues are viewable by everyone" ON issues FOR SELECT USING (true);
CREATE POLICY "Issues can be created by anyone" ON issues FOR INSERT WITH CHECK (true);
CREATE POLICY "Issues can be updated by anyone" ON issues FOR UPDATE USING (true);

-- Twitter sync state: Service role only
CREATE POLICY "Twitter sync state is accessible" ON twitter_sync_state FOR ALL USING (true);

-- Categories: Public read
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (true);
CREATE POLICY "Categories can be managed" ON categories FOR ALL USING (true);

-- ================== FUNCTIONS ==================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_issues_updated_at ON issues;
CREATE TRIGGER update_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_twitter_sync_state_updated_at ON twitter_sync_state;
CREATE TRIGGER update_twitter_sync_state_updated_at
    BEFORE UPDATE ON twitter_sync_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================== HELPER FUNCTION FOR DISTANCE ==================
-- Calculate distance between two points using Haversine formula
CREATE OR REPLACE FUNCTION haversine_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    R DOUBLE PRECISION := 6371; -- Earth's radius in kilometers
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);
    a := SIN(dlat/2) * SIN(dlat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlon/2) * SIN(dlon/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
