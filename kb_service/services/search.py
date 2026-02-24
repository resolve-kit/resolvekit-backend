import re
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kb_service.models import KnowledgeBase, KnowledgeChunk, KnowledgeDocument
from kb_service.services.embedding import cosine_similarity, embed_texts
from kb_service.services.embedding_runtime import runtime_from_kb_active

_WORD_RE = re.compile(r"[a-zA-Z0-9_]{2,}")


def _tokens(text: str) -> list[str]:
    return _WORD_RE.findall(text.lower())


def _lexical_score(query_tokens: list[str], content: str) -> float:
    if not query_tokens:
        return 0.0
    content_lower = content.lower()
    return float(sum(content_lower.count(token) for token in query_tokens))


@dataclass
class _ScoredChunk:
    chunk: KnowledgeChunk
    score: float
    semantic_score: float
    lexical_score: float


async def _load_chunks_for_kbs(db: AsyncSession, kb_ids: list[uuid.UUID]) -> list[KnowledgeChunk]:
    if not kb_ids:
        return []
    result = await db.execute(
        select(KnowledgeChunk).where(KnowledgeChunk.knowledge_base_id.in_(kb_ids))
    )
    return result.scalars().all()


async def search_chunks(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    kb_ids: list[uuid.UUID],
    query: str,
    limit: int,
) -> list[dict[str, Any]]:
    if not kb_ids:
        return []

    kb_result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.organization_id == organization_id,
            KnowledgeBase.id.in_(kb_ids),
        )
    )
    kb_list = kb_result.scalars().all()
    if not kb_list:
        return []

    kb_by_id = {kb.id: kb for kb in kb_list}
    valid_kb_ids = list(kb_by_id.keys())
    chunks = await _load_chunks_for_kbs(db, valid_kb_ids)
    if not chunks:
        return []

    query_tokens = _tokens(query)

    query_embedding_cache: dict[tuple[str | None, str | None, str | None, str | None], list[float]] = {}

    async def query_embedding_for_kb(kb: KnowledgeBase) -> list[float]:
        key = (
            kb.embedding_provider,
            kb.embedding_model,
            kb.embedding_api_base,
            kb.embedding_api_key_encrypted,
        )
        cached = query_embedding_cache.get(key)
        if cached is not None:
            return cached
        runtime = runtime_from_kb_active(kb)
        vectors = await embed_texts([query], runtime)
        vector = vectors[0] if vectors else []
        query_embedding_cache[key] = vector
        return vector

    scored: list[_ScoredChunk] = []
    max_lexical = 1.0
    for chunk in chunks:
        kb = kb_by_id.get(chunk.knowledge_base_id)
        if kb is None:
            continue
        query_embedding = await query_embedding_for_kb(kb)
        lexical = _lexical_score(query_tokens, chunk.content_text)
        max_lexical = max(max_lexical, lexical)
        semantic = cosine_similarity(query_embedding, chunk.embedding or [])
        scored.append(_ScoredChunk(chunk=chunk, score=0.0, semantic_score=semantic, lexical_score=lexical))

    for item in scored:
        lexical_norm = item.lexical_score / max_lexical
        # Hybrid blend with semantic bias.
        item.score = (item.semantic_score * 0.7) + (lexical_norm * 0.3)

    scored.sort(key=lambda item: item.score, reverse=True)
    top = scored[:limit]
    document_ids = list({item.chunk.document_id for item in top})
    docs_result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id.in_(document_ids)))
    docs = {doc.id: doc for doc in docs_result.scalars().all()}

    hits: list[dict[str, Any]] = []
    for item in top:
        doc = docs.get(item.chunk.document_id)
        if not doc:
            continue
        hits.append(
            {
                "knowledge_base_id": str(item.chunk.knowledge_base_id),
                "document_id": str(doc.id),
                "source_id": str(doc.source_id),
                "title": doc.title,
                "url": doc.canonical_url,
                "snippet": item.chunk.content_text[:800],
                "score": round(item.score, 6),
                "semantic_score": round(item.semantic_score, 6),
                "lexical_score": round(item.lexical_score, 6),
            }
        )
    return hits
