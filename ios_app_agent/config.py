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

    # WebSocket auth migration
    allow_legacy_ws_api_key: bool = True

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]

    # Server
    debug: bool = False

    # SDK compatibility policy
    minimum_sdk_version: str = "1.0.0"
    supported_sdk_major_versions: list[int] = [1]

    # Knowledge base microservice
    kb_service_base_url: str = "http://kb-service:8100"
    kb_service_audience: str = "kb-service"
    kb_service_signing_key: str = "change-me-kb-service-signing-key"
    kb_service_jwt_algorithm: str = "HS256"
    kb_service_timeout_seconds: float = 20.0
    kb_service_connect_timeout_seconds: float = 5.0


settings = Settings()
