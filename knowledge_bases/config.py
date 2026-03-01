from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "KBS_"}

    database_url: str = "postgresql+asyncpg://agent:postgres@kb-db:5432/knowledge_bases"
    debug: bool = False

    service_jwt_signing_key: str = "change-me-kb-service-signing-key"
    service_jwt_algorithm: str = "HS256"
    service_jwt_audience: str = "kb-service"
    encryption_key: str = "change-me-generate-with-python-fernet"

    crawl_timeout_seconds: float = 12.0
    crawl_max_pages: int = 200
    crawl_max_depth: int = 4
    crawl_user_agent: str = "PlaybookKBService/1.0"
    use_crawl4ai: bool = True
    crawl4ai_headless: bool = True
    crawl4ai_verbose: bool = False
    crawl4ai_base_directory: str = "/tmp/crawl4ai"
    upload_max_file_bytes: int = 25 * 1024 * 1024
    upload_allowed_extensions: str = (
        ".txt,.md,.markdown,.pdf,.doc,.docx,.ppt,.pptx,.rtf,.odt,.html,.htm,"
        ".csv,.tsv,.xlsx,.xls,.json,.xml,.yaml,.yml"
    )
    upload_ocr_enabled: bool = False
    multimodal_assets_dir: str = "/tmp/kb-assets"
    multimodal_image_max_file_bytes: int = 6 * 1024 * 1024
    multimodal_image_timeout_seconds: float = 12.0
    multimodal_max_images_per_page: int = 6
    multimodal_caption_enabled: bool = True

    worker_poll_seconds: float = 2.0
    worker_enabled: bool = True


settings = Settings()
