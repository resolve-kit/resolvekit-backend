import re
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kb_service.models import KnowledgeChunk, KnowledgeDocument
from kb_service.services.embedding import cosine_similarity, embed_texts

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
    query_tokens = _tokens(query)
    query_embedding_list = await embed_texts(db, organization_id, [query])
    query_embedding = query_embedding_list[0] if query_embedding_list else []

    chunks = await _load_chunks_for_kbs(db, kb_ids)
    if not chunks:
        return []

    scored: list[_ScoredChunk] = []
    max_lexical = 1.0
    for chunk in chunks:
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
