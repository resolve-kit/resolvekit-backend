# Presentation Sticky Demo Rail Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the first two presentation demos stay visible in a sticky right-side rail while the product section scrolls on desktop, without changing mobile behavior.

**Architecture:** Keep the current `/presentation` content structure, but split the product section content into two desktop-only columns: a normal-flow insight column and a `position: sticky` demo rail. Preserve the existing stacked layout for mobile and tablet so the page remains predictable on smaller screens.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, local UI card components

---

### Task 1: Restructure the product section layout

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `website/src/app/presentation/page.tsx`

**Step 1: Write the failing test**

Manual layout expectation:
- On desktop, the two portrait demos are in a dedicated right rail.
- The right rail uses sticky positioning below the header.
- On mobile, the demos remain stacked inline below the product cards.

**Step 2: Run test to verify it fails**

Run: inspect the current `#product` section in `website/src/app/presentation/page.tsx`
Expected: the demos are inline below the cards and do not have a desktop sticky rail wrapper.

**Step 3: Write minimal implementation**

- Keep the existing mobile layout visible under `lg:hidden`.
- Add a desktop-only grid under `lg:grid` with:
  - left column for product insight cards
  - right column for the two portrait demos
- Apply `lg:sticky lg:top-28 lg:self-start` to the desktop demo rail wrapper.

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Next.js build passes and `/presentation` compiles.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-12-presentation-sticky-demo-rail.md website/src/app/presentation/page.tsx
git commit -m "feat(presentation): add sticky desktop demo rail"
```
