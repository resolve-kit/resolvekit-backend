from pathlib import Path


def test_dashboard_client_uses_env_api_base() -> None:
    text = Path("dashboard/src/api/client.ts").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_API_BASE_URL" in text
    assert 'const BASE = ""' not in text


def test_dashboard_app_config_supports_kb_vision_mode() -> None:
    route_text = Path("dashboard/src/app/v1/apps/[appId]/config/route.ts").read_text(encoding="utf-8")
    serializer_text = Path("dashboard/src/lib/server/serializers.ts").read_text(encoding="utf-8")
    service_text = Path("dashboard/src/lib/server/config-service.ts").read_text(encoding="utf-8")

    assert "kb_vision_mode" in route_text
    assert "kb_vision_mode" in serializer_text
    assert "kbVisionMode" in service_text


def test_llm_config_page_has_kb_vision_mode_selector_and_capability_badges() -> None:
    text = Path("dashboard/src/dashboard_pages/LlmConfig.tsx").read_text(encoding="utf-8")

    assert "kb_vision_mode" in text
    assert "Low-risk OCR" in text
    assert "Full multimodal" in text
    assert "OCR Compatible" in text
    assert "Multimodal Vision" in text
