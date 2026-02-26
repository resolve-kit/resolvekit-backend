import re
from copy import deepcopy
from typing import Any

from fastapi import HTTPException, status

CHAT_THEME_TOKEN_KEYS = [
    "screenBackground",
    "titleText",
    "statusText",
    "composerBackground",
    "composerText",
    "composerPlaceholder",
    "userBubbleBackground",
    "userBubbleText",
    "assistantBubbleBackground",
    "assistantBubbleText",
    "loaderBubbleBackground",
    "loaderDotActive",
    "loaderDotInactive",
    "toolCardBackground",
    "toolCardBorder",
    "toolCardTitle",
    "toolCardBody",
]

_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")

DEFAULT_CHAT_THEME: dict[str, dict[str, str]] = {
    "light": {
        "screenBackground": "#F7F7FA",
        "titleText": "#111827",
        "statusText": "#4B5563",
        "composerBackground": "#FFFFFF",
        "composerText": "#111827",
        "composerPlaceholder": "#9CA3AF",
        "userBubbleBackground": "#DBEAFE",
        "userBubbleText": "#1E3A8A",
        "assistantBubbleBackground": "#E5E7EB",
        "assistantBubbleText": "#111827",
        "loaderBubbleBackground": "#E5E7EB",
        "loaderDotActive": "#374151",
        "loaderDotInactive": "#9CA3AF",
        "toolCardBackground": "#FFFFFFCC",
        "toolCardBorder": "#D1D5DB",
        "toolCardTitle": "#111827",
        "toolCardBody": "#374151",
    },
    "dark": {
        "screenBackground": "#0B0C10",
        "titleText": "#E5E7EB",
        "statusText": "#9CA3AF",
        "composerBackground": "#111318",
        "composerText": "#E5E7EB",
        "composerPlaceholder": "#6B7280",
        "userBubbleBackground": "#1E3A8A99",
        "userBubbleText": "#DBEAFE",
        "assistantBubbleBackground": "#1F2937",
        "assistantBubbleText": "#E5E7EB",
        "loaderBubbleBackground": "#1F2937",
        "loaderDotActive": "#E5E7EB",
        "loaderDotInactive": "#6B7280",
        "toolCardBackground": "#111318CC",
        "toolCardBorder": "#374151",
        "toolCardTitle": "#E5E7EB",
        "toolCardBody": "#9CA3AF",
    },
}


def default_chat_theme() -> dict[str, dict[str, str]]:
    return deepcopy(DEFAULT_CHAT_THEME)


def normalize_chat_theme(raw_theme: Any) -> dict[str, dict[str, str]]:
    if not isinstance(raw_theme, dict):
        raise _invalid_theme("Theme must be an object with light and dark palettes")

    normalized: dict[str, dict[str, str]] = {}
    for mode in ("light", "dark"):
        raw_palette = raw_theme.get(mode)
        if not isinstance(raw_palette, dict):
            raise _invalid_theme(f"Theme must include '{mode}' palette")
        normalized[mode] = _normalize_palette(mode, raw_palette)
    return normalized


def _normalize_palette(mode: str, raw_palette: dict[str, Any]) -> dict[str, str]:
    unknown_keys = sorted(set(raw_palette.keys()) - set(CHAT_THEME_TOKEN_KEYS))
    if unknown_keys:
        raise _invalid_theme(f"Palette '{mode}' has unknown keys: {', '.join(unknown_keys)}")

    missing_keys = [key for key in CHAT_THEME_TOKEN_KEYS if key not in raw_palette]
    if missing_keys:
        raise _invalid_theme(f"Palette '{mode}' is missing keys: {', '.join(missing_keys)}")

    normalized: dict[str, str] = {}
    for key in CHAT_THEME_TOKEN_KEYS:
        value = raw_palette[key]
        if not isinstance(value, str):
            raise _invalid_theme(f"Palette '{mode}' key '{key}' must be a string")
        if not _HEX_COLOR_RE.match(value):
            raise _invalid_theme(
                f"Palette '{mode}' key '{key}' must be #RRGGBB or #RRGGBBAA"
            )
        normalized[key] = value.upper()
    return normalized


def _invalid_theme(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)
