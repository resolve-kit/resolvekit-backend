import os
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def _run_python(code: str, env_overrides: dict[str, str]) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


def test_crypto_module_import_does_not_fail_with_invalid_key() -> None:
    result = _run_python(
        "import kb_service.services.crypto; print('ok')",
        {"KBS_ENCRYPTION_KEY": "invalid"},
    )

    assert result.returncode == 0, result.stderr
    assert "ok" in result.stdout


def test_crypto_usage_with_invalid_key_raises_clear_error() -> None:
    result = _run_python(
        "from kb_service.services.crypto import encrypt_secret; encrypt_secret('abc')",
        {"KBS_ENCRYPTION_KEY": "invalid"},
    )

    assert result.returncode != 0
    assert "KBS_ENCRYPTION_KEY must be a valid Fernet key" in result.stderr
