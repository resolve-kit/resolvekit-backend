import hashlib
import math
from typing import Iterable

import litellm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kb_service.models import OrganizationEmbeddingConfig
from kb_service.services.crypto import decrypt_secret

_LOCAL_DIM = 256


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0:
        return vec
    return [v / norm for v in vec]


def _local_embedding(text: str) -> list[float]:
    # Deterministic lightweight embedding fallback for environments
    # where no external embedding provider is configured yet.
    buckets = [0.0] * _LOCAL_DIM
    for token in text.lower().split():
        digest = hashlib.sha256(token.encode()).hexdigest()
        idx = int(digest[:8], 16) % _LOCAL_DIM
        buckets[idx] += 1.0
    return _normalize(buckets)


async def _provider_embedding(
    *,
    model: str,
    api_key: str,
    texts: list[str],
) -> list[list[float]]:
    response = await litellm.aembedding(
        model=model,
        input=texts,
        api_key=api_key,
    )
    data = response.get("data", [])
    vectors: list[list[float]] = []
    for item in data:
        embedding = item.get("embedding")
        if isinstance(embedding, list):
            vectors.append([float(v) for v in embedding])
    if len(vectors) != len(texts):
        return [_local_embedding(text) for text in texts]
    return [_normalize(v) for v in vectors]


async def embed_texts(db: AsyncSession, organization_id, texts: Iterable[str]) -> list[list[float]]:
    text_list = [t for t in texts]
    if not text_list:
        return []

    result = await db.execute(
        select(OrganizationEmbeddingConfig).where(
            OrganizationEmbeddingConfig.organization_id == organization_id
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        return [_local_embedding(text) for text in text_list]

    try:
        api_key = decrypt_secret(config.api_key_encrypted)
        return await _provider_embedding(model=config.model, api_key=api_key, texts=text_list)
    except Exception:
        return [_local_embedding(text) for text in text_list]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    size = min(len(a), len(b))
    if size == 0:
        return 0.0
    return sum(a[i] * b[i] for i in range(size))
