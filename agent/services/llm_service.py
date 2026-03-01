import json
import logging
from dataclasses import dataclass
from typing import Any
import uuid

from openai import AsyncOpenAI

from agent.models.agent_config import AgentConfig
from agent.models.function_registry import RegisteredFunction
from agent.services.encryption import decrypt
from agent.services.llm_compat import (
    acompletion_with_temperature_fallback,
    is_unsupported_temperature_error,
)
from agent.services.usage_tracking import estimate_tokens_from_messages, record_llm_usage_event


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
        if "temperature" in kwargs and is_unsupported_temperature_error(exc):
            retry_kwargs = dict(kwargs)
            retry_kwargs.pop("temperature", None)
            response = await client.chat.completions.create(**retry_kwargs)
        else:
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
    *,
    operation: str = "assistant_completion",
    session_id: uuid.UUID | None = None,
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
        response = await _call_nexos_chat_completions(config, model, messages, tools, api_key)
        await _record_usage_best_effort(
            config=config,
            session_id=session_id,
            provider=provider or "nexos",
            model=model,
            operation=operation,
            messages=messages,
            response=response,
        )
        return response

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
    elif provider == "openrouter":
        kwargs["api_base"] = "https://openrouter.ai/api/v1"

    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    response = await acompletion_with_temperature_fallback(**kwargs)
    await _record_usage_best_effort(
        config=config,
        session_id=session_id,
        provider=provider or "openai",
        model=model,
        operation=operation,
        messages=messages,
        response=response,
    )
    return response


def _usage_tokens_from_response(response: Any) -> tuple[int | None, int | None]:
    usage = getattr(response, "usage", None)
    if usage is None and isinstance(response, dict):
        usage = response.get("usage")
    if usage is None:
        return None, None

    prompt_tokens = getattr(usage, "prompt_tokens", None)
    completion_tokens = getattr(usage, "completion_tokens", None)
    if isinstance(usage, dict):
        prompt_tokens = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")
    try:
        parsed_prompt = int(prompt_tokens) if prompt_tokens is not None else None
    except (TypeError, ValueError):
        parsed_prompt = None
    try:
        parsed_completion = int(completion_tokens) if completion_tokens is not None else None
    except (TypeError, ValueError):
        parsed_completion = None
    return parsed_prompt, parsed_completion


async def _record_usage_best_effort(
    *,
    config: AgentConfig,
    session_id: uuid.UUID | None,
    provider: str,
    model: str,
    operation: str,
    messages: list[dict[str, Any]],
    response: Any,
) -> None:
    app_id = getattr(config, "app_id", None)
    if not app_id:
        return

    input_tokens, output_tokens = _usage_tokens_from_response(response)
    if input_tokens is None:
        input_tokens = estimate_tokens_from_messages(messages)

    try:
        await record_llm_usage_event(
            app_id=app_id,
            session_id=session_id,
            provider=(provider or "").strip().lower() or "unknown",
            model=model,
            operation=operation,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
    except Exception:
        logger.debug("llm_usage_record_failed app_id=%s operation=%s", app_id, operation)


async def generate_tool_descriptions(
    config: AgentConfig,
    tool_calls: list[dict[str, Any]],
    *,
    session_id: uuid.UUID | None = None,
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
            operation="tool_description_generation",
            session_id=session_id,
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
