import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class FunctionRegister(BaseModel):
    name: str
    description: str = ""
    parameters_schema: dict[str, Any] = {}
    timeout_seconds: int = 30


class FunctionBulkSync(BaseModel):
    functions: list[FunctionRegister]


class FunctionUpdate(BaseModel):
    description: str | None = None
    description_override: str | None = None
    parameters_schema: dict[str, Any] | None = None
    is_active: bool | None = None
    timeout_seconds: int | None = None


class FunctionOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    name: str
    description: str
    description_override: str | None = None
    parameters_schema: dict[str, Any]
    is_active: bool
    timeout_seconds: int
    created_at: datetime

    model_config = {"from_attributes": True}
