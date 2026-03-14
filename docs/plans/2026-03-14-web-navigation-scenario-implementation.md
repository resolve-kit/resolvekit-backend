# Web Navigation Scenario Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the refund-resolution scenario with a medium-high-complexity guided web navigation scenario in the economics report and presentation.

**Architecture:** Keep the cost assumptions unchanged and swap only the scenario framing so the economics stay stable while the example aligns better with the web SDK product story. Update both the markdown report and the presentation proof layer to use the same scenario name and narrative.

**Tech Stack:** Markdown documentation, Next.js App Router, React Server Components, TypeScript

---

### Task 1: Replace the report scenario framing

**Files:**
- Modify: `docs/reports/2026-03-14-resolution-cost-scenarios.md`

**Step 1: Rename the scenario**

Change the scenario title from the refund workflow to a guided web navigation workflow.

**Step 2: Rewrite the business case and emulated flow**

Keep the scenario medium-high complexity:

- KB retrieval
- app-state understanding
- guided navigation into the right web app section
- confirmation that the user reached and completed the intended setting

**Step 3: Keep the cost numbers intact**

Do not change the modeled token or cost table.

### Task 2: Replace the presentation proof-layer scenario

**Files:**
- Modify: `website/src/app/presentation/page.tsx`

**Step 1: Rename the scenario card**

Change the scenario title in `ECONOMICS_SCENARIOS`.

**Step 2: Rewrite the flow summary**

Use web-SDK language:

- KB retrieval
- current section detection
- guided navigation
- setting completion

**Step 3: Preserve the scenario cost**

Leave the existing scenario cost values in place.

### Task 3: Verify

**Files:**
- No code changes

**Step 1: Run website build**

Run: `npm run build`
Workdir: `website`

Expected:

- build exits `0`

**Step 2: Spot-check the new wording**

Run:

```bash
rg -n "Refund request with approval|guided web navigation|Feature setup" docs/reports/2026-03-14-resolution-cost-scenarios.md website/src/app/presentation/page.tsx
```

Expected:

- old refund title removed
- new web-navigation scenario present in both files

## Execution Mode

Proceed in this session.
