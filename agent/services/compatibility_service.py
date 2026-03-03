from __future__ import annotations

from typing import Any

from packaging.version import InvalidVersion, Version

from agent.models.function_registry import RegisteredFunction
from agent.models.session import ChatSession


def _parse_version(value: Any) -> Version | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return Version(value.strip())
    except InvalidVersion:
        return None


def _version_in_range(actual_raw: Any, min_raw: Any, max_raw: Any) -> bool:
    if min_raw is None and max_raw is None:
        return True

    actual = _parse_version(actual_raw)
    if actual is None:
        return False

    min_version = _parse_version(min_raw)
    max_version = _parse_version(max_raw)
    if min_version and actual < min_version:
        return False
    if max_version and actual > max_version:
        return False
    return True


def function_is_eligible(fn: RegisteredFunction, session: ChatSession) -> bool:
    if not fn.is_active:
        return False

    availability = fn.availability or {}
    client = session.client_context or {}

    platform = client.get("platform")
    allowed_platforms = availability.get("platforms")
    if isinstance(allowed_platforms, list) and allowed_platforms:
        if not isinstance(platform, str) or platform not in allowed_platforms:
            return False

    os_version = client.get("os_version")
    if not _version_in_range(
        os_version,
        availability.get("min_os_version"),
        availability.get("max_os_version"),
    ):
        return False

    app_version = client.get("app_version")
    if not _version_in_range(
        app_version,
        availability.get("min_app_version"),
        availability.get("max_app_version"),
    ):
        return False

    session_entitlements = set(session.entitlements or [])
    required_entitlements = set(fn.required_entitlements or [])
    if not required_entitlements.issubset(session_entitlements):
        return False

    session_capabilities = set(session.capabilities or [])
    required_capabilities = set(fn.required_capabilities or [])
    if not required_capabilities.issubset(session_capabilities):
        return False

    return True
