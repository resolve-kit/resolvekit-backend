#!/usr/bin/env python3
"""Fail if committed OpenAPI snapshots are out of sync."""

from __future__ import annotations

import difflib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.export_openapi import _render_openapi  # noqa: E402
from agent.main import app as agent_app  # noqa: E402
from knowledge_bases.main import app as knowledge_bases_app  # noqa: E402


def _diff(expected: str, actual: str, name: str) -> str:
    lines = list(
        difflib.unified_diff(
            actual.splitlines(),
            expected.splitlines(),
            fromfile=f"{name} (committed)",
            tofile=f"{name} (expected)",
            lineterm="",
        )
    )
    return "\n".join(lines)


def check_openapi_sync() -> int:
    out_dir = ROOT / "docs" / "generated" / "openapi"
    targets = {
        "agent.openapi.json": _render_openapi(agent_app),
        "knowledge_bases.openapi.json": _render_openapi(knowledge_bases_app),
    }

    drift_found = False
    for name, expected in targets.items():
        path = out_dir / name
        if not path.exists():
            print(f"missing {path.relative_to(ROOT)}")
            drift_found = True
            continue
        actual = path.read_text(encoding="utf-8")
        if actual != expected:
            drift_found = True
            print(f"drift detected: {path.relative_to(ROOT)}")
            print(_diff(expected, actual, name))

    if drift_found:
        print("\nOpenAPI snapshots are out of date.")
        print("Run: uv run python scripts/export_openapi.py")
        return 1

    print("OpenAPI snapshots are in sync.")
    return 0


if __name__ == "__main__":
    raise SystemExit(check_openapi_sync())

