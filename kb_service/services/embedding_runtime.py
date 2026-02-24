from kb_service.models import KnowledgeBase, OrganizationEmbeddingProfile
from kb_service.services.crypto import decrypt_secret
from kb_service.services.embedding import EmbeddingRuntimeConfig


def runtime_from_profile(profile: OrganizationEmbeddingProfile) -> EmbeddingRuntimeConfig:
    return EmbeddingRuntimeConfig(
        provider=profile.provider,
        model=profile.model,
        api_key=decrypt_secret(profile.api_key_encrypted),
        api_base=profile.api_base,
    )


def runtime_from_kb_active(kb: KnowledgeBase) -> EmbeddingRuntimeConfig | None:
    if not kb.embedding_provider or not kb.embedding_model or not kb.embedding_api_key_encrypted:
        return None
    return EmbeddingRuntimeConfig(
        provider=kb.embedding_provider,
        model=kb.embedding_model,
        api_key=decrypt_secret(kb.embedding_api_key_encrypted),
        api_base=kb.embedding_api_base,
    )


def runtime_from_kb_pending(kb: KnowledgeBase) -> EmbeddingRuntimeConfig | None:
    if not kb.pending_embedding_provider or not kb.pending_embedding_model or not kb.pending_embedding_api_key_encrypted:
        return None
    return EmbeddingRuntimeConfig(
        provider=kb.pending_embedding_provider,
        model=kb.pending_embedding_model,
        api_key=decrypt_secret(kb.pending_embedding_api_key_encrypted),
        api_base=kb.pending_embedding_api_base,
    )
