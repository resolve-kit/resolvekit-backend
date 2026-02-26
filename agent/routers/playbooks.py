import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agent.database import get_db
from agent.middleware.auth import get_current_developer, require_app_ownership
from agent.models.app import App
from agent.models.developer import DeveloperAccount
from agent.models.function_registry import RegisteredFunction
from agent.models.playbook import Playbook, PlaybookFunction
from agent.schemas.playbook import (
    PlaybookCreate,
    PlaybookFunctionIn,
    PlaybookFunctionOut,
    PlaybookListOut,
    PlaybookOut,
    PlaybookUpdate,
)

router = APIRouter(prefix="/v1/apps/{app_id}/playbooks", tags=["playbooks"])


async def _get_app(app_id: uuid.UUID, developer: DeveloperAccount, db: AsyncSession) -> App:
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)
    return app


def _playbook_to_out(pb: Playbook) -> PlaybookOut:
    functions = []
    for pf in pb.playbook_functions:
        fn_name = pf.function.name if pf.function else ""
        functions.append(PlaybookFunctionOut(
            function_id=pf.function_id,
            function_name=fn_name,
            step_order=pf.step_order,
            step_description=pf.step_description,
        ))
    return PlaybookOut(
        id=pb.id,
        app_id=pb.app_id,
        name=pb.name,
        description=pb.description,
        instructions=pb.instructions,
        is_active=pb.is_active,
        created_at=pb.created_at,
        updated_at=pb.updated_at,
        functions=functions,
    )


@router.post("", response_model=PlaybookOut, status_code=status.HTTP_201_CREATED)
async def create_playbook(
    app_id: uuid.UUID,
    body: PlaybookCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    await _get_app(app_id, developer, db)

    pb = Playbook(
        app_id=app_id,
        name=body.name,
        description=body.description,
        instructions=body.instructions,
        is_active=body.is_active,
    )
    db.add(pb)
    await db.commit()
    await db.refresh(pb)

    result = await db.execute(
        select(Playbook)
        .options(selectinload(Playbook.playbook_functions).selectinload(PlaybookFunction.function))
        .where(Playbook.id == pb.id)
    )
    return _playbook_to_out(result.scalar_one())


@router.get("", response_model=list[PlaybookListOut])
async def list_playbooks(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    await _get_app(app_id, developer, db)

    result = await db.execute(
        select(
            Playbook,
            func.count(PlaybookFunction.function_id).label("function_count"),
        )
        .outerjoin(PlaybookFunction, Playbook.id == PlaybookFunction.playbook_id)
        .where(Playbook.app_id == app_id)
        .group_by(Playbook.id)
        .order_by(Playbook.created_at.desc())
    )
    rows = result.all()
    return [
        PlaybookListOut(
            id=pb.id,
            app_id=pb.app_id,
            name=pb.name,
            description=pb.description,
            is_active=pb.is_active,
            created_at=pb.created_at,
            function_count=count,
        )
        for pb, count in rows
    ]


@router.get("/{playbook_id}", response_model=PlaybookOut)
async def get_playbook(
    app_id: uuid.UUID,
    playbook_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    await _get_app(app_id, developer, db)

    result = await db.execute(
        select(Playbook)
        .options(selectinload(Playbook.playbook_functions).selectinload(PlaybookFunction.function))
        .where(Playbook.id == playbook_id, Playbook.app_id == app_id)
    )
    pb = result.scalar_one_or_none()
    if not pb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return _playbook_to_out(pb)


@router.patch("/{playbook_id}", response_model=PlaybookOut)
async def update_playbook(
    app_id: uuid.UUID,
    playbook_id: uuid.UUID,
    body: PlaybookUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    await _get_app(app_id, developer, db)

    pb = await db.get(Playbook, playbook_id)
    if not pb or pb.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(pb, field, value)
    await db.commit()

    result = await db.execute(
        select(Playbook)
        .options(selectinload(Playbook.playbook_functions).selectinload(PlaybookFunction.function))
        .where(Playbook.id == playbook_id)
    )
    return _playbook_to_out(result.scalar_one())


@router.delete("/{playbook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playbook(
    app_id: uuid.UUID,
    playbook_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    await _get_app(app_id, developer, db)

    pb = await db.get(Playbook, playbook_id)
    if not pb or pb.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")

    await db.delete(pb)
    await db.commit()


@router.put("/{playbook_id}/functions", response_model=PlaybookOut)
async def set_playbook_functions(
    app_id: uuid.UUID,
    playbook_id: uuid.UUID,
    body: list[PlaybookFunctionIn],
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    await _get_app(app_id, developer, db)

    pb = await db.get(Playbook, playbook_id)
    if not pb or pb.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")

    # Validate all function_ids belong to this app
    fn_ids = [f.function_id for f in body]
    if fn_ids:
        result = await db.execute(
            select(RegisteredFunction.id).where(
                RegisteredFunction.id.in_(fn_ids),
                RegisteredFunction.app_id == app_id,
            )
        )
        valid_ids = {row[0] for row in result.all()}
        invalid = set(fn_ids) - valid_ids
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid function IDs: {[str(i) for i in invalid]}",
            )

    # Delete existing associations
    existing = await db.execute(
        select(PlaybookFunction).where(PlaybookFunction.playbook_id == playbook_id)
    )
    for pf in existing.scalars().all():
        await db.delete(pf)

    # Create new associations
    for f in body:
        pf = PlaybookFunction(
            playbook_id=playbook_id,
            function_id=f.function_id,
            step_order=f.step_order,
            step_description=f.step_description,
        )
        db.add(pf)

    await db.commit()

    result = await db.execute(
        select(Playbook)
        .options(selectinload(Playbook.playbook_functions).selectinload(PlaybookFunction.function))
        .where(Playbook.id == playbook_id)
    )
    return _playbook_to_out(result.scalar_one())
