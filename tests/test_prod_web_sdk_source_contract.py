from pathlib import Path


def test_prod_compose_build_uses_local_web_sdk_context() -> None:
    text = Path("docker-compose.prod.yml").read_text(encoding="utf-8")

    assert "additional_contexts:" in text
    assert "resolvekit_web_sdk: ${RESOLVEKIT_WEB_SDK_PATH:-../resolvekit-web-sdk}" in text


def test_dashboard_dockerfile_installs_resolvekit_sdk_from_local_context() -> None:
    text = Path("dashboard/Dockerfile").read_text(encoding="utf-8")

    assert "COPY --from=resolvekit_web_sdk /package.json /resolvekit-web-sdk/package.json" in text
    assert "COPY --from=resolvekit_web_sdk /dist /resolvekit-web-sdk/dist" in text
    assert "--no-save /resolvekit-web-sdk" in text
