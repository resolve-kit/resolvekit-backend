# Presentation Competition Distill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Distill the `Competition` section to one visible statement card with a compact pricing block while preserving the detailed vendor snapshot behind disclosure.

**Architecture:** Keep the section inside `website/src/app/presentation/page.tsx`, reduce the visible composition to a single compact card, and update the contract test to protect the new visible markers. Do not change unrelated sections.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, pytest contract tests

---

### Task 1: Lock the new visible competition markers in the contract test

**Files:**
- Modify: `tests/test_website_presentation_contract.py`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Write the failing test**

Add assertions for:
- `Incumbents sell helpdesk automation. ResolveKit owns in-app resolution.`
- `Public band: $0.80-$1.50+`
- `ResolveKit target: $0.20`

**Step 2: Run test to verify it fails**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: FAIL because the new visible markers do not exist yet.

**Step 3: Write minimal implementation**

Modify `website/src/app/presentation/page.tsx` so the visible competition block contains only the compact statement and pricing block.

**Step 4: Run test to verify it passes**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

### Task 2: Distill the visible competition section

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Replace visible content**

- Remove the current visible card stack.
- Add one visible statement card with one compact pricing block.

**Step 2: Keep disclosure evidence**

- Keep the public competitor disclosure.
- Preserve the detailed vendor list there.

**Step 3: Verify**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

### Task 3: Final verification

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Modify: `tests/test_website_presentation_contract.py`
- Create: `docs/plans/2026-03-17-presentation-competition-distill-design.md`
- Create: `docs/plans/2026-03-17-presentation-competition-distill-implementation.md`

**Step 1: Run targeted test**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

**Step 2: Run website build**

Run: `npm run build`
Workdir: `website`
Expected: exit code 0
