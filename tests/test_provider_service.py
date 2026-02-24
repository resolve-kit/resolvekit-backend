from ios_app_agent.services.provider_service import list_providers


def test_providers_have_custom_base_url_flag():
    providers = list_providers()
    for p in providers:
        assert hasattr(p, "custom_base_url"), f"{p.id} missing custom_base_url"


def test_nexos_has_custom_base_url():
    providers = list_providers()
    nexos = next((p for p in providers if p.id == "nexos"), None)
    assert nexos is not None
    assert nexos.custom_base_url is True


def test_openai_no_custom_base_url():
    providers = list_providers()
    openai = next((p for p in providers if p.id == "openai"), None)
    assert openai is not None
    assert openai.custom_base_url is False
