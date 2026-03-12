from pathlib import Path


PROXY_PATH = Path("website/src/proxy.ts")
ACCESS_PAGE_PATH = Path("website/src/app/enter/page.tsx")
ACCESS_ACTIONS_PATH = Path("website/src/app/enter/actions.ts")
ACCESS_LIB_PATH = Path("website/src/lib/presentation-access.ts")


def test_presentation_access_files_exist_and_reference_env_backed_gate() -> None:
    assert PROXY_PATH.exists(), "missing proxy for presentation access control"
    assert ACCESS_PAGE_PATH.exists(), "missing password entry page"
    assert ACCESS_ACTIONS_PATH.exists(), "missing presentation access action"
    assert ACCESS_LIB_PATH.exists(), "missing shared presentation access helpers"

    proxy_text = PROXY_PATH.read_text(encoding="utf-8")
    access_lib_text = ACCESS_LIB_PATH.read_text(encoding="utf-8")
    access_page_text = ACCESS_PAGE_PATH.read_text(encoding="utf-8")

    assert "PRESENTATION_ACCESS_COOKIE_NAME" in proxy_text
    assert "PRESENTATION_ENTRY_PATH" in proxy_text
    assert "PRESENTATION_PASSWORD" in access_lib_text
    assert "PRESENTATION_SLUG" in access_lib_text
    assert "password" in access_page_text.lower()
