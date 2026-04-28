import json
import tomllib
from pathlib import Path


def test_root_license_is_agpl_3_only() -> None:
    text = Path("LICENSE").read_text(encoding="utf-8")

    assert "GNU AFFERO GENERAL PUBLIC LICENSE" in text
    assert "Version 3, 19 November 2007" in text


def test_python_project_declares_agpl_3_only() -> None:
    project = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))["project"]

    assert project["name"] == "resolvekit-backend"
    assert project["license"] == "AGPL-3.0-only"
    assert project["license-files"] == ["LICENSE"]

    urls = project["urls"]
    assert urls["Homepage"] == "https://github.com/resolve-kit/resolvekit-backend"
    assert urls["Repository"] == "https://github.com/resolve-kit/resolvekit-backend"
    assert urls["Issues"] == "https://github.com/resolve-kit/resolvekit-backend/issues"


def test_dashboard_package_declares_agpl_3_only() -> None:
    package = json.loads(Path("dashboard/package.json").read_text(encoding="utf-8"))

    assert package["license"] == "AGPL-3.0-only"
