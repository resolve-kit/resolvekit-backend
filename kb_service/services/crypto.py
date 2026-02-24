from cryptography.fernet import Fernet

from kb_service.config import settings

_fernet = Fernet(settings.encryption_key.encode())


def encrypt_secret(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    return _fernet.decrypt(value.encode()).decode()
