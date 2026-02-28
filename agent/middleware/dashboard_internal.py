from fastapi import Header, HTTPException, status

from agent.config import settings


def require_dashboard_internal_token(
    x_internal_dashboard_token: str | None = Header(default=None),
) -> None:
    """Gate dashboard/control-plane routes behind an internal shared token."""
    configured = settings.dashboard_internal_token
    if not configured:
        return
    if x_internal_dashboard_token != configured:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dashboard API is internal-only",
        )
