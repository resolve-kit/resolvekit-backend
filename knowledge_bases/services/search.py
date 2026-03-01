import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from knowledge_bases.models import KnowledgeBase, KnowledgeChunk, KnowledgeDocument
from knowledge_bases.services.embedding import cosine_similarity, embed_texts
from knowledge_bases.services.embedding_runtime import runtime_from_kb_active

_RRF_K = 60
_SEMANTIC_RRF_WEIGHT = 0.7
_LEXICAL_RRF_WEIGHT = 0.3
_SEMANTIC_CANDIDATE_MULTIPLIER = 20
_LEXICAL_CANDIDATE_MULTIPLIER = 20
_MIN_CANDIDATE_POOL = 100


def _weighted_rrf_score(
    *,
    semantic_rank: int | None,
    lexical_rank: int | None,
    k: int = _RRF_K,
) -> float:
    score = 0.0
    if semantic_rank is not None:
        score += _SEMANTIC_RRF_WEIGHT / float(k + semantic_rank)
    if lexical_rank is not None:
        score += _LEXICAL_RRF_WEIGHT / float(k + lexical_rank)
    return score


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


async def _load_postgres_lexical_ranks(
    db: AsyncSession,
    *,
    kb_ids: list[uuid.UUID],
    query: str,
    limit: int,
) -> tuple[dict[uuid.UUID, int], dict[uuid.UUID, float]]:
    normalized = query.strip()
    if not kb_ids or not normalized or limit <= 0:
        return {}, {}

    tsvector_expr = func.to_tsvector("english", KnowledgeChunk.content_text)
    tsquery_expr = func.websearch_to_tsquery("english", normalized)
    rank_expr = func.ts_rank_cd(tsvector_expr, tsquery_expr)

    statement = (
        select(KnowledgeChunk.id, rank_expr.label("lexical_rank"))
        .where(KnowledgeChunk.knowledge_base_id.in_(kb_ids))
        .where(tsvector_expr.op("@@")(tsquery_expr))
        .order_by(rank_expr.desc(), KnowledgeChunk.id.asc())
        .limit(limit)
    )

    try:
        rows = (await db.execute(statement)).all()
    except Exception:
        # Fail open for environments where FTS is unavailable/misconfigured.
        return {}, {}

    rank_map: dict[uuid.UUID, int] = {}
    score_map: dict[uuid.UUID, float] = {}
    for index, row in enumerate(rows, start=1):
        chunk_id = row[0]
        raw_rank = row[1]
        if isinstance(chunk_id, uuid.UUID):
            rank_map[chunk_id] = index
            score_map[chunk_id] = float(raw_rank or 0.0)
    return rank_map, score_map


async def search_chunks(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    kb_ids: list[uuid.UUID],
    query: str,
    limit: int,
    exclude_modalities: list[str] | None = None,
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

    excluded = {item.strip().lower() for item in (exclude_modalities or []) if item.strip()}
    scored: list[_ScoredChunk] = []
    for chunk in chunks:
        metadata = chunk.metadata_json if isinstance(chunk.metadata_json, dict) else {}
        modality = str(metadata.get("modality", "")).strip().lower()
        if modality and modality in excluded:
            continue
        kb = kb_by_id.get(chunk.knowledge_base_id)
        if kb is None:
            continue
        query_embedding = await query_embedding_for_kb(kb)
        semantic = cosine_similarity(query_embedding, chunk.embedding or [])
        scored.append(_ScoredChunk(chunk=chunk, score=0.0, semantic_score=semantic, lexical_score=0.0))

    if not scored:
        return []

    semantic_sorted = sorted(scored, key=lambda item: item.semantic_score, reverse=True)
    semantic_rank_by_chunk_id = {
        item.chunk.id: index
        for index, item in enumerate(semantic_sorted, start=1)
    }
    semantic_pool_size = max(_MIN_CANDIDATE_POOL, limit * _SEMANTIC_CANDIDATE_MULTIPLIER)
    semantic_candidate_ids = [item.chunk.id for item in semantic_sorted[:semantic_pool_size]]

    lexical_pool_size = max(_MIN_CANDIDATE_POOL, limit * _LEXICAL_CANDIDATE_MULTIPLIER)
    lexical_rank_by_chunk_id, lexical_score_by_chunk_id = await _load_postgres_lexical_ranks(
        db,
        kb_ids=valid_kb_ids,
        query=query,
        limit=lexical_pool_size,
    )

    chunk_by_id = {item.chunk.id: item for item in scored}
    candidate_ids: set[uuid.UUID] = set(semantic_candidate_ids)
    candidate_ids.update(lexical_rank_by_chunk_id.keys())

    fused: list[_ScoredChunk] = []
    for chunk_id in candidate_ids:
        item = chunk_by_id.get(chunk_id)
        if item is None:
            continue
        semantic_rank = semantic_rank_by_chunk_id.get(chunk_id)
        lexical_rank = lexical_rank_by_chunk_id.get(chunk_id)
        item.lexical_score = lexical_score_by_chunk_id.get(chunk_id, 0.0)
        item.score = _weighted_rrf_score(
            semantic_rank=semantic_rank,
            lexical_rank=lexical_rank,
        )
        fused.append(item)

    if not fused:
        return []

    fused.sort(
        key=lambda item: (
            item.score,
            item.semantic_score,
            item.lexical_score,
        ),
        reverse=True,
    )
    top = fused[:limit]
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
                "modality": (
                    item.chunk.metadata_json.get("modality")
                    if isinstance(item.chunk.metadata_json, dict)
                    else None
                ),
                "image_source_url": (
                    item.chunk.metadata_json.get("image_source_url")
                    if isinstance(item.chunk.metadata_json, dict)
                    else None
                ),
                "image_asset_path": (
                    item.chunk.metadata_json.get("image_asset_path")
                    if isinstance(item.chunk.metadata_json, dict)
                    else None
                ),
                "section_heading": (
                    item.chunk.metadata_json.get("section_heading")
                    if isinstance(item.chunk.metadata_json, dict)
                    else None
                ),
                "score": round(item.score, 6),
                "semantic_score": round(item.semantic_score, 6),
                "lexical_score": round(item.lexical_score, 6),
            }
        )
    return hits
