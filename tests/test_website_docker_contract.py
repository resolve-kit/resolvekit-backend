from pathlib import Path


def test_website_dockerfile_binds_next_start_to_all_interfaces() -> None:
    text = Path("website/Dockerfile").read_text(encoding="utf-8")

    assert "--hostname" in text or "-H" in text
    assert "0.0.0.0" in text
