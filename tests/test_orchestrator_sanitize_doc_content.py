from agent.services.orchestrator import _sanitize_doc_content


def test_sanitize_doc_content_rewrites_markdown_links_and_strips_urls() -> None:
    source = (
        "See [Reset Guide](https://example.com/reset) and https://example.com/raw.\n"
        "Trailing space here   \n"
        "Keep [local](mailto:support@example.com) untouched."
    )

    assert _sanitize_doc_content(source) == (
        "See Reset Guide and\n"
        "Trailing space here\n"
        "Keep [local](mailto:support@example.com) untouched."
    )
