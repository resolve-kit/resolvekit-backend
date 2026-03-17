# Presentation Priority Sections Design

**Goal:** Recompose the presentation page so it works as a category brief that raises interest asynchronously and supports a live walkthrough, with the core memory being that the future is in-app resolution.

**Narrative:** The page should not read like a generic product landing page or explicitly mention investors. It should read like a confident category brief with product proof. The three chapters that carry the story are `What changes`, `Go-to-market`, and `Unit economics`.

## Audience And Page Job

- Primary job: create belief that in-app resolution is the next product surface.
- Secondary job: support a live walkthrough without forcing the presenter to compensate for weak structure.
- Constraint: keep product exits available, but they must not overpower the narrative.

## Design Direction

- Keep the current warm editorial palette and serif-led thesis voice.
- Reduce repeated card-grid composition so the page no longer feels templated after the hero.
- Give the three priority sections stronger contrast, clearer hierarchy, and faster comprehension.
- Preserve the overall single-page structure and current proof sections unless they conflict with the new hierarchy.

## Section Strategy

### 1. What changes

Turn this into the thesis chapter of the page.

- Replace the current “three gap cards + why now card” rhythm with a more directed argument.
- Present an old support model versus new support model contrast.
- Frame context, action, and operator control as outcomes of the new model rather than isolated product attributes.
- Make this section visually feel like the page’s first real proof of thought, not just another card group.

### 2. Go-to-market

Turn this into a wedge story instead of two adjacent content groups.

- Visually express the sequence from SDK install to workflow ownership to infrastructure standardization.
- Keep commercial motion, but subordinate it to the wedge.
- Reduce card repetition and make the adoption sequence readable in seconds.

### 3. Unit economics

Turn this into the clearest business-case section on the page.

- Lead with one dominant cost-versus-price frame.
- Keep supporting economics cards, but make them secondary.
- Move detailed calculation rows into a disclosure panel so the top-level message lands immediately.
- Preserve the report-backed assumptions and pricing benchmarks already on the page.

## Supporting Adjustments

- Demote or trim competing CTAs in the hero and sticky navigation.
- Keep proof, market, competition, and durability sections as support chapters.
- Maintain desktop and mobile readability, with special attention to reducing mobile scroll fatigue.
- Remove visibly unfinished demo framing if a demo block has no narrative label.

## Testing

- Update the presentation contract test to assert the new chapter markers and thesis phrases.
- Run the targeted presentation contract test after implementation.
- Run the website build if practical to verify the page still compiles after the layout rewrite.
