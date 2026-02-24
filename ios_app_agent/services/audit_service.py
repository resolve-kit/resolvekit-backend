import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.models.audit_event import AuditEvent


class AuditService:
    @staticmethod
    async def emit(
        db: AsyncSession,
        app_id: uuid.UUID,
        actor_email: str,
        event_type: str,
        entity_id: str | None = None,
        entity_name: str | None = None,
        diff: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> None:
        event = AuditEvent(
            app_id=app_id,
            actor_email=actor_email,
            event_type=event_type,
            entity_id=entity_id,
            entity_name=entity_name,
            diff=diff,
            ip_address=ip_address,
        )
        db.add(event)
        await db.flush()
