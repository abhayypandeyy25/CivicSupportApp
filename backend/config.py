"""
Configuration management for CivicSense Backend
Validates environment variables and provides typed settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application settings with validation"""

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str  # Anon/public key for client access

    # Firebase Configuration
    FIREBASE_PROJECT_ID: str = "civicsense-451d1"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    # Security Configuration
    ALLOWED_ORIGINS: str = "http://localhost:8081,http://localhost:19006"
    JWT_SECRET: Optional[str] = None

    # External Services
    ANTHROPIC_API_KEY: Optional[str] = None
    SENTRY_DSN: Optional[str] = None

    # AWS/S3 Configuration (for future image storage migration)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET: Optional[str] = None
    AWS_REGION: str = "us-east-1"

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

    # Twitter Integration Configuration
    TWITTER_BEARER_TOKEN: Optional[str] = None
    TWITTER_CIVICSENSE_USERNAME: str = "CivicSupportIN"  # Twitter handle to monitor (without @)
    TWITTER_POLL_INTERVAL_MINUTES: int = 2  # How often to fetch new mentions
    TWITTER_ENABLED: bool = False  # Enable/disable Twitter integration

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
        if self.is_production:
            missing = []

            if not self.JWT_SECRET:
                missing.append("JWT_SECRET")
            if not self.SENTRY_DSN:
                missing.append("SENTRY_DSN")
            if self.ALLOWED_ORIGINS == "http://localhost:8081,http://localhost:19006":
                missing.append("ALLOWED_ORIGINS (still using localhost)")

            if missing:
                raise ValueError(
                    f"Production environment requires these settings: {', '.join(missing)}"
                )


# Global settings instance
settings = Settings()

# Validate production settings on import
if settings.is_production:
    settings.validate_required_for_production()
