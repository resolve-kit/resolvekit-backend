# Presentation Economics Expandable Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the presentation economics section into a clearer conclusion-first business case with one expandable calculations panel grounded in the March 14 resolution-cost report.

**Architecture:** Keep the presentation route structure intact and replace the current economics content model with a smaller set of high-signal cards plus one `<details>` disclosure for the report-backed math. Preserve the existing visual system and responsive behavior while reducing copy density.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, pytest contract test

---

### Task 1: Replace the economics content model

**Files:**
- Modify: `website/src/app/presentation/page.tsx`

**Step 1: Replace the current economics constants**

Remove or rewrite:

- `ECONOMICS_STACK`
- `SCALE_MATH`
- `PRICING_PLAN`

Add:

- executive proof-card data
- short implication bullets
- expandable scenario data

**Step 2: Keep the copy conclusion-first**

Ensure the visible economics layer states:

- cheap delivery cost
- favorable price positioning
- clear margin headroom

**Step 3: Keep the report detail inside one expandable block**

Include:

- cost assumptions summary
- four scenario rows/cards
- cached vs non-cached comparison
- premium model note

### Task 2: Refactor the economics section layout

**Files:**
- Modify: `website/src/app/presentation/page.tsx`

**Step 1: Simplify the section heading**

Use one clear takeaway headline and one short supporting sentence.

**Step 2: Build the visible section with three proof cards**

Each card should contain:

- one label
- one anchor number
- one short sentence only

**Step 3: Replace dense cards with one implication panel**

Limit this panel to three short bullets or short statements.

**Step 4: Build one expandable calculations panel**

Use semantic disclosure UI:

- `<details>`
- `<summary>`

The disclosure must stay readable on mobile and desktop.

### Task 3: Update contract expectations

**Files:**
- Modify: `tests/test_website_presentation_contract.py`

**Step 1: Remove stale copy expectations**

Update assertions that depend on the old economics wording.

**Step 2: Add assertions for the new economics framing**

Assert presence of:

- the new takeaway-style headline
- `$0.004` or equivalent blended cost language
- `$0.20`
- `$0.99`
- `Show calculations`
- `Gemini 2.5 Flash-Lite`
- `Gemini 3.1 Pro Preview`

### Task 4: Verify

**Files:**
- No code changes

**Step 1: Run build**

Run: `npm run build`
Workdir: `website`

Expected:

- build exits `0`

**Step 2: Run presentation contract test if available**

Run: `python3 -m pytest tests/test_website_presentation_contract.py -q`
Workdir: repository root

Expected:

- passing test if `pytest` is installed
- otherwise explicit environment failure noted

**Step 3: Review diff**

Run:

```bash
git diff -- website/src/app/presentation/page.tsx tests/test_website_presentation_contract.py docs/plans/2026-03-14-presentation-economics-expandable-design.md docs/plans/2026-03-14-presentation-economics-expandable-implementation.md
```

Expected:

- economics section is shorter and clearer
- calculations are hidden behind one expandable control

## Execution Mode

Proceed with subagent-driven execution in this session.
