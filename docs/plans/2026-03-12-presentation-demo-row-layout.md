# Presentation Demo Row Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the `/presentation` layout so the product chapter is more balanced and the two later demos share a single pre-competition row.

**Architecture:** Narrow the `What the product is` heading column, move the `Why now` content into a vertical side column within the product chapter, and replace the standalone mobile-proof section with a paired demo row before the competition chapter. Keep the first portrait demo in the hero.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, local card components

---

### Task 1: Recompose product and demo proof layout

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `website/src/app/presentation/page.tsx`

**Step 1: Write the failing test**

Manual expectation:
- The product chapter title column is narrower on desktop.
- `Why now` appears as a vertical side column to the right of the product points.
- The portrait mobile demo and landscape console demo share one row before `Competition`.
- The standalone `Mobile proof` section is removed.

**Step 2: Run test to verify it fails**

Inspect the current `website/src/app/presentation/page.tsx`.
Expected: `Why now` still spans horizontally inside the product content, and `Mobile proof` still exists as a separate section.

**Step 3: Write minimal implementation**

- Adjust the `#product` desktop grid to reduce the width of the heading column.
- Render product points and `Why now` in a desktop two-column content layout.
- Restore `Why now` to a vertical stack layout.
- Replace the pre-competition proof sections with a single desktop row:
  - left: portrait demo
  - right: landscape console demo
- Remove the standalone `Mobile proof` copy section.

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Next.js build passes and `/presentation` compiles.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-12-presentation-demo-row-layout.md website/src/app/presentation/page.tsx
git commit -m "feat(presentation): rebalance product and demo layout"
```
