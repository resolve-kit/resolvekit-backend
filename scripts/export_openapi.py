#!/usr/bin/env python3
"""Export OpenAPI snapshots for agent and knowledge_bases."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent.main import app as agent_app  # noqa: E402
from knowledge_bases.main import app as knowledge_bases_app  # noqa: E402


def _render_openapi(app) -> str:
    spec = app.openapi()
    return json.dumps(spec, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def export_openapi() -> list[Path]:
    out_dir = ROOT / "docs" / "generated" / "openapi"
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = {
        out_dir / "agent.openapi.json": agent_app,
        out_dir / "knowledge_bases.openapi.json": knowledge_bases_app,
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

