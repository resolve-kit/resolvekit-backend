from pathlib import Path


IOS_SDK_GITHUB_URL = "https://github.com/Nights-Are-Late/resolvekit-ios-sdk"
OLD_IOS_SDK_URL = "https://github.com/nedasvi/playbook-ios-sdk/blob/main/README.md"
OLD_BACKEND_INTEGRATION_URL = "https://github.com/nedasvi/playbook_backend/blob/main/SDK_INTEGRATION.md"


def test_website_sdk_flow_links_to_ios_sdk_repo() -> None:
    sdk_flow = Path("website/src/components/sections/sdk-flow.tsx").read_text(encoding="utf-8")
    urls = Path("website/src/lib/urls.ts").read_text(encoding="utf-8")
    home_page = Path("website/src/app/page.tsx").read_text(encoding="utf-8")

    assert IOS_SDK_GITHUB_URL in urls
    assert "iosSdkRepoUrl" in sdk_flow
    assert "iosSdkRepoUrl" in home_page


def test_dashboard_onboarding_links_to_ios_sdk_repo() -> None:
    guide_rail = Path("dashboard/src/components/OnboardingGuideRail.tsx").read_text(encoding="utf-8")

    assert IOS_SDK_GITHUB_URL in guide_rail
    assert OLD_IOS_SDK_URL not in guide_rail
    assert OLD_BACKEND_INTEGRATION_URL not in guide_rail


def test_dashboard_functions_empty_state_has_repo_button() -> None:
    functions_page = Path("dashboard/src/dashboard_pages/Functions.tsx").read_text(encoding="utf-8")

    assert "No functions registered yet." in functions_page
    assert "Open iOS SDK GitHub repo" in functions_page
    assert IOS_SDK_GITHUB_URL in functions_page
