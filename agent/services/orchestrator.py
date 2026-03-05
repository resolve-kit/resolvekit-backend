import asyncio
import json
import logging
import re
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agent.models.agent_config import AgentConfig
from agent.models.app import App
from agent.models.app_knowledge_base import AppKnowledgeBase
from agent.models.function_registry import RegisteredFunction
from agent.models.knowledge_base_ref import KnowledgeBaseRef
from agent.models.message import Message
from agent.models.playbook import Playbook, PlaybookFunction
from agent.models.session import ChatSession
from agent.services.chat_access_service import (
    CHAT_UNAVAILABLE_CODE,
    CHAT_UNAVAILABLE_MESSAGE,
    is_chat_unavailable_provider_error,
)
from agent.services.compatibility_service import function_is_eligible
from agent.services.function_service import get_function_requires_approval, get_function_timeout, validate_function_exists
from agent.services.knowledge_bases_client import (
    KBServiceError,
    get_knowledge_base_briefs,
    search_multiple_knowledge_bases,
)
from agent.services.llm_service import build_tools, call_llm, generate_tool_descriptions
from agent.services.session_service import get_next_sequence, load_context_messages, update_activity

logger = logging.getLogger(__name__)

KB_SEARCH_TOOL_NAME = "kb_search"
KB_PREFETCH_MAX_ITEMS = 5
KB_PREFETCH_MAX_CHARS = 1200
KB_INDEX_MAX_ITEMS = 8
KB_INDEX_SUMMARY_MAX_CHARS = 260
KB_INDEX_MAX_TOPICS = 10
STRICT_SCOPE_REJECTION_TEXT = "I can only help with questions related to the app you are using."
INTENT_ACTION_TOKENS = {
    "add",
    "create",
    "deactivate",
    "delete",
    "disable",
    "enable",
    "get",
    "list",
    "monitor",
    "remove",
    "show",
    "track",
    "untrack",
    "update",
}
INTENT_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "can",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "please",
    "the",
    "to",
    "that",
    "them",
    "these",
    "this",
    "those",
    "one",
    "what",
    "you",
}
SUPPORT_CONTACT_HINT_PATTERN = re.compile(
    r"(?i)\b(support|help(?:\s*desk)?)\b.*\b(email|e-?mail|contact|phone|number)\b|"
    r"\b(email|e-?mail|contact|phone|number)\b.*\b(support|help(?:\s*desk)?)\b"
)
URL_TEXT_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)
URL_REQUEST_HINT_WORDS = ("share", "provide", "paste", "send", "specific", "track", "monitor", "add")
FOLLOWUP_PROMPT_HINT_WORDS = (
    "please share",
    "please provide",
    "can you share",
    "could you share",
    "which one",
    "what frequency",
    "how often",
    "confirm",
    "should i",
    "would you like",
)
NEW_REQUEST_PREFIXES = {
    "what",
    "who",
    "where",
    "when",
    "why",
    "how",
    "can",
    "could",
    "would",
    "should",
    "tell",
    "explain",
    "write",
    "create",
    "find",
    "search",
    "browse",
}

BASE_PROMPT = """\
You are an assistant for a software product. Your role is to help users, answer questions about the product,
and guide them through features using the tools and documentation available to you.

Guidelines:
- Be helpful, concise, and clear. Avoid unnecessary technical jargon unless the user is clearly technical.
- Use available tools when an action, verification, or real-time check is required.
- If client platform context is provided (for example iOS, Android, web, tvOS), tailor instructions to that
  platform. Do not list steps for other platforms unless the user asks.
- Prefer grounded answers from available documentation and playbooks over guessing.
- If pre-loaded documentation appears under "## Relevant Documentation", treat it as your primary source for
  product-specific questions before drawing on general knowledge.
- If support workflows appear under "## Available Playbooks", follow the relevant workflow step-by-step when the
  user's request matches it.
- Use the kb_search tool only for follow-up queries that require finding additional documentation not already in the
  pre-loaded context above, and include platform terms when relevant.
- For multi-step tasks, briefly explain each step before performing it so the user understands what is happening.
- Synthesize answers in your own words. Do not dump raw link lists or markdown URLs unless the user explicitly asks
  for links.
- If you cannot resolve the issue, clearly explain what you tried and suggest contacting support.\
"""

ROUTER_SYSTEM_PROMPT = """\
You are a routing classifier for an assistant.
Analyze the user's message and return a JSON object with exactly these fields:

{
  "in_scope": <bool>,
  "rejection_reason": <string or null>,
  "needs_kb": <bool>,
  "kb_query": <string or null>,
  "intent": <string>
}

Rules:
- in_scope: true if the message relates to using, troubleshooting, or understanding the product described in the
  product context. false if it is entirely unrelated to the product.
- Greetings and brief social niceties (for example: hi, hello, sup, thanks, thank you, bye, good morning) are
  considered in scope for conversational flow. For these messages, in_scope should be true.
- Use recent conversation context to resolve ambiguous follow-ups. If a short user reply (for example "yes",
  "this one", "every 10 minutes", or a pasted URL) clearly continues a prior product-related assistant prompt,
  in_scope should be true.
- rejection_reason: a short, polite user-facing sentence explaining why the message is out of scope. Only set when
  in_scope is false; null otherwise.
- For requests where the user asks you to find or choose products on the user's behalf, set in_scope to false and
  set rejection_reason to explain that you cannot browse/shop for them directly, then ask the user to share a
  specific product URL they want to track in the app.
- needs_kb: true if answering would likely benefit from searching product documentation.
- For questions asking for support contact details (for example support email, support phone, or how to contact
  support), needs_kb should be true.
- kb_query: if needs_kb is true, write a focused semantic search query optimized for finding relevant documentation.
  If client platform context is available, include it in the query. null otherwise.
- intent: one short sentence describing what the user wants.

Return only the JSON object. No markdown, no explanation.\
"""


@dataclass
class RouterResult:
    in_scope: bool
    rejection_reason: str | None
    needs_kb: bool
    kb_query: str | None
    intent: str


def _context_value(session: ChatSession, key: str) -> str | None:
    client = getattr(session, "client_context", {}) or {}

    candidate = client.get(key)
    if isinstance(candidate, str):
        cleaned = candidate.strip()
        return cleaned or None
    return None


def _build_platform_context(session: ChatSession) -> str:
    fields = {
        "Platform": _context_value(session, "platform"),
        "OS": _context_value(session, "os_name"),
        "OS Version": _context_value(session, "os_version"),
        "App Version": _context_value(session, "app_version"),
        "App Build": _context_value(session, "app_build"),
        "SDK": _context_value(session, "sdk_name"),
        "SDK Version": _context_value(session, "sdk_version"),
    }
    lines = [f"{label}: {value}" for label, value in fields.items() if value]
    return "\n".join(lines)


def _build_language_context(session: ChatSession) -> str:
    locale = getattr(session, "locale", "en") or "en"
    return (
        f"Locale: {locale}\n"
        "Always answer in this locale unless the user explicitly asks for a different language."
    )


def _sanitize_doc_content(text: str) -> str:
    # Replace markdown links with link text, then drop bare URLs.
    content = re.sub(r"\[([^\]]+)\]\(https?://[^)]+\)", r"\1", text)
    content = re.sub(r"https?://\S+", "", content)
    content = re.sub(r"\s+\n", "\n", content)
    return content.strip()


def _session_llm_context(session: ChatSession) -> dict[str, Any]:
    raw = getattr(session, "llm_context", {}) or {}
    return raw if isinstance(raw, dict) else {}


def _format_custom_context_for_prompt(value: dict[str, Any]) -> str:
    if not value:
        return ""
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)


def _collect_custom_context_query_lines(value: Any, prefix: str, lines: list[str], limit: int = 12) -> None:
    if len(lines) >= limit:
        return

    if isinstance(value, dict):
        for key, nested in value.items():
            if not isinstance(key, str):
                continue
            next_prefix = f"{prefix}.{key}" if prefix else key
            _collect_custom_context_query_lines(nested, next_prefix, lines, limit)
            if len(lines) >= limit:
                return
        return

    if isinstance(value, list):
        scalars: list[str] = []
        for item in value:
            if isinstance(item, (str, int, float, bool)):
                text = str(item).strip()
                if text:
                    scalars.append(text)
            if len(scalars) == 4:
                break
        if scalars and prefix:
            lines.append(f"{prefix}: {', '.join(scalars)}")
        return

    if isinstance(value, (str, int, float, bool)) and prefix:
        text = str(value).strip()
        if text:
            lines.append(f"{prefix}: {text[:120]}")


def _format_custom_context_for_query(value: dict[str, Any]) -> str:
    if not value:
        return ""
    lines: list[str] = []
    _collect_custom_context_query_lines(value, "", lines)
    return "\n".join(lines)


def _augment_query_with_session_context(query: str, platform_context: str = "", custom_context: str = "") -> str:
    base_query = query.strip()
    if not base_query:
        return base_query

    sections = [base_query]
    if platform_context:
        sections.append(f"Client platform context:\n{platform_context}")
    if custom_context:
        sections.append(f"Session custom context:\n{custom_context}")
    return "\n\n".join(sections)


def _sanitize_kb_item(item: dict[str, Any]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for key, value in item.items():
        if not isinstance(value, str):
            sanitized[key] = value
            continue

        normalized_key = key.lower()
        if normalized_key in {"url", "link", "source_url", "href"} or normalized_key.endswith("_url"):
            continue
        if normalized_key in {"content", "text", "snippet", "summary"}:
            cleaned = _sanitize_doc_content(value)
            if cleaned:
                sanitized[key] = cleaned
            continue
        sanitized[key] = value
    return sanitized


def _strip_json_fence(raw: str) -> str:
    stripped = raw.strip()
    if not stripped.startswith("```"):
        return stripped

    parts = stripped.split("```")
    if len(parts) < 2:
        return stripped
    fenced = parts[1].strip()
    if fenced.lower().startswith("json"):
        fenced = fenced[4:].strip()
    return fenced


def _tokenize_intent_text(text: str) -> set[str]:
    normalized = text.lower().replace("_", " ")
    tokens = {tok for tok in re.findall(r"[a-z0-9]+", normalized) if len(tok) >= 3}
    return {tok for tok in tokens if tok not in INTENT_STOPWORDS}


def _function_intent_tokens(fn: RegisteredFunction) -> set[str]:
    description = (fn.description_override or fn.description or "").strip()
    return _tokenize_intent_text(f"{fn.name} {description}")


def _context_intent_tokens(messages: list[Message]) -> set[str]:
    tokens: set[str] = set()
    for msg in messages:
        if msg.role not in {"assistant", "tool_result"}:
            continue
        content = (msg.content or "").strip()
        if not content:
            continue
        tokens.update(_tokenize_intent_text(content))
    return tokens


def _format_recent_messages_for_router(messages: list[Message], limit: int = 8) -> str:
    if not messages:
        return "None"
    rows: list[str] = []
    for msg in messages[-limit:]:
        role = str(getattr(msg, "role", "unknown") or "unknown")
        content = str(getattr(msg, "content", "") or "").strip()
        if not content:
            continue
        compact = " ".join(content.split())
        if len(compact) > 260:
            compact = f"{compact[:260].rstrip()}..."
        rows.append(f"{role}: {compact}")
    return "\n".join(rows) if rows else "None"


def _format_functions_for_router(functions: list[RegisteredFunction], limit: int = 20) -> str:
    if not functions:
        return "None"
    rows: list[str] = []
    for fn in functions:
        if not fn.is_active:
            continue
        desc = (fn.description_override or fn.description or "").strip()
        if len(desc) > 200:
            desc = f"{desc[:200].rstrip()}..."
        rows.append(f"- {fn.name}: {desc}")
        if len(rows) >= limit:
            break
    return "\n".join(rows) if rows else "None"


def _function_accepts_url_input(fn: RegisteredFunction) -> bool:
    schema = getattr(fn, "parameters_schema", None)
    if not isinstance(schema, dict):
        return False
    properties = schema.get("properties")
    if not isinstance(properties, dict):
        return False
    for raw_name in properties:
        name = str(raw_name).strip().lower()
        if name in {"url", "link", "href", "source_url"} or name.endswith("_url"):
            return True
    return False


def _assistant_recently_requested_url(messages: list[Message], lookback: int = 8) -> bool:
    recent = messages[-lookback:] if lookback > 0 else messages
    for msg in reversed(recent):
        if msg.role != "assistant":
            continue
        content = (msg.content or "").lower()
        if not content:
            continue
        if ("url" in content or "link" in content) and any(word in content for word in URL_REQUEST_HINT_WORDS):
            return True
    return False


def _assistant_recently_prompted_for_followup(messages: list[Message], lookback: int = 8) -> bool:
    recent = messages[-lookback:] if lookback > 0 else messages
    for msg in reversed(recent):
        if msg.role != "assistant":
            continue
        content = (msg.content or "").strip().lower()
        if not content:
            continue
        if "?" in content:
            return True
        if any(hint in content for hint in FOLLOWUP_PROMPT_HINT_WORDS):
            return True
    return False


def _is_brief_followup_user_reply(user_text: str, max_tokens: int = 8, max_chars: int = 100) -> bool:
    text = user_text.strip()
    if not text or len(text) > max_chars:
        return False
    if "?" in text or URL_TEXT_PATTERN.search(text):
        return False
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    if not tokens or len(tokens) > max_tokens:
        return False
    if tokens[0] in NEW_REQUEST_PREFIXES:
        return False
    return True


def _should_override_scope_rejection_for_brief_followup(user_text: str, recent_messages: list[Message]) -> bool:
    if not _assistant_recently_prompted_for_followup(recent_messages):
        return False
    return _is_brief_followup_user_reply(user_text)


def _should_override_scope_rejection_for_url_followup(
    user_text: str,
    active_functions: list[RegisteredFunction],
    recent_messages: list[Message],
) -> bool:
    if not URL_TEXT_PATTERN.search(user_text):
        return False
    if not any(_function_accepts_url_input(fn) for fn in active_functions):
        return False
    return _assistant_recently_requested_url(recent_messages)


def _should_override_scope_rejection(
    user_text: str,
    functions: list[RegisteredFunction],
    recent_messages: list[Message],
) -> bool:
    active_functions = [fn for fn in functions if fn.is_active]
    if not active_functions:
        return _should_override_scope_rejection_for_brief_followup(user_text, recent_messages)
    if _should_override_scope_rejection_for_url_followup(user_text, active_functions, recent_messages):
        return True
    if _should_override_scope_rejection_for_brief_followup(user_text, recent_messages):
        return True

    user_tokens = _tokenize_intent_text(user_text)
    if not user_tokens:
        return False

    action_tokens = user_tokens & INTENT_ACTION_TOKENS
    if not action_tokens:
        return False

    recent_context_tokens = _context_intent_tokens(recent_messages)
    user_entity_tokens = user_tokens - INTENT_ACTION_TOKENS

    for fn in active_functions:
        fn_tokens = _function_intent_tokens(fn)
        if not fn_tokens:
            continue
        overlap = user_tokens & fn_tokens
        if len(overlap) >= 2:
            return True
        if len(overlap) == 1 and overlap.issubset(INTENT_ACTION_TOKENS):
            if user_entity_tokens and recent_context_tokens and (user_entity_tokens & recent_context_tokens):
                return True
            # Follow-up references like "delete one of them" should remain in scope
            # if recent assistant/tool context is clearly in this function's domain.
            if not user_entity_tokens and recent_context_tokens and (fn_tokens & recent_context_tokens):
                return True
    return False


def _should_force_kb_prefetch(user_text: str) -> bool:
    return bool(SUPPORT_CONTACT_HINT_PATTERN.search(user_text))


def _normalize_tool_calls(raw_tool_calls: Any) -> list[dict[str, Any]]:
    if isinstance(raw_tool_calls, dict):
        raw_items = [raw_tool_calls]
    elif isinstance(raw_tool_calls, list):
        raw_items = raw_tool_calls
    else:
        return []

    normalized: list[dict[str, Any]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        tc_copy = dict(item)
        tc_copy.setdefault("type", "function")

        function_payload = tc_copy.get("function")
        if not isinstance(function_payload, dict):
            function_payload = {}
        function_copy = dict(function_payload)
        function_copy.setdefault("name", "")
        function_copy.setdefault("arguments", "")
        tc_copy["function"] = function_copy

        normalized.append(tc_copy)
    return normalized


def _append_llm_messages_from_context(llm_messages: list[dict[str, Any]], context_msgs: list[Message]) -> None:
    pending_tool_call: dict[str, Any] | None = None

    for msg in context_msgs:
        role = str(getattr(msg, "role", "") or "")
        content = getattr(msg, "content", None) or ""

        if role == "tool_call":
            # Start a new tool-call block. Any prior incomplete block is discarded.
            pending_tool_call = None
            tool_calls = _normalize_tool_calls(getattr(msg, "tool_calls", None))
            required_ids = {str(tc.get("id", "")).strip() for tc in tool_calls if str(tc.get("id", "")).strip()}
            if tool_calls and required_ids:
                pending_tool_call = {
                    "assistant_msg": {"role": "assistant", "content": content, "tool_calls": tool_calls},
                    "required_ids": required_ids,
                    "seen_ids": set(),
                    "tool_msgs": [],
                }
            elif content:
                llm_messages.append({"role": "assistant", "content": content})
            continue

        if role == "tool_result":
            if not pending_tool_call:
                continue
            tool_call_id = str(getattr(msg, "tool_call_id", "") or "").strip()
            if not tool_call_id or tool_call_id not in pending_tool_call["required_ids"]:
                pending_tool_call = None
                continue
            if tool_call_id in pending_tool_call["seen_ids"]:
                continue

            pending_tool_call["seen_ids"].add(tool_call_id)
            pending_tool_call["tool_msgs"].append({
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": content,
            })
            if pending_tool_call["seen_ids"] == pending_tool_call["required_ids"]:
                llm_messages.append(pending_tool_call["assistant_msg"])
                llm_messages.extend(pending_tool_call["tool_msgs"])
                pending_tool_call = None
            continue

        # Non-tool message: drop any incomplete tool-call block before appending.
        if pending_tool_call:
            pending_tool_call = None
        llm_messages.append({"role": role, "content": content})


async def _run_router(
    config: AgentConfig,
    user_text: str,
    session_id: uuid.UUID,
    platform_context: str,
    custom_context: str,
    recent_messages: list[Message] | None = None,
    functions: list[RegisteredFunction] | None = None,
) -> RouterResult:
    """Classify whether the message is in-scope and whether KB prefetch is useful."""
    recent_context = _format_recent_messages_for_router(recent_messages or [])
    function_context = _format_functions_for_router(functions or [])
    router_messages = [
        {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Product context:\n{config.system_prompt}\n\n"
                f"Client platform context:\n{platform_context or 'Unknown'}\n\n"
                f"Session custom context:\n{custom_context or 'None'}\n\n"
                f"Recent conversation context:\n{recent_context}\n\n"
                f"Available product actions:\n{function_context}\n\n"
                f"User message:\n{user_text}"
            ),
        },
    ]
    try:
        try:
            response = await call_llm(
                config,
                router_messages,
                tools=None,
                operation="router_classification",
                session_id=session_id,
            )
        except TypeError as exc:
            # Keep compatibility with lightweight/mocked call_llm implementations
            # that still expose the old signature.
            if "unexpected keyword argument" not in str(exc):
                raise
            response = await call_llm(config, router_messages, tools=None)
        raw_content = response.choices[0].message.content if response.choices else ""
        raw = _strip_json_fence(str(raw_content or ""))
        data = json.loads(raw)
        rejection_reason = data.get("rejection_reason")
        kb_query = data.get("kb_query")
        return RouterResult(
            in_scope=bool(data.get("in_scope", True)),
            rejection_reason=rejection_reason if isinstance(rejection_reason, str) else None,
            needs_kb=bool(data.get("needs_kb", False)),
            kb_query=kb_query if isinstance(kb_query, str) else None,
            intent=str(data.get("intent", "")),
        )
    except Exception:
        logger.warning(
            "router_failed session_id=%s app_id=%s defaulting_to_fail_open",
            session_id,
            getattr(config, "app_id", None),
        )
        return RouterResult(
            in_scope=True,
            rejection_reason=None,
            needs_kb=True,
            kb_query=user_text,
            intent="",
        )


async def _prefetch_kb_context(
    *,
    session_id: uuid.UUID,
    app_id: uuid.UUID | None,
    app_org_id: uuid.UUID | None,
    assigned_kb_ids: list[uuid.UUID],
    query: str,
    platform_context: str = "",
    custom_context: str = "",
    top_k: int = KB_PREFETCH_MAX_ITEMS,
    kb_vision_mode: str = "ocr_safe",
) -> str:
    """Pre-search KB and return a formatted documentation section for prompt enrichment."""
    if not app_org_id or not assigned_kb_ids:
        return ""

    search_query = _augment_query_with_session_context(
        query,
        platform_context=platform_context,
        custom_context=custom_context,
    )

    result = await execute_internal_kb_tool_call(
        session_id=session_id,
        app_id=app_id,
        app_org_id=app_org_id,
        assigned_kb_ids=assigned_kb_ids,
        arguments={"query": search_query, "top_k": top_k},
        kb_vision_mode=kb_vision_mode,
    )
    items = result.get("items", [])
    if not isinstance(items, list) or not items:
        return ""

    sections = ["\n\n## Relevant Documentation"]
    for item in items[:KB_PREFETCH_MAX_ITEMS]:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or item.get("source_title") or "Untitled"
        content = item.get("content") or item.get("text") or item.get("snippet") or ""
        content_text = _sanitize_doc_content(str(content))
        if not content_text:
            continue
        if len(content_text) > KB_PREFETCH_MAX_CHARS:
            content_text = f"{content_text[:KB_PREFETCH_MAX_CHARS].rstrip()}..."
        sections.append(f"\n### {title}\n{content_text}")

    if len(sections) == 1:
        return ""
    return "\n".join(sections)


def _assemble_system_prompt(
    *,
    dev_prompt: str,
    scope_mode: str,
    platform_context: str,
    language_context: str,
    custom_context: str,
    kb_context: str,
    kb_index_context: str = "",
    playbook_prompt: str = "",
) -> str:
    """Assemble the complete system prompt in stable section order."""
    sections = [BASE_PROMPT]
    if dev_prompt.strip():
        sections.append(f"\n\n## About This Product\n{dev_prompt.strip()}")
    if platform_context:
        sections.append(f"\n\n## Client Platform Context\n{platform_context}")
    if language_context:
        sections.append(f"\n\n## Language\n{language_context}")
    if custom_context:
        sections.append(f"\n\n## Session Custom Context\n{custom_context}")
    if scope_mode == "strict":
        sections.append(
            "\n\n## Scope\nYou are only permitted to help users with questions and tasks directly related to this "
            "product. If the user asks about topics unrelated to this product, politely decline and redirect them "
            "to their product-related needs."
        )
    if kb_context:
        sections.append(kb_context)
    if kb_index_context:
        sections.append(kb_index_context)
    if playbook_prompt:
        sections.append(playbook_prompt)
    return "".join(sections)


def _format_kb_assignment_index_context(raw_items: list[dict[str, Any]]) -> str:
    if not raw_items:
        return ""

    lines = ["\n\n## Assigned Knowledge Base Index"]
    added = 0
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "Knowledge Base").strip()
        summary = str(item.get("summary_text") or "").strip()
        status = str(item.get("summary_status") or "").strip().lower()
        topics_raw = item.get("summary_topics")
        topics: list[str] = []
        if isinstance(topics_raw, list):
            for topic in topics_raw:
                if isinstance(topic, str) and topic.strip():
                    topics.append(topic.strip())
                if len(topics) >= KB_INDEX_MAX_TOPICS:
                    break
        if not summary:
            if status in {"pending", "processing"}:
                lines.append(f"- {name}: summary refresh in progress.")
                added += 1
            continue
        clean_summary = _sanitize_doc_content(summary)
        if len(clean_summary) > KB_INDEX_SUMMARY_MAX_CHARS:
            clean_summary = f"{clean_summary[:KB_INDEX_SUMMARY_MAX_CHARS].rstrip()}..."
        topic_suffix = f" Topics: {', '.join(topics[:KB_INDEX_MAX_TOPICS])}." if topics else ""
        lines.append(f"- {name}: {clean_summary}{topic_suffix}")
        added += 1
        if added >= KB_INDEX_MAX_ITEMS:
            break

    return "\n".join(lines) if added > 0 else ""


async def _load_kb_assignment_index_context(
    *,
    session_id: uuid.UUID,
    app_org_id: uuid.UUID | None,
    assigned_kb_ids: list[uuid.UUID],
) -> str:
    if app_org_id is None or not assigned_kb_ids:
        return ""
    try:
        payload = await get_knowledge_base_briefs(
            org_id=app_org_id,
            actor_id=f"session:{session_id}",
            actor_role="system",
            kb_ids=assigned_kb_ids,
        )
    except KBServiceError:
        return ""
    items = payload.get("items", [])
    if not isinstance(items, list):
        return ""
    return _format_kb_assignment_index_context(items)


async def _noop_str() -> str:
    return ""


def _build_kb_search_tool() -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": KB_SEARCH_TOOL_NAME,
            "description": (
                "Search assigned knowledge bases for support documentation, troubleshooting steps, "
                "FAQ answers, and reference snippets."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "top_k": {"type": "integer"},
                },
                "required": ["query"],
            },
        },
    }


async def _load_kb_assignment_context(
    db: AsyncSession,
    app_id: uuid.UUID,
) -> tuple[uuid.UUID | None, list[uuid.UUID]]:
    app_result = await db.execute(select(App).where(App.id == app_id))
    app = app_result.scalar_one_or_none()
    if app is None:
        return None, []

    kb_result = await db.execute(
        select(KnowledgeBaseRef.external_kb_id)
        .join(AppKnowledgeBase, AppKnowledgeBase.knowledge_base_ref_id == KnowledgeBaseRef.id)
        .where(AppKnowledgeBase.app_id == app_id)
    )
    kb_ids: list[uuid.UUID] = []
    for raw_id in kb_result.scalars().all():
        try:
            kb_ids.append(uuid.UUID(str(raw_id)))
        except ValueError:
            continue
    return app.organization_id, kb_ids


async def execute_internal_kb_tool_call(
    *,
    session_id: uuid.UUID,
    app_id: uuid.UUID | None,
    app_org_id: uuid.UUID | None,
    assigned_kb_ids: list[uuid.UUID],
    arguments: dict[str, Any],
    kb_vision_mode: str = "ocr_safe",
) -> dict[str, Any]:
    query = str(arguments.get("query", "")).strip()
    top_k_raw = arguments.get("top_k", 5)
    try:
        top_k = max(1, min(20, int(top_k_raw)))
    except (TypeError, ValueError):
        top_k = 5

    if not query:
        return {"error": "query is required"}
    if not assigned_kb_ids or app_org_id is None:
        return {"error": "No knowledge bases are assigned to this app"}
    normalized_mode = kb_vision_mode.strip().lower()
    exclude_modalities = ["image_caption"] if normalized_mode != "multimodal" else []

    try:
        search_result = await search_multiple_knowledge_bases(
            org_id=app_org_id,
            actor_id=f"session:{session_id}",
            actor_role="system",
            kb_ids=assigned_kb_ids,
            query=query,
            limit=top_k,
            exclude_modalities=exclude_modalities,
            app_id=app_id,
            session_id=session_id,
        )
        raw_items = search_result.get("items", [])
        items: list[dict[str, Any]] = []
        if isinstance(raw_items, list):
            for raw_item in raw_items:
                if isinstance(raw_item, dict):
                    items.append(_sanitize_kb_item(raw_item))
        return {
            "query": query,
            "items": items,
        }
    except KBServiceError as exc:
        return {"error": exc.detail}


class MessageSender:
    """Interface for sending messages to the client (WebSocket or SSE)."""

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        raise NotImplementedError

    async def send_tool_call_request(
        self,
        call_id: str,
        function_name: str,
        arguments: dict,
        timeout_seconds: int,
        human_description: str = "",
        requires_approval: bool = True,
    ) -> None:
        raise NotImplementedError

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        raise NotImplementedError

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        raise NotImplementedError

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict[str, Any]:
        raise NotImplementedError


async def build_playbook_prompt(
    db: AsyncSession,
    app_id: uuid.UUID,
    session: ChatSession | None = None,
) -> str:
    """Load active playbooks and format them as a system prompt section."""
    result = await db.execute(
        select(Playbook)
        .options(selectinload(Playbook.playbook_functions).selectinload(PlaybookFunction.function))
        .where(Playbook.app_id == app_id, Playbook.is_active.is_(True))
        .order_by(Playbook.name)
    )
    playbooks = result.scalars().all()
    if not playbooks:
        return ""

    sections = ["\n\n## Available Playbooks"]
    for pb in playbooks:
        sections.append(f"\n### {pb.name}")
        if pb.instructions:
            sections.append(pb.instructions)
        steps = sorted(pb.playbook_functions, key=lambda pf: pf.step_order)
        if session is not None:
            eligible_steps: list[PlaybookFunction] = []
            for pf in steps:
                if pf.function and function_is_eligible(pf.function, session):
                    eligible_steps.append(pf)
            steps = eligible_steps
        if steps:
            sections.append("Steps:")
            for pf in steps:
                fn_name = pf.function.name if pf.function else "unknown"
                desc = f" — {pf.step_description}" if pf.step_description else ""
                sections.append(f"{pf.step_order}. {fn_name}{desc}")

    return "\n".join(sections)


async def run_agent_loop(
    db: AsyncSession,
    session: ChatSession,
    config: AgentConfig,
    functions: list[RegisteredFunction],
    user_text: str,
    sender: MessageSender,
) -> None:
    # 1. Persist user message
    seq = await get_next_sequence(db, session.id)
    user_msg = Message(
        session_id=session.id,
        sequence_number=seq,
        role="user",
        content=user_text,
    )
    db.add(user_msg)
    await db.commit()
    await update_activity(db, session.id)

    # 2. Build context
    sdk_tools = build_tools(functions) if functions else []
    platform_context = _build_platform_context(session)
    language_context = _build_language_context(session)
    raw_custom_context = _session_llm_context(session)
    custom_context_prompt = _format_custom_context_for_prompt(raw_custom_context)
    custom_context_query = _format_custom_context_for_query(raw_custom_context)
    (app_org_id, assigned_kb_ids), preloaded_context_msgs = await asyncio.gather(
        _load_kb_assignment_context(db, session.app_id),
        load_context_messages(db, session.id, config.max_context_messages),
    )
    router_result = await _run_router(
        config,
        user_text,
        session.id,
        platform_context,
        custom_context_prompt,
        preloaded_context_msgs,
        functions,
    )

    scope_mode = str(getattr(config, "scope_mode", "strict") or "strict")
    if not router_result.in_scope and scope_mode == "strict":
        if _should_override_scope_rejection(user_text, functions, preloaded_context_msgs):
            logger.info(
                "router_scope_override_by_function_intent session_id=%s app_id=%s",
                session.id,
                session.app_id,
            )
        else:
            router_reason = (router_result.rejection_reason or "").strip()
            rejection_text = router_reason or STRICT_SCOPE_REJECTION_TEXT
            seq = await get_next_sequence(db, session.id)
            rejection_msg = Message(
                session_id=session.id,
                sequence_number=seq,
                role="assistant",
                content=rejection_text,
            )
            db.add(rejection_msg)
            await db.commit()
            await sender.send_turn_complete(rejection_text, None)
            return

    force_kb_prefetch = _should_force_kb_prefetch(user_text)
    if force_kb_prefetch and not router_result.needs_kb:
        logger.info(
            "kb_prefetch_forced_by_support_contact_intent session_id=%s app_id=%s",
            session.id,
            session.app_id,
        )
    should_prefetch = bool(
        (router_result.needs_kb or force_kb_prefetch)
        and (router_result.kb_query or user_text).strip()
        and app_org_id is not None
        and assigned_kb_ids
    )
    kb_vision_mode = str(getattr(config, "kb_vision_mode", "ocr_safe") or "ocr_safe")
    playbook_prompt, kb_context, kb_index_context = await asyncio.gather(
        build_playbook_prompt(db, session.app_id, session),
        _prefetch_kb_context(
            session_id=session.id,
            app_id=session.app_id,
            app_org_id=app_org_id,
            assigned_kb_ids=assigned_kb_ids,
            query=(router_result.kb_query or user_text).strip(),
            platform_context=platform_context,
            custom_context=custom_context_query,
            kb_vision_mode=kb_vision_mode,
        )
        if should_prefetch
        else _noop_str(),
        _load_kb_assignment_index_context(
            session_id=session.id,
            app_org_id=app_org_id,
            assigned_kb_ids=assigned_kb_ids,
        ),
    )

    tools = list(sdk_tools)
    if assigned_kb_ids:
        tools.append(_build_kb_search_tool())
    tools_payload = tools or None
    tool_round = 0

    while tool_round < config.max_tool_rounds:
        if preloaded_context_msgs is not None:
            context_msgs = preloaded_context_msgs
            preloaded_context_msgs = None
        else:
            context_msgs = await load_context_messages(db, session.id, config.max_context_messages)
        system_prompt = _assemble_system_prompt(
            dev_prompt=config.system_prompt,
            scope_mode=scope_mode,
            platform_context=platform_context,
            language_context=language_context,
            custom_context=custom_context_prompt,
            kb_context=kb_context,
            kb_index_context=kb_index_context,
            playbook_prompt=playbook_prompt,
        )
        llm_messages = [{"role": "system", "content": system_prompt}]
        _append_llm_messages_from_context(llm_messages, context_msgs)

        # 3. Call LLM (non-streaming)
        try:
            response = await call_llm(
                config,
                llm_messages,
                tools_payload,
                operation="assistant_completion",
                session_id=session.id,
            )
        except Exception as e:
            logger.exception("llm_call_failed session_id=%s app_id=%s", session.id, session.app_id)
            if is_chat_unavailable_provider_error(e):
                logger.warning(
                    "llm_call_mapped_chat_unavailable session_id=%s app_id=%s error_type=%s error=%s",
                    session.id,
                    session.app_id,
                    e.__class__.__name__,
                    str(e),
                )
                await sender.send_error(
                    CHAT_UNAVAILABLE_CODE,
                    CHAT_UNAVAILABLE_MESSAGE,
                    recoverable=True,
                )
                return
            await sender.send_error(
                "llm_error",
                "Assistant is temporarily unavailable. Please try again.",
                recoverable=True,
            )
            return

        # Process non-streaming response
        choice = response.choices[0] if response.choices else None
        message = choice.message if choice else None

        accumulated_text = (message.content or "") if message else ""
        tool_calls_data: list[dict[str, Any]] = []
        usage_data = None

        if message and message.tool_calls:
            for tc in message.tool_calls:
                tool_calls_data.append({
                    "id": tc.id or "",
                    "type": "function",
                    "function": {
                        "name": tc.function.name or "",
                        "arguments": tc.function.arguments or "",
                    },
                })

        if response.usage:
            usage_data = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
            }

        # 4. If text response (no tool calls) → done
        if accumulated_text and not tool_calls_data:
            seq = await get_next_sequence(db, session.id)
            assistant_msg = Message(
                session_id=session.id,
                sequence_number=seq,
                role="assistant",
                content=accumulated_text,
                token_count=usage_data.get("completion_tokens") if usage_data else None,
            )
            db.add(assistant_msg)
            await db.commit()
            await sender.send_turn_complete(accumulated_text, usage_data)
            return

        # 5. If tool calls → send to iOS and wait for results
        if tool_calls_data:
            # Save tool call message
            seq = await get_next_sequence(db, session.id)
            tc_msg = Message(
                session_id=session.id,
                sequence_number=seq,
                role="tool_call",
                content=accumulated_text or None,
                tool_calls=tool_calls_data,
            )
            db.add(tc_msg)
            await db.commit()

            # Pre-parse arguments and look up function descriptions for all tool calls
            tc_infos = []
            for tc in tool_calls_data:
                fn_name = tc["function"]["name"]
                try:
                    arguments = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    arguments = {}
                fn = next((f for f in functions if f.name == fn_name), None)
                tc_infos.append({
                    "id": tc["id"],
                    "name": fn_name,
                    "arguments": arguments,
                    "description": (fn.description_override or fn.description) if fn else "",
                    "is_kb_internal": fn_name == KB_SEARCH_TOOL_NAME,
                })

            # 5a. Execute internal KB tools server-side.
            for info in tc_infos:
                if not info["is_kb_internal"]:
                    continue
                kb_arguments = dict(info["arguments"]) if isinstance(info["arguments"], dict) else {}
                # Preserve explicit kb_search queries from the LLM as-is.
                # Appending platform/custom context here can drown entity-focused lookups.
                kb_arguments["query"] = str(kb_arguments.get("query", "")).strip()
                kb_payload = await execute_internal_kb_tool_call(
                    session_id=session.id,
                    app_id=session.app_id,
                    app_org_id=app_org_id,
                    assigned_kb_ids=assigned_kb_ids,
                    arguments=kb_arguments,
                    kb_vision_mode=kb_vision_mode,
                )

                seq = await get_next_sequence(db, session.id)
                result_msg = Message(
                    session_id=session.id,
                    sequence_number=seq,
                    role="tool_result",
                    tool_call_id=info["id"],
                    content=json.dumps(kb_payload),
                )
                db.add(result_msg)
                await db.commit()

            # 5b. Send SDK function tools to iOS
            sdk_tc_infos = [info for info in tc_infos if not info["is_kb_internal"]]
            descriptions = (
                await generate_tool_descriptions(config, sdk_tc_infos, session_id=session.id)
                if sdk_tc_infos
                else []
            )

            for i, info in enumerate(sdk_tc_infos):
                fn_name = info["name"]
                arguments = info["arguments"]
                human_description = descriptions[i] if i < len(descriptions) else f"I will run {fn_name}"

                if not validate_function_exists(functions, fn_name):
                    available = [f.name for f in functions if f.is_active]
                    seq = await get_next_sequence(db, session.id)
                    err_msg = Message(
                        session_id=session.id,
                        sequence_number=seq,
                        role="tool_result",
                        tool_call_id=info["id"],
                        content=json.dumps({"error": f"Unknown function '{fn_name}'. Available: {available}"}),
                    )
                    db.add(err_msg)
                    await db.commit()
                    continue

                timeout = get_function_timeout(functions, fn_name)
                requires_approval = get_function_requires_approval(functions, fn_name)
                await sender.send_tool_call_request(info["id"], fn_name, arguments, timeout, human_description, requires_approval)

            # Wait for all SDK tool results
            for info in sdk_tc_infos:
                fn_name = info["name"]
                if not validate_function_exists(functions, fn_name):
                    continue

                timeout = get_function_timeout(functions, fn_name)
                try:
                    result = await sender.wait_for_tool_result(info["id"], timeout)
                    if result.get("status") == "success":
                        raw = result.get("result")
                        content = raw if isinstance(raw, str) else json.dumps(raw)
                    else:
                        content = json.dumps({"error": result.get("error", "Unknown error")})
                    seq = await get_next_sequence(db, session.id)
                    result_msg = Message(
                        session_id=session.id,
                        sequence_number=seq,
                        role="tool_result",
                        tool_call_id=info["id"],
                        content=content,
                    )
                    db.add(result_msg)
                    await db.commit()
                except asyncio.TimeoutError:
                    seq = await get_next_sequence(db, session.id)
                    timeout_msg = Message(
                        session_id=session.id,
                        sequence_number=seq,
                        role="tool_result",
                        tool_call_id=info["id"],
                        content=json.dumps({"error": f"Function '{fn_name}' timed out after {timeout}s"}),
                    )
                    db.add(timeout_msg)
                    await db.commit()

            tool_round += 1
            continue

        # No text and no tool calls — shouldn't happen but break to be safe
        break

    # Max tool rounds exceeded — force text response
    if tool_round >= config.max_tool_rounds:
        await sender.send_error("max_tool_rounds", "Maximum tool calling rounds exceeded", recoverable=False)
