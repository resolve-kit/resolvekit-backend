from cryptography.fernet import Fernet

from agent.config import settings


def encrypt(plain: str) -> str:
    f = Fernet(settings.encryption_key.encode())
    return f.encrypt(plain.encode()).decode()


def decrypt(encrypted: str) -> str:
    f = Fernet(settings.encryption_key.encode())
    return f.decrypt(encrypted.encode()).decode()
