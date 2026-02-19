import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ios_app_agent.models.agent_config import AgentConfig
from ios_app_agent.models.function_registry import RegisteredFunction
from ios_app_agent.models.message import Message
from ios_app_agent.models.playbook import Playbook, PlaybookFunction
from ios_app_agent.models.session import ChatSession
from ios_app_agent.services.function_service import get_function_timeout, validate_function_exists
from ios_app_agent.services.llm_service import build_tools, call_llm
from ios_app_agent.services.session_service import get_next_sequence, load_context_messages, update_activity


class MessageSender:
    """Interface for sending messages to the client (WebSocket or SSE)."""

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        raise NotImplementedError

    async def send_tool_call_request(
        self, call_id: str, function_name: str, arguments: dict, timeout_seconds: int
    ) -> None:
        raise NotImplementedError

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        raise NotImplementedError

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        raise NotImplementedError

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict[str, Any]:
        raise NotImplementedError


async def build_playbook_prompt(db: AsyncSession, app_id: uuid.UUID) -> str:
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
    tools = build_tools(functions) if functions else None
    tool_round = 0
    playbook_prompt = await build_playbook_prompt(db, session.app_id)

    while tool_round < config.max_tool_rounds:
        context_msgs = await load_context_messages(db, session.id, config.max_context_messages)
        system_prompt = config.system_prompt
        if playbook_prompt:
            system_prompt += playbook_prompt
        llm_messages = [{"role": "system", "content": system_prompt}]
        for msg in context_msgs:
            if msg.role == "tool_call":
                # Ensure each tool call has "type": "function" (required by OpenAI)
                tool_calls = []
                for tc in (msg.tool_calls or []):
                    tc_copy = dict(tc)
                    tc_copy.setdefault("type", "function")
                    tool_calls.append(tc_copy)
                llm_messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": tool_calls,
                })
            elif msg.role == "tool_result":
                llm_messages.append({
                    "role": "tool",
                    "tool_call_id": msg.tool_call_id,
                    "content": msg.content or "",
                })
            else:
                llm_messages.append({"role": msg.role, "content": msg.content or ""})

        # 3. Call LLM (streaming)
        try:
            response = await call_llm(config, llm_messages, tools)
        except Exception as e:
            await sender.send_error("llm_error", str(e), recoverable=True)
            return

        # Process streaming response
        accumulated_text = ""
        tool_calls_data: list[dict[str, Any]] = []
        usage_data = None

        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue

            # Text content
            if delta.content:
                accumulated_text += delta.content
                await sender.send_text_delta(delta.content, accumulated_text)

            # Tool calls
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index if hasattr(tc, "index") else 0
                    while len(tool_calls_data) <= idx:
                        tool_calls_data.append({"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                    if tc.id:
                        tool_calls_data[idx]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_calls_data[idx]["function"]["name"] += tc.function.name
                        if tc.function.arguments:
                            tool_calls_data[idx]["function"]["arguments"] += tc.function.arguments

            # Usage info
            if hasattr(chunk, "usage") and chunk.usage:
                usage_data = {
                    "prompt_tokens": chunk.usage.prompt_tokens,
                    "completion_tokens": chunk.usage.completion_tokens,
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

            # Send each tool call to iOS
            for tc in tool_calls_data:
                fn_name = tc["function"]["name"]
                try:
                    arguments = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    arguments = {}

                if not validate_function_exists(functions, fn_name):
                    # Unknown function — synthesize error
                    available = [f.name for f in functions if f.is_active]
                    seq = await get_next_sequence(db, session.id)
                    err_msg = Message(
                        session_id=session.id,
                        sequence_number=seq,
                        role="tool_result",
                        tool_call_id=tc["id"],
                        content=json.dumps({"error": f"Unknown function '{fn_name}'. Available: {available}"}),
                    )
                    db.add(err_msg)
                    await db.commit()
                    continue

                timeout = get_function_timeout(functions, fn_name)
                await sender.send_tool_call_request(tc["id"], fn_name, arguments, timeout)

            # Wait for all tool results
            for tc in tool_calls_data:
                fn_name = tc["function"]["name"]
                if not validate_function_exists(functions, fn_name):
                    continue

                timeout = get_function_timeout(functions, fn_name)
                try:
                    result = await sender.wait_for_tool_result(tc["id"], timeout)
                    if result.get("status") == "success":
                        raw = result.get("result")
                        # Ensure content is a JSON string the LLM can read
                        content = raw if isinstance(raw, str) else json.dumps(raw)
                    else:
                        content = json.dumps({"error": result.get("error", "Unknown error")})
                    seq = await get_next_sequence(db, session.id)
                    result_msg = Message(
                        session_id=session.id,
                        sequence_number=seq,
                        role="tool_result",
                        tool_call_id=tc["id"],
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
                        tool_call_id=tc["id"],
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
