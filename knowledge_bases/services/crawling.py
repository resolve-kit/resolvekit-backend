from collections import deque
from dataclasses import dataclass, field
from html.parser import HTMLParser
import os
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

from knowledge_bases.config import settings

os.environ.setdefault("CRAWL4_AI_BASE_DIRECTORY", settings.crawl4ai_base_directory)

try:
    # Primary crawler path (Context7-guided integration).
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

    _HAS_CRAWL4AI = True
except Exception:  # pragma: no cover - optional dependency at runtime
    AsyncWebCrawler = None  # type: ignore[assignment]
    BrowserConfig = None  # type: ignore[assignment]
    CacheMode = None  # type: ignore[assignment]
    CrawlerRunConfig = None  # type: ignore[assignment]
    _HAS_CRAWL4AI = False


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http/https URLs are supported")
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", parsed.query, ""))


def _scope_path_prefix(path: str) -> str:
    if not path or path == "/":
        return "/"
    if path.endswith("/"):
        return path

    trimmed = path.strip("/")
    parts = [part for part in trimmed.split("/") if part]
    if not parts:
        return "/"

    # Single-segment paths (e.g. "/docs") are usually section roots.
    if len(parts) == 1:
        return f"/{parts[0]}/"

    # Multi-segment leaf paths are treated as document URLs; crawl peers in the parent directory.
    parent = "/" + "/".join(parts[:-1])
    return parent.rstrip("/") + "/"


def _is_same_scope(root_url: str, candidate_url: str) -> bool:
    root = urlparse(root_url)
    cand = urlparse(candidate_url)
    if cand.scheme not in {"http", "https"}:
        return False
    if cand.netloc != root.netloc:
        return False
    root_path = root.path or "/"
    cand_path = cand.path or "/"
    if cand_path == root.path:
        return True
    return cand_path.startswith(_scope_path_prefix(root_path))


class _HTMLContentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._chrome_depth = 0
        self._inside_title = False
        self._inside_heading = False
        self._heading_parts: list[str] = []
        self._recent_text_parts: list[str] = []
        self._last_heading: str | None = None
        self._dom_index = 0
        self.title = ""
        self.text_parts: list[str] = []
        self.links: list[str] = []
        self.image_candidates: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs):  # type: ignore[override]
        tag_lower = tag.lower()
        if tag_lower in {"script", "style", "noscript"}:
            self._skip_depth += 1
            return
        if tag_lower in {"header", "footer", "nav", "aside"}:
            self._chrome_depth += 1
            return
        if tag_lower == "title":
            self._inside_title = True
            return
        if tag_lower in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self._inside_heading = True
            self._heading_parts = []
            return
        if tag_lower == "a":
            href = None
            for key, value in attrs:
                if key.lower() == "href":
                    href = value
                    break
            if href:
                self.links.append(href)
            return
        if tag_lower == "img":
            attrs_map: dict[str, str] = {}
            for key, value in attrs:
                if isinstance(key, str) and isinstance(value, str):
                    attrs_map[key.lower()] = value
            src = (attrs_map.get("src") or "").strip()
            if not src:
                return
            self._dom_index += 1
            self.image_candidates.append(
                {
                    "src": src,
                    "alt_text": (attrs_map.get("alt") or "").strip() or None,
                    "title_text": (attrs_map.get("title") or "").strip() or None,
                    "context_text": " ".join(self._recent_text_parts[-2:]).strip() or None,
                    "section_heading": self._last_heading,
                    "dom_index": self._dom_index,
                    "width": _parse_int(attrs_map.get("width")),
                    "height": _parse_int(attrs_map.get("height")),
                    "in_chrome": self._chrome_depth > 0,
                    "css_class": (attrs_map.get("class") or "").strip() or None,
                    "element_id": (attrs_map.get("id") or "").strip() or None,
                }
            )
            return

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower in {"script", "style", "noscript"} and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if tag_lower in {"header", "footer", "nav", "aside"} and self._chrome_depth > 0:
            self._chrome_depth -= 1
            return
        if tag_lower == "title":
            self._inside_title = False
            return
        if tag_lower in {"h1", "h2", "h3", "h4", "h5", "h6"} and self._inside_heading:
            self._inside_heading = False
            heading_text = " ".join(self._heading_parts).strip()
            if heading_text:
                self._last_heading = heading_text[:255]
            self._heading_parts = []

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        text = data.strip()
        if not text:
            return
        if self._inside_title and not self.title:
            self.title = text[:255]
        if self._inside_heading:
            self._heading_parts.append(text)
        self.text_parts.append(text)
        self._recent_text_parts.append(text)
        if len(self._recent_text_parts) > 8:
            self._recent_text_parts = self._recent_text_parts[-8:]


def _parse_int(raw: str | None) -> int | None:
    if not raw:
        return None
    try:
        value = int(raw.strip())
    except Exception:
        return None
    return value if value > 0 else None


@dataclass
class CrawledImage:
    url: str
    alt_text: str | None
    title_text: str | None
    context_text: str | None
    section_heading: str | None
    dom_index: int
    width: int | None
    height: int | None
    in_chrome: bool
    css_class: str | None
    element_id: str | None


@dataclass
class CrawledPage:
    url: str
    title: str
    content_markdown: str
    images: list[CrawledImage] = field(default_factory=list)


def _extract_image_candidates_from_html(current_url: str, html: str) -> list[CrawledImage]:
    parser = _HTMLContentParser()
    parser.feed(html or "")
    images: list[CrawledImage] = []
    for item in parser.image_candidates:
        src = item.get("src")
        if not isinstance(src, str) or not src.strip():
            continue
        try:
            absolute = canonicalize_url(urljoin(current_url, src))
        except ValueError:
            continue
        images.append(
            CrawledImage(
                url=absolute,
                alt_text=item.get("alt_text"),
                title_text=item.get("title_text"),
                context_text=item.get("context_text"),
                section_heading=item.get("section_heading"),
                dom_index=int(item.get("dom_index") or 0),
                width=item.get("width"),
                height=item.get("height"),
                in_chrome=bool(item.get("in_chrome")),
                css_class=item.get("css_class"),
                element_id=item.get("element_id"),
            )
        )
    return images


async def _fetch_image_candidates_for_page(
    client: httpx.AsyncClient,
    *,
    current_url: str,
) -> list[CrawledImage]:
    try:
        response = await client.get(current_url)
        response.raise_for_status()
    except httpx.HTTPError:
        return []
    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type:
        return []
    return _extract_image_candidates_from_html(current_url, response.text)


def _extract_markdown_from_result(result: Any) -> str:
    markdown = getattr(result, "markdown", None)
    if markdown is None:
        return ""
    if isinstance(markdown, str):
        return markdown.strip()
    fit_md = getattr(markdown, "fit_markdown", None)
    if isinstance(fit_md, str) and fit_md.strip():
        return fit_md.strip()
    cited = getattr(markdown, "markdown_with_citations", None)
    if isinstance(cited, str) and cited.strip():
        return cited.strip()
    raw = getattr(markdown, "raw_markdown", None)
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return ""


def _extract_title_from_result(result: Any, fallback_url: str) -> str:
    metadata = getattr(result, "metadata", None)
    if isinstance(metadata, dict):
        title = metadata.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()[:255]
    return fallback_url


def _extract_internal_links(result: Any, current_url: str) -> list[str]:
    links = getattr(result, "links", None)
    if not isinstance(links, dict):
        return []
    internal = links.get("internal", [])
    if not isinstance(internal, list):
        return []

    urls: list[str] = []
    for link in internal:
        href: str | None = None
        if isinstance(link, dict):
            href_raw = link.get("href")
            if isinstance(href_raw, str):
                href = href_raw
        elif isinstance(link, str):
            href = link
        if not href:
            continue
        try:
            absolute = canonicalize_url(urljoin(current_url, href))
        except ValueError:
            continue
        urls.append(absolute)
    return urls


async def _crawl_with_crawl4ai(root_url: str) -> list[CrawledPage]:
    if not _HAS_CRAWL4AI or not settings.use_crawl4ai:
        return []

    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(root_url, 0)])
    pages: list[CrawledPage] = []

    browser_config = BrowserConfig(
        headless=settings.crawl4ai_headless,
        text_mode=True,
        verbose=settings.crawl4ai_verbose,
    )
    run_kwargs: dict[str, Any] = {
        "wait_until": "domcontentloaded",
        "page_timeout": max(1000, int(settings.crawl_timeout_seconds * 1000)),
        "verbose": settings.crawl4ai_verbose,
    }
    cache_bypass = getattr(CacheMode, "BYPASS", None)
    if cache_bypass is not None:
        run_kwargs["cache_mode"] = cache_bypass
    run_config = CrawlerRunConfig(**run_kwargs)

    timeout = httpx.Timeout(settings.crawl_timeout_seconds)
    headers = {"User-Agent": settings.crawl_user_agent}

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
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
                        result = await crawler.arun(url=current_url, config=run_config)
                    except Exception:
                        continue
                    if not getattr(result, "success", False):
                        continue

                    markdown = _extract_markdown_from_result(result)
                    if markdown:
                        images = await _fetch_image_candidates_for_page(client, current_url=current_url)
                        pages.append(
                            CrawledPage(
                                url=current_url,
                                title=_extract_title_from_result(result, current_url),
                                content_markdown=markdown,
                                images=images,
                            )
                        )

                    if depth < settings.crawl_max_depth:
                        for discovered in _extract_internal_links(result, current_url):
                            if discovered not in visited and _is_same_scope(root_url, discovered):
                                queue.append((discovered, depth + 1))
    except Exception:
        return []

    return pages


async def _crawl_with_httpx_parser(root_url: str) -> list[CrawledPage]:
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
                images = _extract_image_candidates_from_html(current_url, body)
            else:
                text = body
                title = current_url
                links = []
                images = []

            text = text.strip()
            if text:
                pages.append(
                    CrawledPage(
                        url=current_url,
                        title=title[:255],
                        content_markdown=text,
                        images=images,
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


async def crawl_site(start_url: str) -> list[CrawledPage]:
    root_url = canonicalize_url(start_url)
    pages = await _crawl_with_crawl4ai(root_url)
    if pages:
        return pages
    return await _crawl_with_httpx_parser(root_url)
