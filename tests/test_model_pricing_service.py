from agent.services.model_pricing import resolve_model_pricing


def test_resolve_model_pricing_normalizes_gemini_prefixes(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def _fake_get_model_info(model: str, custom_llm_provider: str | None = None):
        captured["model"] = model
        captured["provider"] = custom_llm_provider or ""
        return {
            "input_cost_per_token": 1e-7,
            "output_cost_per_token": 4e-7,
        }

    monkeypatch.setattr("agent.services.model_pricing.litellm.get_model_info", _fake_get_model_info)

    provider, model, pricing = resolve_model_pricing("gemini", "gemini/gemini-2.5-flash-lite")

    assert provider == "gemini"
    assert model == "gemini-2.5-flash-lite"
    assert captured == {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
    }
    assert pricing == {
        "input_per_million_usd": 0.1,
        "output_per_million_usd": 0.4,
        "image_per_thousand_usd": None,
        "source": "litellm",
    }


def test_resolve_model_pricing_returns_none_for_openrouter() -> None:
    provider, model, pricing = resolve_model_pricing("openrouter", "google/gemini-2.5-flash-lite")

    assert provider == "openrouter"
    assert model == "google/gemini-2.5-flash-lite"
    assert pricing is None
