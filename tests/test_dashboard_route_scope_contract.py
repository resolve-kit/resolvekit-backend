from pathlib import Path


def test_dashboard_has_no_marketing_routes() -> None:
    text = Path("dashboard/src/main.tsx").read_text(encoding="utf-8")
    assert 'path="/pricing"' not in text
    assert 'path="/" element={<Home />}' not in text
