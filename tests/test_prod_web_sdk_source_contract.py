from pathlib import Path


def test_all_compose_variants_drop_local_nextjs_sdk_checkout_requirements() -> None:
    local_text = Path("docker-compose.yml").read_text(encoding="utf-8")
    prod_text = Path("docker-compose.prod.yml").read_text(encoding="utf-8")
    local_deploy_text = Path("docker-compose.local-deploy.yml").read_text(encoding="utf-8")

    assert "RESOLVEKIT_NEXTJS_SDK_PATH" not in local_text
    assert "RESOLVEKIT_NEXTJS_SDK_PATH" not in prod_text
    assert "RESOLVEKIT_NEXTJS_SDK_PATH" not in local_deploy_text
    assert "RESOLVEKIT_WEB_SDK_PATH" not in local_text
    assert "RESOLVEKIT_WEB_SDK_PATH" not in prod_text
    assert "RESOLVEKIT_WEB_SDK_PATH" not in local_deploy_text

    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in local_text
    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in prod_text
    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in local_deploy_text
    assert "RESOLVEKIT_KEY" not in local_text
    assert "RESOLVEKIT_KEY" not in prod_text
    assert "RESOLVEKIT_KEY" not in local_deploy_text


def test_dashboard_dockerfile_uses_only_public_dashboard_dependencies() -> None:
    text = Path("dashboard/Dockerfile").read_text(encoding="utf-8")

    assert "resolvekit-nextjs-sdk" not in text
    assert "@resolvekit/nextjs" not in text
    assert "@resolvekit/sdk" not in text


def test_prod_compose_uses_prod_prefixed_container_names() -> None:
    text = Path("docker-compose.prod.yml").read_text(encoding="utf-8")

    assert "container_name: resolvekit_prod_backend" in text
    assert "container_name: resolvekit_prod_api" in text
    assert "container_name: resolvekit_prod_dashboard" in text
    assert "container_name: resolvekit_prod_website" not in text
