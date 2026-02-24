from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "KBS_"}

    database_url: str = "postgresql+asyncpg://ios_app_agent:postgres@kb-db:5432/kb_service"
    debug: bool = False

    service_jwt_signing_key: str = "change-me-kb-service-signing-key"
    service_jwt_algorithm: str = "HS256"
    service_jwt_audience: str = "kb-service"
    encryption_key: str = "change-me-generate-with-python-fernet"

    crawl_timeout_seconds: float = 12.0
    crawl_max_pages: int = 200
    crawl_max_depth: int = 4
    crawl_user_agent: str = "PlaybookKBService/1.0"

    worker_poll_seconds: float = 2.0
    worker_enabled: bool = True


settings = Settings()
