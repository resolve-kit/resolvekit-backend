import json
import logging
from dataclasses import dataclass
from typing import Any

import litellm
from openai import AsyncOpenAI

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
logger = logging.getLogger(__name__)


def _normalize_api_key(raw_key: str) -> str:
    key = raw_key.strip()
    lower = key.lower()
    if lower.startswith("bearer "):
        return key[7:].strip()
    if lower.startswith("hydra "):
        return key[6:].strip()
    return key


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if hasattr(item, "model_dump"):
                item = item.model_dump()
            if isinstance(item, dict):
                if item.get("type") == "text" and isinstance(item.get("text"), str):
                    parts.append(item["text"])
                elif item.get("type") == "output_text" and isinstance(item.get("text"), str):
                    parts.append(item["text"])
                elif isinstance(item.get("content"), str):
                    parts.append(item["content"])
        return "\n".join(parts)
    return ""


@dataclass
class _LLMFunction:
    name: str
    arguments: str


@dataclass
class _LLMToolCall:
    id: str
    function: _LLMFunction


@dataclass
class _LLMMessage:
    content: str
    tool_calls: list[_LLMToolCall] | None = None


@dataclass
class _LLMChoice:
    message: _LLMMessage


@dataclass
class _LLMUsage:
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


@dataclass
class _LLMResponse:
    choices: list[_LLMChoice]
    usage: _LLMUsage | None = None


async def _call_nexos_chat_completions(
    config: AgentConfig,
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None,
    api_key: str,
) -> _LLMResponse:
    api_base = (config.llm_api_base or NEXOS_DEFAULT_BASE).rstrip("/")
    client = AsyncOpenAI(
        api_key=_normalize_api_key(api_key),
        base_url=api_base,
    )

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    try:
        response = await client.chat.completions.create(**kwargs)
    except Exception as exc:
        logger.warning("nexos_openai_sdk_failed base_url=%s model=%s error=%s", api_base, model, str(exc))
        raise

    choices: list[_LLMChoice] = []
    for choice in (response.choices or []):
        msg = choice.message
        tool_calls: list[_LLMToolCall] = []
        for tc in (msg.tool_calls or []):
            tool_calls.append(
                _LLMToolCall(
                    id=tc.id or "",
                    function=_LLMFunction(
                        name=tc.function.name or "",
                        arguments=tc.function.arguments or "",
                    ),
                )
            )
        choices.append(
            _LLMChoice(
                message=_LLMMessage(
                    content=_content_to_text(msg.content),
                    tool_calls=tool_calls or None,
                )
            )
        )

    usage = _LLMUsage(
        prompt_tokens=response.usage.prompt_tokens if response.usage else None,
        completion_tokens=response.usage.completion_tokens if response.usage else None,
    )
    return _LLMResponse(choices=choices, usage=usage)


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

    if provider and provider != "nexos" and "/" not in model:
        model = f"{provider}/{model}"

    if provider == "nexos":
        if not api_key:
            raise ValueError("Nexos provider requires an API key")
        return await _call_nexos_chat_completions(config, model, messages, tools, api_key)

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "stream": False,
    }
    if api_key:
        kwargs["api_key"] = _normalize_api_key(api_key)

    if config.llm_api_base:
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
