# Presentation Distill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Distill the presentation page by reducing duplicated economics content, compressing support chapters, and turning durability into a short closing section.

**Architecture:** Keep the existing single-route presentation structure and preserve the three core chapters. Rewrite support sections in `website/src/app/presentation/page.tsx` to reduce repetition and use progressive disclosure where detail is still useful. Update the contract test so the new shortened chapter markers remain protected.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, pytest contract tests

---

### Task 1: Add failing contract coverage for the distilled copy

**Files:**
- Modify: `tests/test_website_presentation_contract.py`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Write the failing test**

Add assertions for:
- `What matters now`
- `Show public competitor snapshot`
- `The moat is workflow ownership.`
- `Embedded context plus approved action.`

**Step 2: Run test to verify it fails**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: FAIL because the new distilled markers do not exist yet.

**Step 3: Write minimal implementation**

Modify `website/src/app/presentation/page.tsx` so the shortened support sections expose the new markers.

**Step 4: Run test to verify it passes**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

### Task 2: Distill the support chapters

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Distill proof**

- Keep the main proof block.
- Reduce synergies to one compact support card.

**Step 2: Distill market**

- Replace visible card stacks with one short thesis block.
- Keep detailed market data inside disclosure.

**Step 3: Distill competition**

- Keep the position statement.
- Replace the visible section with one contrast block: what incumbents optimize for vs what ResolveKit owns.
- Keep a visible pricing signal row in that block.
- Push competitor details behind a smaller disclosure.

**Step 4: Distill durability**

- Replace the multi-card ending with one concise closing card.

**Step 5: Verify**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

### Task 3: Distill unit economics

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Remove repeated proof**

- Keep the dark business-case block.
- Replace the repeated supporting card grid with a minimal reinforcement row.

**Step 2: Preserve detail**

- Keep the calculation disclosure intact, but remove repeated summary lines outside it.

**Step 3: Verify**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

### Task 4: Final verification

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Modify: `tests/test_website_presentation_contract.py`
- Create: `docs/plans/2026-03-17-presentation-distill-design.md`
- Create: `docs/plans/2026-03-17-presentation-distill-implementation.md`

**Step 1: Run targeted tests**

Run: `uv run python -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

**Step 2: Run website build**

Run: `npm run build`
Workdir: `website`
Expected: exit code 0
