# Presentation Priority Sections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the presentation page so `What changes`, `Go-to-market`, and `Unit economics` become the primary narrative chapters while keeping the page suitable for asynchronous review and live presentation.

**Architecture:** Keep the presentation as a single Next.js route in `website/src/app/presentation/page.tsx`, but replace the repeated section composition with more differentiated layouts in the three priority chapters. Keep the existing support chapters, update the sticky navigation CTA emphasis, and extend the contract test so the new narrative markers are protected.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, pytest contract tests

---

### Task 1: Lock the new narrative markers in the contract test

**Files:**
- Modify: `tests/test_website_presentation_contract.py`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Write the failing test**

Add assertions for:
- `The shift is from support that explains to support that resolves.`
- `Legacy support surface`
- `In-app resolution surface`
- `The wedge starts with one embedded workflow.`
- `Install`
- `Prove`
- `Expand`
- `Price far below incumbents. Keep margin structurally high.`
- `Show cost build`

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: FAIL because the new narrative strings do not exist yet.

**Step 3: Write minimal implementation**

Modify `website/src/app/presentation/page.tsx` so the new section labels and chapter phrases appear in the rendered page.

**Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_website_presentation_contract.py website/src/app/presentation/page.tsx
git commit -m "feat(presentation): prioritize resolution thesis"
```

### Task 2: Rebuild the `What changes` chapter

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Write the failing test**

Extend the contract test only if needed to protect the new comparison framing.

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: FAIL on the new framing assertion.

**Step 3: Write minimal implementation**

Replace the current product gap card group with:
- one thesis card
- one legacy-vs-new comparison grid
- one compact “why now” support block

**Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add website/src/app/presentation/page.tsx tests/test_website_presentation_contract.py
git commit -m "feat(presentation): remake what changes chapter"
```

### Task 3: Rebuild the go-to-market chapter

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Modify: `website/src/app/presentation/nav.tsx`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Write the failing test**

Protect the new go-to-market wedge copy if it is not already covered.

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: FAIL on the new wedge markers.

**Step 3: Write minimal implementation**

Change the section to:
- a three-step wedge sequence with stronger visual flow
- a secondary commercial model panel
- reduced CTA competition in the sticky nav and hero

**Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add website/src/app/presentation/page.tsx website/src/app/presentation/nav.tsx tests/test_website_presentation_contract.py
git commit -m "feat(presentation): sharpen go-to-market story"
```

### Task 4: Rebuild the unit economics chapter

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `tests/test_website_presentation_contract.py`

**Step 1: Write the failing test**

Protect the new economics headline and disclosure trigger in the contract test.

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: FAIL on the new economics markers.

**Step 3: Write minimal implementation**

Replace the current equal-weight economics cards with:
- one dominant price-versus-cost frame
- supporting economics proof cards
- a `details` disclosure for the full cost build

**Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add website/src/app/presentation/page.tsx tests/test_website_presentation_contract.py
git commit -m "feat(presentation): tighten economics chapter"
```

### Task 5: Verify the final page state

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Modify: `website/src/app/presentation/nav.tsx`
- Modify: `tests/test_website_presentation_contract.py`

**Step 1: Run targeted tests**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Expected: PASS

**Step 2: Run website build**

Run: `npm run build`
Workdir: `website`
Expected: exit code 0

**Step 3: Inspect final diff**

Run: `git diff -- website/src/app/presentation/page.tsx website/src/app/presentation/nav.tsx tests/test_website_presentation_contract.py docs/plans/2026-03-17-presentation-priority-sections-design.md docs/plans/2026-03-17-presentation-priority-sections-implementation.md`
Expected: diff contains only the planned narrative, layout, nav, and doc changes.

**Step 4: Commit**

```bash
git add website/src/app/presentation/page.tsx website/src/app/presentation/nav.tsx tests/test_website_presentation_contract.py docs/plans/2026-03-17-presentation-priority-sections-design.md docs/plans/2026-03-17-presentation-priority-sections-implementation.md
git commit -m "feat(presentation): prioritize key business chapters"
```
