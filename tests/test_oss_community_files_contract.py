from pathlib import Path


def test_public_community_files_exist() -> None:
    for path in ["CONTRIBUTING.md", "SECURITY.md", "CODE_OF_CONDUCT.md"]:
        assert Path(path).is_file(), f"{path} should exist for public OSS release"


def test_ci_workflow_covers_oss_contracts_and_dashboard_build() -> None:
    workflow = Path(".github/workflows/ci.yml").read_text(encoding="utf-8")

    assert "tests/test_oss_license_contract.py" in workflow
    assert "tests/test_oss_artifact_hygiene_contract.py" in workflow
    assert "tests/test_oss_community_files_contract.py" in workflow
    assert "docker compose -f docker-compose.yml config -q" in workflow
    assert "npm test" in workflow
    assert "npm run build" in workflow


def test_ci_workflow_uses_node24_compatible_actions() -> None:
    workflow = Path(".github/workflows/ci.yml").read_text(encoding="utf-8")

    assert 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"' in workflow
    assert "actions/checkout@v5" in workflow
    assert "actions/setup-node@v5" in workflow
    assert "actions/setup-python@v6" in workflow
