import hashlib
import os

from cryptography.fernet import Fernet

os.environ.setdefault("KBS_ENCRYPTION_KEY", Fernet.generate_key().decode())

from kb_service.services.crawling import CrawledPage
from kb_service.services.ingestion import deduplicate_pages_by_hash


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def test_deduplicate_pages_by_hash_preserves_first_seen_order() -> None:
    pages = [
        CrawledPage(url="https://docs.example.com/a", title="A", content_markdown="reset password steps"),
        CrawledPage(url="https://docs.example.com/b", title="B", content_markdown="billing support"),
        CrawledPage(url="https://docs.example.com/c", title="C", content_markdown="reset password steps"),
        CrawledPage(url="https://docs.example.com/d", title="D", content_markdown="  "),
        CrawledPage(url="https://docs.example.com/e", title="E", content_markdown="billing support"),
    ]

    deduped, skipped = deduplicate_pages_by_hash(pages, existing_hashes=set())

    assert [page.url for page, _ in deduped] == [
        "https://docs.example.com/a",
        "https://docs.example.com/b",
    ]
    assert skipped == 2


def test_deduplicate_pages_by_hash_skips_existing_hashes() -> None:
    pages = [
        CrawledPage(url="https://docs.example.com/a", title="A", content_markdown="reset password steps"),
        CrawledPage(url="https://docs.example.com/b", title="B", content_markdown="billing support"),
        CrawledPage(url="https://docs.example.com/c", title="C", content_markdown="push notifications"),
    ]
    existing_hashes = {_content_hash("billing support")}

    deduped, skipped = deduplicate_pages_by_hash(pages, existing_hashes=existing_hashes)

    assert [page.url for page, _ in deduped] == [
        "https://docs.example.com/a",
        "https://docs.example.com/c",
    ]
    assert skipped == 1
