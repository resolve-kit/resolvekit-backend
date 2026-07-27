from pathlib import Path


def test_analytics_route_computes_resolution_and_escalation_rates() -> None:
    text = Path("dashboard/src/app/v1/apps/[appId]/analytics/route.ts").read_text(encoding="utf-8")

    assert 'resolvedBy: "ai"' in text
    assert 'status: "escalated"' in text
    assert 'resolvedBy: "human"' in text
    assert "resolution_rate: totalSessions > 0 ? resolvedSessions / totalSessions : 0" in text
    assert "escalation_rate: totalSessions > 0 ? escalatedSessions / totalSessions : 0" in text


def test_analytics_route_aggregates_csat_from_session_feedback() -> None:
    text = Path("dashboard/src/app/v1/apps/[appId]/analytics/route.ts").read_text(encoding="utf-8")

    assert "prisma.sessionFeedback.aggregate(" in text
    assert "prisma.sessionFeedback.groupBy(" in text


def test_expire_stale_sessions_marks_unescalated_sessions_ai_resolved() -> None:
    text = Path("agent/services/session_service.py").read_text(encoding="utf-8")

    assert '.values(status="expired", resolved_by="ai")' in text
