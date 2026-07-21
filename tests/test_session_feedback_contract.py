from pathlib import Path


def test_feedback_endpoint_rejects_duplicate_ratings() -> None:
    text = Path("agent/routers/sessions.py").read_text(encoding="utf-8")

    assert '@sdk_router.post("/{session_id}/feedback"' in text
    assert "status_code=status.HTTP_409_CONFLICT" in text
    assert "Feedback already submitted for this session" in text


def test_feedback_schema_bounds_rating_one_to_five() -> None:
    text = Path("agent/schemas/session.py").read_text(encoding="utf-8")

    assert "class SessionFeedbackCreate(BaseModel):" in text
    assert "rating: int = Field(ge=1, le=5)" in text


def test_session_feedback_model_enforces_one_rating_per_session() -> None:
    text = Path("agent/models/session_feedback.py").read_text(encoding="utf-8")

    assert 'ForeignKey("chat_sessions.id", ondelete="CASCADE"), unique=True' in text
    assert 'CheckConstraint("rating >= 1 AND rating <= 5"' in text
