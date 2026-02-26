from agent.models.playbook import Playbook


def test_playbook_updated_at_is_timezone_aware() -> None:
    assert Playbook.__table__.c.updated_at.type.timezone is True
