from pathlib import Path


def test_main_entrypoint_uses_agent() -> None:
    text = Path("main.py").read_text(encoding="utf-8")
    assert '"agent.main:app"' in text
    assert "ios_app_agent.main:app" not in text


def test_backend_dockerfile_uses_agent() -> None:
    text = Path("Dockerfile").read_text(encoding="utf-8")
    assert "agent.main:app" in text
    assert "ios_app_agent.main:app" not in text
    assert "COPY agent/ ./agent/" in text


def test_kb_dockerfile_uses_knowledge_bases() -> None:
    text = Path("knowledge_bases/Dockerfile").read_text(encoding="utf-8")
    assert "knowledge_bases.main:app" in text
    assert "kb_service.main:app" not in text
