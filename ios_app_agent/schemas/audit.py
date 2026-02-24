import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    actor_email: str
    event_type: str
    entity_id: str | None
    entity_name: str | None
    diff: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditEventsPage(BaseModel):
    events: list[AuditEventOut]
    next_cursor: str | None
