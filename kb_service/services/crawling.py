from collections import deque
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

from kb_service.config import settings


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http/https URLs are supported")
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", parsed.query, ""))


def _is_same_scope(root_url: str, candidate_url: str) -> bool:
    root = urlparse(root_url)
    cand = urlparse(candidate_url)
    if cand.scheme not in {"http", "https"}:
        return False
    if cand.netloc != root.netloc:
        return False
    root_path = root.path or "/"
    cand_path = cand.path or "/"
    if not root_path.endswith("/"):
        root_path = f"{root_path}/"
    if cand_path == root.path:
        return True
    return cand_path.startswith(root_path)


class _HTMLContentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._inside_title = False
        self.title = ""
        self.text_parts: list[str] = []
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs):  # type: ignore[override]
        tag_lower = tag.lower()
        if tag_lower in {"script", "style", "noscript"}:
            self._skip_depth += 1
            return
        if tag_lower == "title":
            self._inside_title = True
            return
        if tag_lower == "a":
            href = None
            for key, value in attrs:
                if key.lower() == "href":
                    href = value
                    break
            if href:
                self.links.append(href)

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower in {"script", "style", "noscript"} and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if tag_lower == "title":
            self._inside_title = False

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        text = data.strip()
        if not text:
            return
        if self._inside_title and not self.title:
            self.title = text[:255]
        self.text_parts.append(text)


@dataclass
class CrawledPage:
    url: str
    title: str
    content_markdown: str


async def crawl_site(start_url: str) -> list[CrawledPage]:
    root_url = canonicalize_url(start_url)
    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(root_url, 0)])
    pages: list[CrawledPage] = []

    timeout = httpx.Timeout(settings.crawl_timeout_seconds)
    headers = {"User-Agent": settings.crawl_user_agent}

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        while queue and len(pages) < settings.crawl_max_pages:
            current_url, depth = queue.popleft()
            if current_url in visited:
                continue
            visited.add(current_url)
            if depth > settings.crawl_max_depth:
                continue
            if not _is_same_scope(root_url, current_url):
                continue

            try:
                response = await client.get(current_url)
                response.raise_for_status()
            except httpx.HTTPError:
                continue

            content_type = response.headers.get("content-type", "")
            body = response.text
            if "text/html" not in content_type and "text/plain" not in content_type and "markdown" not in content_type:
                continue

            if "text/html" in content_type:
                parser = _HTMLContentParser()
                parser.feed(body)
                text = "\n".join(parser.text_parts)
                title = parser.title or current_url
                links = parser.links
            else:
                text = body
                title = current_url
                links = []

            text = text.strip()
            if text:
                pages.append(
                    CrawledPage(
                        url=current_url,
                        title=title[:255],
                        content_markdown=text,
                    )
                )

            if depth < settings.crawl_max_depth:
                for href in links:
                    try:
                        absolute = canonicalize_url(urljoin(current_url, href))
                    except ValueError:
                        continue
                    if absolute not in visited and _is_same_scope(root_url, absolute):
                        queue.append((absolute, depth + 1))

    return pages
