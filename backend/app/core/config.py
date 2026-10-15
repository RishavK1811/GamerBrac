import json
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "GamerBrac Esports Platform"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str = "gamerbrac-dev-secret-key-change-in-production-min-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    ROOM_ENCRYPTION_KEY: str = "gamerbrac-room-encryption-key-must-be-secret-2026"

    # Feature Gates
    PAID_TOURNAMENTS_ENABLED: bool = False

    # Rate Limiting & Proxies
    RATE_LIMIT_ENABLED: bool = True
    TRUSTED_PROXIES: List[str] = ["127.0.0.1", "::1", "localhost", "testclient"]

    @field_validator("TRUSTED_PROXIES", mode="before")
    @classmethod
    def assemble_trusted_proxies(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(i).strip() for i in parsed]
            except Exception:
                pass
        return v if isinstance(v, list) else ["127.0.0.1", "::1", "localhost", "testclient"]

    # Database
    DATABASE_URL: str = "sqlite:///./gamerbrac.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg2://", 1)
            if v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    # Private Evidence Storage
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    EVIDENCE_STORAGE_DIR: str = "storage/evidence"
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB
    S3_ENDPOINT_URL: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_REGION_NAME: Optional[str] = "auto"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(i).strip() for i in parsed]
            except Exception:
                pass
        return v if isinstance(v, list) else []

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            dev_secret = "gamerbrac-dev-secret-key-change-in-production-min-32-chars-long"
            dev_room_key = "gamerbrac-room-encryption-key-must-be-secret-2026"
            if self.SECRET_KEY == dev_secret:
                raise ValueError("In production, SECRET_KEY must be changed from the default development key.")
            if self.ROOM_ENCRYPTION_KEY == dev_room_key:
                raise ValueError("In production, ROOM_ENCRYPTION_KEY must be changed from the default development key.")
            if "*" in self.BACKEND_CORS_ORIGINS:
                raise ValueError("In production, BACKEND_CORS_ORIGINS cannot contain wildcard '*' when credentials are enabled.")
            if self.STORAGE_BACKEND.lower() == "s3":
                if not (self.S3_ENDPOINT_URL and self.S3_BUCKET_NAME and self.S3_ACCESS_KEY_ID and self.S3_SECRET_ACCESS_KEY):
                    raise ValueError("When STORAGE_BACKEND is 's3', S3_ENDPOINT_URL, S3_BUCKET_NAME, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must all be configured.")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
