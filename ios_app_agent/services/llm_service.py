from typing import Any

import litellm

from ios_app_agent.models.agent_config import AgentConfig
from ios_app_agent.models.function_registry import RegisteredFunction
from ios_app_agent.services.encryption import decrypt


def build_tools(functions: list[RegisteredFunction]) -> list[dict[str, Any]]:
    tools = []
    for fn in functions:
        if not fn.is_active:
            continue
        tool = {
            "type": "function",
            "function": {
                "name": fn.name,
                "description": fn.description_override or fn.description,
                "parameters": fn.parameters_schema or {"type": "object", "properties": {}},
            },
        }
        tools.append(tool)
    return tools


NEXOS_DEFAULT_BASE = "https://api.nexos.ai/v1"


async def call_llm(
    config: AgentConfig,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
) -> Any:
    api_key = None
    if config.llm_api_key_encrypted:
        api_key = decrypt(config.llm_api_key_encrypted)

    provider = config.llm_provider
    model = config.llm_model

    if provider == "nexos":
        if "/" not in model:
            model = f"openai/{model}"
    elif provider and "/" not in model:
        model = f"{provider}/{model}"

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "stream": True,
    }
    if api_key:
        kwargs["api_key"] = api_key

    if provider == "nexos":
        kwargs["api_base"] = config.llm_api_base or NEXOS_DEFAULT_BASE
    elif config.llm_api_base:
        kwargs["api_base"] = config.llm_api_base

    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    return await litellm.acompletion(**kwargs)
