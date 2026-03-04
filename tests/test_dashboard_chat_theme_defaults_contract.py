from pathlib import Path


def test_dashboard_app_creation_seeds_default_chat_theme() -> None:
    text = Path("dashboard/src/app/v1/apps/route.ts").read_text(encoding="utf-8")

    assert "defaultChatTheme" in text
    assert "chatTheme: defaultChatTheme()" in text


def test_dashboard_chat_theme_route_self_heals_invalid_stored_theme() -> None:
    text = Path("dashboard/src/app/v1/apps/[appId]/chat-theme/route.ts").read_text(encoding="utf-8")

    assert "normalizeOrDefaultTheme" in text
    assert "normalizeChatTheme(defaultChatTheme())" in text
    assert "const { normalized, shouldPersist } = normalizeOrDefaultTheme(app.chatTheme);" in text
