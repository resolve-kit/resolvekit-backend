import socket

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
    allow_legacy_ws_api_key: bool = False

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
    ]

    # Server
    debug: bool = False

    # Session TTL
    session_ttl_minutes: int = 30

    # Realtime continuity (Redis-backed)
    redis_url: str = ""
    instance_id: str = socket.gethostname()
    ws_owner_ttl_seconds: int = 120
    ws_outbox_ttl_seconds: int = 300
    ws_tool_result_ttl_seconds: int = 300

    # SDK compatibility policy
    minimum_sdk_version: str = "1.0.0"
    supported_sdk_major_versions: list[int] = [1]
    chat_capability_secret: str | None = None
    chat_capability_ttl_seconds: int = 300
    sdk_client_token_secret: str | None = None
    sdk_client_token_ttl_seconds: int = 900
    sdk_client_token_rate_limit_per_minute: int = 60

    # Knowledge base microservice
    knowledge_bases_base_url: str = "http://kb-service:8100"
    knowledge_bases_audience: str = "kb-service"
    knowledge_bases_signing_key: str = "change-me-kb-service-signing-key"
    knowledge_bases_jwt_algorithm: str = "HS256"
    knowledge_bases_timeout_seconds: float = 20.0
    knowledge_bases_connect_timeout_seconds: float = 5.0


settings = Settings()
