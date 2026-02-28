from pathlib import Path


def test_dashboard_client_uses_env_api_base() -> None:
    text = Path("dashboard/src/api/client.ts").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_API_BASE_URL" in text
    assert 'const BASE = ""' not in text
