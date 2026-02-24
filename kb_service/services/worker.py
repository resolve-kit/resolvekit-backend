import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from kb_service.config import settings
from kb_service.database import async_session_factory
from kb_service.models import KnowledgeBase, KnowledgeIngestionJob
from kb_service.services.ingestion import process_ingestion_job


async def _claim_next_job():
    async with async_session_factory() as db:
        result = await db.execute(
            select(KnowledgeIngestionJob)
            .where(KnowledgeIngestionJob.status == "pending")
            .order_by(KnowledgeIngestionJob.created_at.asc())
            .limit(1)
        )
        job = result.scalar_one_or_none()
        if not job:
            return None
        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(job)
        return job.id


async def _process_job_by_id(job_id):
    async with async_session_factory() as db:
        job = await db.get(KnowledgeIngestionJob, job_id)
        if not job or job.status != "processing":
            return
        try:
            await process_ingestion_job(db, job)
            job.status = "completed"
            job.error = None
        except Exception as exc:
            await db.rollback()
            job = await db.get(KnowledgeIngestionJob, job_id)
            if not job:
                return
            job.status = "failed"
            job.error = str(exc)
            if job.job_type == "reembed_kb":
                kb = await db.get(KnowledgeBase, job.knowledge_base_id)
                if kb:
                    kb.embedding_regeneration_status = "failed"
                    kb.embedding_regeneration_error = str(exc)
        finally:
            job.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def worker_loop() -> None:
    while True:
        try:
            job_id = await _claim_next_job()
            if job_id is None:
                await asyncio.sleep(settings.worker_poll_seconds)
                continue
            await _process_job_by_id(job_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            await asyncio.sleep(settings.worker_poll_seconds)
