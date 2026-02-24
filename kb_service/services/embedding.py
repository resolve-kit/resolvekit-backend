import hashlib
import math
from dataclasses import dataclass
from typing import Iterable

import httpx
import litellm

_LOCAL_DIM = 256


@dataclass(frozen=True)
class EmbeddingRuntimeConfig:
    provider: str
    model: str
    api_key: str
    api_base: str | None = None


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


def _normalize_api_key(raw_key: str) -> str:
    key = raw_key.strip()
    lower = key.lower()
    if lower.startswith("bearer "):
        return key[7:].strip()
    if lower.startswith("hydra "):
        return key[6:].strip()
    return key


def _resolve_nexos_base_url(api_base: str | None) -> str:
    if api_base and api_base.strip():
        return api_base.rstrip("/")
    return "https://api.nexos.ai/v1"


async def _nexos_embedding(
    *,
    runtime: EmbeddingRuntimeConfig,
    texts: list[str],
) -> list[list[float]]:
    token = _normalize_api_key(runtime.api_key)
    base_url = _resolve_nexos_base_url(runtime.api_base)
    url = f"{base_url}/embeddings"
    payload = {
        "model": runtime.model,
        "input": texts,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()

    raw_vectors = data.get("data", []) if isinstance(data, dict) else []
    vectors: list[list[float]] = []
    for item in raw_vectors:
        if not isinstance(item, dict):
            continue
        embedding = item.get("embedding")
        if isinstance(embedding, list):
            vectors.append([float(v) for v in embedding])
    if len(vectors) != len(texts):
        return [_local_embedding(text) for text in texts]
    return [_normalize(v) for v in vectors]


async def _provider_embedding(
    *,
    runtime: EmbeddingRuntimeConfig,
    texts: list[str],
) -> list[list[float]]:
    if runtime.provider == "nexos":
        return await _nexos_embedding(runtime=runtime, texts=texts)

    model = runtime.model
    if runtime.provider and runtime.provider != "nexos" and "/" not in model:
        model = f"{runtime.provider}/{model}"

    kwargs = {
        "model": model,
        "input": texts,
        "api_key": _normalize_api_key(runtime.api_key),
    }
    if runtime.api_base:
        kwargs["api_base"] = runtime.api_base

    response = await litellm.aembedding(**kwargs)
    data = response.get("data", [])
    vectors: list[list[float]] = []
    for item in data:
        embedding = item.get("embedding")
        if isinstance(embedding, list):
            vectors.append([float(v) for v in embedding])
    if len(vectors) != len(texts):
        return [_local_embedding(text) for text in texts]
    return [_normalize(v) for v in vectors]


async def embed_texts(
    texts: Iterable[str],
    runtime: EmbeddingRuntimeConfig | None,
) -> list[list[float]]:
    text_list = [t for t in texts]
    if not text_list:
        return []

    if runtime is None:
        return [_local_embedding(text) for text in text_list]

    try:
        return await _provider_embedding(runtime=runtime, texts=text_list)
    except Exception:
        return [_local_embedding(text) for text in text_list]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    size = min(len(a), len(b))
    if size == 0:
        return 0.0
    return sum(a[i] * b[i] for i in range(size))
