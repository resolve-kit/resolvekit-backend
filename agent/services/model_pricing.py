from typing import Any

import litellm


def _normalize_provider(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized == "google":
        return "gemini"
    return normalized


def _normalize_model(provider: str, model: str) -> str:
    normalized_provider = _normalize_provider(provider)
    normalized_model = model.strip()
    if not normalized_model:
        return normalized_model

    if normalized_provider == "openrouter":
        return normalized_model

    if "/" not in normalized_model:
        return normalized_model

    prefix, remainder = normalized_model.split("/", 1)
    normalized_prefix = prefix.strip().lower()
    equivalent_prefixes = {normalized_provider}
    if normalized_provider == "gemini":
        equivalent_prefixes.add("google")

    if normalized_prefix in equivalent_prefixes:
        return remainder.strip()
    return normalized_model


def _numeric_value(payload: Any, key: str) -> float | None:
    raw: Any
    if isinstance(payload, dict):
        raw = payload.get(key)
    else:
        raw = getattr(payload, key, None)
    if isinstance(raw, (int, float)):
        return float(raw)
    return None


def _scaled_rate(value: float | None, multiplier: int) -> float | None:
    if value is None:
        return None
    return round(value * multiplier, 12)


def resolve_model_pricing(provider: str, model: str) -> tuple[str, str, dict[str, float | str | None] | None]:
    normalized_provider = _normalize_provider(provider)
    normalized_model = _normalize_model(normalized_provider, model)

    if not normalized_provider or not normalized_model or normalized_provider == "openrouter":
        return normalized_provider, normalized_model, None

    try:
        model_info = litellm.get_model_info(
            normalized_model,
            custom_llm_provider=normalized_provider,
        )
    except Exception:
        return normalized_provider, normalized_model, None

    input_per_token = _numeric_value(model_info, "input_cost_per_token")
    output_per_token = _numeric_value(model_info, "output_cost_per_token")
    input_per_image = _numeric_value(model_info, "input_cost_per_image")

    if input_per_token is None and output_per_token is None and input_per_image is None:
        return normalized_provider, normalized_model, None

    pricing = {
        "input_per_million_usd": _scaled_rate(input_per_token, 1_000_000),
        "output_per_million_usd": _scaled_rate(output_per_token, 1_000_000),
        "image_per_thousand_usd": _scaled_rate(input_per_image, 1_000),
        "source": "litellm",
    }
    return normalized_provider, normalized_model, pricing
