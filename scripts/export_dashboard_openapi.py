#!/usr/bin/env python3
"""Generate an OpenAPI snapshot for Next dashboard /v1 route handlers."""

from __future__ import annotations

import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ROUTES_ROOT = ROOT / "dashboard" / "src" / "app" / "v1"

METHOD_RE = re.compile(r"^export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b", re.MULTILINE)


def _route_path(route_file: Path) -> str:
    rel = route_file.relative_to(ROUTES_ROOT).as_posix()
    parts = rel.split("/")[:-1]  # drop route.ts
    normalized = [part[1:-1] if part.startswith("[") and part.endswith("]") else part for part in parts]
    return "/v1/" + "/".join(normalized)


def _operation_id(method: str, path: str) -> str:
    safe_path = path.strip("/").replace("/", "_").replace("{", "").replace("}", "")
    return f"{method.lower()}_{safe_path}"


def render_dashboard_openapi() -> str:
    paths: dict[str, dict[str, dict[str, object]]] = {}

    for route_file in sorted(ROUTES_ROOT.rglob("route.ts")):
        text = route_file.read_text(encoding="utf-8")
        methods = sorted(set(METHOD_RE.findall(text)))
        if not methods:
            continue

        path = _route_path(route_file)
        tag = (path.split("/")[2] if len(path.split("/")) > 2 else "dashboard")
        path_item = paths.setdefault(path, {})

        for method in methods:
            status = "204" if method == "DELETE" else "200"
            path_item[method.lower()] = {
                "operationId": _operation_id(method, path),
                "tags": [tag],
                "responses": {
                    status: {
                        "description": "Success",
                    }
                },
                "security": [
                    {"cookieAuth": []},
                    {"bearerAuth": []},
                ],
            }

    spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "ResolveKit Dashboard API",
            "version": "0.1.0",
            "description": "Generated from Next.js dashboard route handlers under dashboard/src/app/v1.",
        },
        "paths": dict(sorted(paths.items())),
        "components": {
            "securitySchemes": {
                "cookieAuth": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": "dashboard_token",
                },
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                },
            }
        },
    }
    return json.dumps(spec, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def export_dashboard_openapi() -> Path:
    out_dir = ROOT / "docs" / "generated" / "openapi"
    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / "dashboard.openapi.json"
    output.write_text(render_dashboard_openapi(), encoding="utf-8")
    return output


if __name__ == "__main__":
    path = export_dashboard_openapi()
    print(f"wrote {path.relative_to(ROOT)}")
