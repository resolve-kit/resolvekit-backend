# App-Level KB Vision Mode Design

**Date:** 2026-02-28

## Context

The current knowledge-base runtime is text-first. Uploaded files are converted to text, chunked, and searched semantically/lexically. There is no app-level control to explicitly choose OCR-safe retrieval vs full multimodal behavior.

The requirement is to let each app choose its own vision behavior in the same place where the app chooses its LLM model, and to make model capability fit visible in dashboard UX.

## Decision

Adopt **Option 1: App mode flag**.

- Add app-level config field: `kb_vision_mode`.
- Allowed values:
  - `ocr_safe` (default): OCR/text-only retrieval and reasoning path.
  - `multimodal`: retrieval can include image-derived signals and vision-capable reasoning when supported.
- Expose the setting in the app model configuration UX, with model capability badges and validation.

This keeps rollout low-risk while enabling progressive multimodal behavior.

## Architecture

### 1) App Config Surface

`kb_vision_mode` becomes part of app config (`agent_configs`) and is returned by app config APIs.

Touchpoints:
- Agent SQLAlchemy model (`agent/models/agent_config.py`)
- Dashboard Prisma model (`dashboard/prisma/schema.prisma`)
- Dashboard config route + serializer
- Agent config schemas used by API/runtime boundaries

### 2) Dashboard UX

On the app LLM config page:
- Show capability badges for selected model:
  - `OCR Compatible`
  - `Multimodal Vision`
- Add mode selector:
  - `Low-risk OCR`
  - `Full multimodal`
- Save-time validation prevents unsupported pairings.

Model capability metadata is returned with model discovery responses.

### 3) Retrieval/Runtime Behavior

At turn runtime, orchestrator reads `kb_vision_mode`:
- `ocr_safe`: maintain current text/OCR-only enrichment/tool behavior.
- `multimodal`: allow image-aware retrieval blocks and optional vision reasoning step when supported.

If model/runtime capability is insufficient, fail open to `ocr_safe` path and continue turn.

### 4) Ingestion and Search Evolution

Keep existing text ingestion stable, then extend:
- accept image uploads (`.png`, `.jpg`, `.jpeg`, `.webp`, optional `.heic`)
- produce OCR text chunks (phase 1)
- add optional image-caption/UI-structure chunks (phase 2)

Mode-aware search filtering:
- `ocr_safe`: include text + OCR chunks only
- `multimodal`: include image-caption/vision chunks as available

## Error Handling

- Config save errors: `422` for incompatible model/mode selections.
- Runtime vision degradation: fallback to OCR-safe behavior without aborting turns.
- Ingestion image extraction failures are source-scoped and non-fatal to other content.

## Testing Strategy

- Agent model/config defaults include `kb_vision_mode` default.
- Config API read/write includes new field and validates allowed values.
- Dashboard model discovery includes capability metadata and UI selector behavior.
- Runtime tests verify mode selection and multimodal fallback behavior.

## Rollout

1. **Phase 1 (safe default):**
   - Add `kb_vision_mode` control plane + dashboard UX.
   - Add OCR capability signaling.
2. **Phase 2:**
   - Add multimodal retrieval gating and image-derived chunk integration.
3. **Phase 3:**
   - Add optional vision reasoning path with telemetry and fallback.

## Non-Goals (initial scope)

- Full cross-provider feature parity for every model family on day one.
- Rewriting existing KB ranking architecture.
- Enforcing hard runtime failures when multimodal capability is unavailable.
