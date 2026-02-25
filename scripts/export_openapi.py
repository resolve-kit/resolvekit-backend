#!/usr/bin/env python3
"""Export OpenAPI snapshots for ios_app_agent and kb_service."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ios_app_agent.main import app as ios_app_agent_app  # noqa: E402
from kb_service.main import app as kb_service_app  # noqa: E402


def _render_openapi(app) -> str:
    spec = app.openapi()
    return json.dumps(spec, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def export_openapi() -> list[Path]:
    out_dir = ROOT / "docs" / "generated" / "openapi"
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = {
        out_dir / "ios_app_agent.openapi.json": ios_app_agent_app,
        out_dir / "kb_service.openapi.json": kb_service_app,
    }

    written: list[Path] = []
    for output, app in targets.items():
        output.write_text(_render_openapi(app), encoding="utf-8")
        written.append(output)
    return written


def main() -> None:
    for path in export_openapi():
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

