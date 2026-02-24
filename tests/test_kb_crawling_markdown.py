from types import SimpleNamespace

from kb_service.services.crawling import _extract_markdown_from_result


def test_extract_markdown_prefers_fit_markdown_over_raw() -> None:
    result = SimpleNamespace(
        markdown=SimpleNamespace(
            raw_markdown="raw nav-heavy content",
            fit_markdown="clean body content",
            markdown_with_citations="cited body content",
        )
    )

    assert _extract_markdown_from_result(result) == "clean body content"


def test_extract_markdown_falls_back_to_citations_then_raw() -> None:
    with_citations = SimpleNamespace(
        markdown=SimpleNamespace(raw_markdown="raw content", fit_markdown="", markdown_with_citations="cited content")
    )
    with_raw_only = SimpleNamespace(
        markdown=SimpleNamespace(raw_markdown="raw content", fit_markdown="", markdown_with_citations="")
    )

    assert _extract_markdown_from_result(with_citations) == "cited content"
    assert _extract_markdown_from_result(with_raw_only) == "raw content"
