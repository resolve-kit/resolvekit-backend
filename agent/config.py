from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "IAA_"}

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agent"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    # Encryption key for LLM API keys at rest (Fernet)
    encryption_key: str = "change-me-in-production"

    # WebSocket auth migration
    allow_legacy_ws_api_key: bool = True

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
    ]

    # Server
    debug: bool = False

    # SDK compatibility policy
    minimum_sdk_version: str = "1.0.0"
    supported_sdk_major_versions: list[int] = [1]
    chat_capability_secret: str | None = None
    chat_capability_ttl_seconds: int = 300

    # Knowledge base microservice
    knowledge_bases_base_url: str = "http://kb-service:8100"
    knowledge_bases_audience: str = "kb-service"
    knowledge_bases_signing_key: str = "change-me-kb-service-signing-key"
    knowledge_bases_jwt_algorithm: str = "HS256"
    knowledge_bases_timeout_seconds: float = 20.0
    knowledge_bases_connect_timeout_seconds: float = 5.0


settings = Settings()
