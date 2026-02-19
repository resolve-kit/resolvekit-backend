import json
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
        "stream": False,
    }
    if api_key:
        # Nexos uses "hydra <key>" auth scheme
        kwargs["api_key"] = f"hydra {api_key}" if provider == "nexos" else api_key

    if provider == "nexos":
        kwargs["api_base"] = config.llm_api_base or NEXOS_DEFAULT_BASE
    elif config.llm_api_base:
        kwargs["api_base"] = config.llm_api_base

    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    return await litellm.acompletion(**kwargs)


async def generate_tool_descriptions(
    config: AgentConfig,
    tool_calls: list[dict[str, Any]],
) -> list[str]:
    """Generate short first-person descriptions for a batch of tool calls.

    Each entry in tool_calls should have keys: name, arguments, description (optional).
    Returns a list of sentences the same length as tool_calls, falling back gracefully.
    """
    if not tool_calls:
        return []

    lines = []
    for i, tc in enumerate(tool_calls, 1):
        args_str = json.dumps(tc.get("arguments", {}))
        fn_desc = tc.get("description", "")
        entry = f"{i}. {tc['name']}({args_str})"
        if fn_desc:
            entry += f"  # {fn_desc}"
        lines.append(entry)

    prompt = (
        "For each function call below, write one short plain-English sentence in first person "
        "(starting with 'I will') describing what it will do for the user. "
        "Be specific about key argument values (e.g. city name, room name). "
        "Use no function names, no JSON, no technical jargon.\n\n"
        + "\n".join(lines)
        + "\n\nReply with only the numbered sentences, one per line."
    )

    try:
        response = await call_llm(
            config,
            [{"role": "user", "content": prompt}],
            tools=None,
        )
        text = (response.choices[0].message.content or "").strip()
        descriptions: list[str] = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            # Strip leading "1. " numbering
            if line[0].isdigit() and ". " in line:
                line = line.split(". ", 1)[1]
            descriptions.append(line)

        # Pad to match input count
        while len(descriptions) < len(tool_calls):
            descriptions.append(f"I will run {tool_calls[len(descriptions)]['name']}")

        return descriptions[: len(tool_calls)]
    except Exception:
        return [f"I will run {tc['name']}" for tc in tool_calls]
