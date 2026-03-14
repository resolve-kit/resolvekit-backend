from pydantic import BaseModel


class ModelPricingOut(BaseModel):
    input_per_million_usd: float | None = None
    output_per_million_usd: float | None = None
    image_per_thousand_usd: float | None = None
    source: str


class ModelPricingLookupOut(BaseModel):
    provider: str
    model: str
    pricing: ModelPricingOut | None = None
