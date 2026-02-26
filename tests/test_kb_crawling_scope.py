from knowledge_bases.services.crawling import _is_same_scope


def test_scope_allows_peer_articles_for_article_root() -> None:
    root = "https://support.surfshark.com/hc/en-us/articles/360012228480-How-to-troubleshoot-slow-speed-problems"
    peer = "https://support.surfshark.com/hc/en-us/articles/360012328620-How-to-fix-slow-connection-issues-on-Windows"
    assert _is_same_scope(root, peer) is True


def test_scope_rejects_other_hosts() -> None:
    root = "https://support.surfshark.com/hc/en-us/articles/360012228480-How-to-troubleshoot-slow-speed-problems"
    other_host = "https://example.com/hc/en-us/articles/360012328620-How-to-fix-slow-connection-issues-on-Windows"
    assert _is_same_scope(root, other_host) is False


def test_scope_respects_directory_prefix_when_root_is_directory() -> None:
    root = "https://docs.example.com/product/"
    inside = "https://docs.example.com/product/install"
    outside = "https://docs.example.com/blog/post-1"
    assert _is_same_scope(root, inside) is True
    assert _is_same_scope(root, outside) is False
