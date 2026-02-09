"""
Database connection and management for CivicSense
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

from .config import settings


class Database:
    """Database connection manager"""

    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

    def connect(self):
        """Connect to MongoDB"""
        self.client = AsyncIOMotorClient(settings.MONGO_URL)
        self.db = self.client[settings.DB_NAME]
        return self.db

    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()

    def get_db(self) -> AsyncIOMotorDatabase:
        """Get database instance"""
        if self.db is None:
            self.connect()
        return self.db


# Global database instance
database = Database()


def get_database() -> AsyncIOMotorDatabase:
    """Dependency to get database instance"""
    return database.get_db()
