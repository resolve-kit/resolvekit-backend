from pathlib import Path


def test_website_app_scaffold_exists() -> None:
    assert Path("website/package.json").exists()
    assert Path("website/src/app/page.tsx").exists()
    assert Path("website/src/app/pricing/page.tsx").exists()
