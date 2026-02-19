from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "IAA_"}

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ios_app_agent"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    # Encryption key for LLM API keys at rest (Fernet)
    encryption_key: str = "change-me-in-production"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]

    # Server
    debug: bool = False


settings = Settings()
