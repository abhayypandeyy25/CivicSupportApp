"""
Configuration management for CivicSense Backend
Validates environment variables and provides typed settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application settings with validation"""

    # Database Configuration
    MONGO_URL: str
    DB_NAME: str

    # Firebase Configuration
    FIREBASE_PROJECT_ID: str = "civicsense-451d1"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    # Security Configuration
    ALLOWED_ORIGINS: str = "http://localhost:8081,http://localhost:19006,http://localhost:5173"
    JWT_SECRET: Optional[str] = None

    # AI/LLM Configuration (Anthropic Claude)
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-haiku-20240307"

    # External Services
    SENTRY_DSN: Optional[str] = None

    # AWS/S3 Configuration (for future image storage migration)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    # Twitter Integration
    TWITTER_ENABLED: bool = False
    TWITTER_BEARER_TOKEN: Optional[str] = None
    TWITTER_API_KEY: Optional[str] = None
    TWITTER_API_SECRET: Optional[str] = None
    TWITTER_ACCESS_TOKEN: Optional[str] = None
    TWITTER_ACCESS_SECRET: Optional[str] = None
    TWITTER_ACCOUNT_ID: Optional[str] = None
    TWITTER_POLL_INTERVAL_SECONDS: int = 60
    CIVICSENSE_DASHBOARD_URL: str = "https://dashboard-mocha-seven-36.vercel.app"

    # Redis Configuration (for future caching)
    REDIS_URL: Optional[str] = None

    # Application Configuration
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"  # development, staging, production

    # Rate Limiting
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_ISSUE_CREATE: str = "10/minute"
    RATE_LIMIT_AUTH: str = "5/minute"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Ignore extra environment variables
    )

    def get_allowed_origins(self) -> List[str]:
        """Parse ALLOWED_ORIGINS string into list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(',') if origin.strip()]

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT.lower() == "development"

    def validate_required_for_production(self):
        """Validate that production-critical settings are configured"""
        import logging
        logger = logging.getLogger(__name__)

        if self.is_production:
            if self.ALLOWED_ORIGINS == "http://localhost:8081,http://localhost:19006":
                raise ValueError("Production requires ALLOWED_ORIGINS to be set (not localhost)")

            # Warn about optional but recommended settings
            if not self.JWT_SECRET:
                logger.warning("JWT_SECRET not set — using default. Set a strong secret for production.")
            if not self.SENTRY_DSN:
                logger.warning("SENTRY_DSN not set — error tracking disabled.")


# Global settings instance
settings = Settings()

# Validate production settings on import
if settings.is_production:
    settings.validate_required_for_production()
