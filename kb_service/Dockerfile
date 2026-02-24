FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
RUN uv pip install --python /usr/local/bin/python3 crawl4ai

COPY kb_service/ ./kb_service/

CMD [".venv/bin/uvicorn", "kb_service.main:app", "--host", "0.0.0.0", "--port", "8100"]
