from pathlib import Path


def test_chat_ws_watches_background_agent_task_and_surfaces_failures() -> None:
    text = Path("agent/routers/chat_ws.py").read_text(encoding="utf-8")

    assert "async def watch_agent_task(task: asyncio.Task)" in text
    assert "sender.send_error(" in text
    assert "\"agent_error\"" in text
    assert "asyncio.create_task(watch_agent_task(agent_task))" in text
