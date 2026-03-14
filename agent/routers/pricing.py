from fastapi import APIRouter, Query

from agent.schemas.pricing import ModelPricingLookupOut
from agent.services.model_pricing import resolve_model_pricing

router = APIRouter(prefix="/v1/pricing", tags=["pricing"])


@router.get("/model", response_model=ModelPricingLookupOut)
async def get_model_pricing(
    provider: str = Query(..., min_length=1, max_length=64),
    model: str = Query(..., min_length=1, max_length=200),
):
    resolved_provider, resolved_model, pricing = resolve_model_pricing(provider, model)
    return ModelPricingLookupOut(
        provider=resolved_provider,
        model=resolved_model,
        pricing=pricing,
    )
