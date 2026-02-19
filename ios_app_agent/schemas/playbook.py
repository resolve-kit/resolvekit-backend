import uuid
from datetime import datetime

from pydantic import BaseModel


class PlaybookFunctionIn(BaseModel):
    function_id: uuid.UUID
    step_order: int = 0
    step_description: str | None = None


class PlaybookFunctionOut(BaseModel):
    function_id: uuid.UUID
    function_name: str = ""
    step_order: int
    step_description: str | None = None

    model_config = {"from_attributes": True}


class PlaybookCreate(BaseModel):
    name: str
    description: str = ""
    instructions: str = ""
    is_active: bool = True


class PlaybookUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None
    is_active: bool | None = None


class PlaybookOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    name: str
    description: str
    instructions: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    functions: list[PlaybookFunctionOut] = []

    model_config = {"from_attributes": True}


class PlaybookListOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    name: str
    description: str
    is_active: bool
    created_at: datetime
    function_count: int = 0

    model_config = {"from_attributes": True}
