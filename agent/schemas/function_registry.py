import uuid
from datetime import datetime
from typing import Annotated
from typing import Any

from pydantic import BaseModel, Field

FunctionSource = Annotated[str, Field(pattern=r"^(app_inline|playbook_pack)$")]


class FunctionRegister(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: Annotated[str, Field(max_length=1000)] = ""
    parameters_schema: dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: Annotated[int, Field(ge=1, le=300)] = 30
    availability: dict[str, Any] = Field(default_factory=dict)
    required_entitlements: list[str] = Field(default_factory=list, max_length=64)
    required_capabilities: list[str] = Field(default_factory=list, max_length=64)
    source: FunctionSource = "app_inline"
    pack_name: str | None = None
    requires_approval: bool = True


class FunctionBulkSync(BaseModel):
    functions: list[FunctionRegister] = Field(max_length=512)


class FunctionUpdate(BaseModel):
    description: str | None = None
    description_override: str | None = None
    parameters_schema: dict[str, Any] | None = None
    is_active: bool | None = None
    timeout_seconds: int | None = None
    availability: dict[str, Any] | None = None
    required_entitlements: list[str] | None = None
    required_capabilities: list[str] | None = None
    source: FunctionSource | None = None
    pack_name: str | None = None
    requires_approval: bool | None = None


class FunctionOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    name: str
    description: str
    description_override: str | None = None
    parameters_schema: dict[str, Any]
    is_active: bool
    timeout_seconds: int
    availability: dict[str, Any]
    required_entitlements: list[str]
    required_capabilities: list[str]
    source: str
    pack_name: str | None = None
    requires_approval: bool
    created_at: datetime

    model_config = {"from_attributes": True}
