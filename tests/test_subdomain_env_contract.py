from pathlib import Path


def test_compose_has_website_service() -> None:
    text = Path("docker-compose.yml").read_text(encoding="utf-8")
    assert "website:" in text
    assert "api:" in text


def test_env_example_declares_dashboard_api_base() -> None:
    text = Path(".env.example").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_API_BASE_URL=" in text
