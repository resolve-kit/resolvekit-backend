from pathlib import Path


def test_all_compose_variants_use_local_nextjs_sdk_context() -> None:
    local_text = Path("docker-compose.yml").read_text(encoding="utf-8")
    prod_text = Path("docker-compose.prod.yml").read_text(encoding="utf-8")
    local_deploy_text = Path("docker-compose.local-deploy.yml").read_text(encoding="utf-8")

    assert "RESOLVEKIT_NEXTJS_SDK_PATH" in local_text
    assert "resolvekit_nextjs_sdk: ${RESOLVEKIT_NEXTJS_SDK_PATH:?Set RESOLVEKIT_NEXTJS_SDK_PATH}" in prod_text
    assert "resolvekit_nextjs_sdk: ${RESOLVEKIT_NEXTJS_SDK_PATH:?Set RESOLVEKIT_NEXTJS_SDK_PATH}" in local_deploy_text
    assert "RESOLVEKIT_WEB_SDK_PATH" not in local_text
    assert "RESOLVEKIT_WEB_SDK_PATH" not in prod_text
    assert "RESOLVEKIT_WEB_SDK_PATH" not in local_deploy_text

    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in local_text
    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in prod_text
    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in local_deploy_text
    assert "RESOLVEKIT_KEY" in local_text
    assert "RESOLVEKIT_KEY" in prod_text
    assert "RESOLVEKIT_KEY" in local_deploy_text


def test_dashboard_dockerfile_installs_resolvekit_nextjs_from_local_context() -> None:
    text = Path("dashboard/Dockerfile").read_text(encoding="utf-8")

    assert "COPY --from=resolvekit_nextjs_sdk /package.json /resolvekit-nextjs-sdk/package.json" in text
    assert "COPY --from=resolvekit_nextjs_sdk /src /resolvekit-nextjs-sdk/src" in text
    assert "npm --prefix /resolvekit-nextjs-sdk run build" in text
    assert "npm pack /resolvekit-nextjs-sdk --pack-destination /tmp" in text
    assert "--no-save /tmp/resolvekit-nextjs-*.tgz" in text
    assert "require.resolve('@resolvekit/nextjs')" in text
    assert "@resolvekit/sdk" not in text


def test_prod_compose_uses_prod_prefixed_container_names() -> None:
    text = Path("docker-compose.prod.yml").read_text(encoding="utf-8")

    assert "container_name: resolvekit_prod_backend" in text
    assert "container_name: resolvekit_prod_api" in text
    assert "container_name: resolvekit_prod_dashboard" in text
    assert "container_name: resolvekit_prod_website" in text
