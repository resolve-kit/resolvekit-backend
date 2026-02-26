import pytest
from sqlalchemy import text

from knowledge_bases import main as kb_main


@pytest.mark.asyncio
async def test_ensure_kb_search_indexes_creates_fts_index_sql() -> None:
    executed: list[str] = []

    class _Conn:
        async def execute(self, statement):  # noqa: ANN001
            executed.append(str(statement.compile(compile_kwargs={"literal_binds": True})))

    await kb_main._ensure_kb_search_indexes(_Conn())

    assert any("ix_knowledge_chunks_content_tsv_english" in stmt for stmt in executed)
    assert any("to_tsvector('english', content_text)" in stmt for stmt in executed)
