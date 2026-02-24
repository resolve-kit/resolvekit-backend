import uuid

import pytest
from pydantic import ValidationError

from ios_app_agent.schemas.knowledge_base import (
    OrganizationEmbeddingProfileChangeImpactRequest,
    OrganizationEmbeddingProfileCreate,
)


def test_embedding_profile_create_rejects_legacy_provider_fields():
    with pytest.raises(ValidationError):
        OrganizationEmbeddingProfileCreate(
            name="OpenAI Embeddings",
            llm_profile_id=uuid.uuid4(),
            embedding_model="text-embedding-3-small",
            provider="openai",
        )


def test_embedding_profile_change_impact_accepts_new_fields():
    payload = OrganizationEmbeddingProfileChangeImpactRequest(
        llm_profile_id=uuid.uuid4(),
        embedding_model="text-embedding-3-small",
    )
    assert payload.embedding_model == "text-embedding-3-small"
