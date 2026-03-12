# Presentation Hero Demo Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recompose the `/presentation` page so one featured demo anchors the story near the top and the remaining demos act as smaller supporting proof points later in the page.

**Architecture:** Promote the landscape control-plane demo into a full-width hero proof block placed immediately after the opening thesis. Keep the product and go-to-market sections text-led, with the portrait demos appearing as supporting media blocks inside the flow instead of as a sticky rail.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, local card components

---

### Task 1: Recompose the presentation media hierarchy

**Files:**
- Modify: `website/src/app/presentation/page.tsx`
- Test: `website/src/app/presentation/page.tsx`

**Step 1: Write the failing test**

Manual expectation:
- The landscape console demo appears as the featured hero proof near the top.
- The product section no longer uses a desktop sticky demo rail.
- The two portrait demos appear as smaller supporting blocks inside later content.

**Step 2: Run test to verify it fails**

Inspect the current `website/src/app/presentation/page.tsx`.
Expected: the product section still contains the sticky desktop rail.

**Step 3: Write minimal implementation**

- Add a full-width featured demo block after the hero section using the landscape demo.
- Remove the sticky rail structure from the product section.
- Reintroduce the two portrait demos as standard cards inside the product section flow.
- Keep the go-to-market section focused on pricing and expansion without the landscape demo.

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Next.js build passes and `/presentation` compiles.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-12-presentation-hero-demo-layout.md website/src/app/presentation/page.tsx
git commit -m "feat(presentation): feature hero demo layout"
```
