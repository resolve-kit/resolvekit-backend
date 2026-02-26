import pytest

from knowledge_bases.services.document_conversion import (  # noqa: E402
    DocumentConversionError,
    convert_uploaded_file_bytes,
)


def test_convert_uploaded_file_bytes_accepts_plain_text() -> None:
    result = convert_uploaded_file_bytes(
        filename="faq.txt",
        content=b"Reset password via Settings.",
        content_type="text/plain",
        title="FAQ",
    )

    assert result.title == "FAQ"
    assert "Reset password" in result.markdown
    assert result.extension == ".txt"


def test_convert_uploaded_file_bytes_rejects_unsupported_extension() -> None:
    with pytest.raises(DocumentConversionError) as exc_info:
        convert_uploaded_file_bytes(
            filename="archive.exe",
            content=b"not allowed",
            content_type="application/octet-stream",
            title=None,
        )

    assert "unsupported" in str(exc_info.value).lower()


def test_convert_uploaded_file_bytes_rejects_oversized_file() -> None:
    with pytest.raises(DocumentConversionError) as exc_info:
        convert_uploaded_file_bytes(
            filename="big.txt",
            content=b"a" * 11,
            content_type="text/plain",
            title=None,
            max_file_bytes=10,
        )

    assert "size" in str(exc_info.value).lower()


def test_convert_uploaded_file_bytes_falls_back_when_markitdown_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BrokenMarkItDown:
        def __init__(self, *args, **kwargs):
            pass

        def convert(self, *args, **kwargs):
            raise RuntimeError("boom")

    monkeypatch.setattr("knowledge_bases.services.document_conversion.MarkItDown", _BrokenMarkItDown)

    result = convert_uploaded_file_bytes(
        filename="notes.txt",
        content=b"line one\nline two",
        content_type="text/plain",
        title=None,
    )

    assert "line one" in result.markdown


def test_convert_uploaded_file_bytes_rejects_empty_extraction(monkeypatch: pytest.MonkeyPatch) -> None:
    class _EmptyMarkItDown:
        def __init__(self, *args, **kwargs):
            pass

        def convert(self, *args, **kwargs):
            class _Result:
                text_content = "   "

            return _Result()

    monkeypatch.setattr("knowledge_bases.services.document_conversion.MarkItDown", _EmptyMarkItDown)

    with pytest.raises(DocumentConversionError) as exc_info:
        convert_uploaded_file_bytes(
            filename="blank.txt",
            content=b"   ",
            content_type="text/plain",
            title=None,
        )

    assert "extractable text" in str(exc_info.value).lower()
