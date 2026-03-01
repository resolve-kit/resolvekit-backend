from __future__ import annotations

from typing import Any

import litellm


def is_unsupported_temperature_error(exc: Exception) -> bool:
    message = str(exc).lower()
    if "temperature" not in message:
        return False

    class_name = exc.__class__.__name__.lower()
    if class_name == "unsupportedparamserror":
        return True

    unsupported_markers = (
        "unsupported",
        "doesn't support",
        "does not support",
        "not support",
    )
    return any(marker in message for marker in unsupported_markers)


async def acompletion_with_temperature_fallback(**kwargs: Any) -> Any:
    try:
        return await litellm.acompletion(**kwargs)
    except Exception as exc:
        if "temperature" not in kwargs or not is_unsupported_temperature_error(exc):
            raise

    retry_kwargs = dict(kwargs)
    retry_kwargs.pop("temperature", None)
    return await litellm.acompletion(**retry_kwargs)
