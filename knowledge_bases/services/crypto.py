from functools import lru_cache

from cryptography.fernet import Fernet

from knowledge_bases.config import settings


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    try:
        return Fernet(settings.encryption_key.encode())
    except Exception as exc:
        raise ValueError("KBS_ENCRYPTION_KEY must be a valid Fernet key (32 url-safe base64-encoded bytes).") from exc


def encrypt_secret(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    return _get_fernet().decrypt(value.encode()).decode()
