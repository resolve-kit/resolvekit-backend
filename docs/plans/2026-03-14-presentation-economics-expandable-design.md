# Presentation Economics Expandable Design

Date: March 14, 2026

## Goal

Reshape the `Economics` section of the presentation into a clearer business-case slide that follows conclusion-first communication and keeps detailed calculations inside one optional expandable area.

## Problem

The current `Economics` section says too many things at once:

- pricing strategy
- scale math
- cost stack
- commercial positioning

That creates two issues:

1. The main message is diluted.
2. The detail competes with the conclusion instead of supporting it.

## Approved Direction

Use one executive-first economics section with one expandable proof layer.

Visible layer:

- headline states the conclusion
- three proof cards anchor the business case
- one short implication block explains why the economics matter

Expandable layer:

- one disclosure panel inside the same section
- scenario-based cost logic from the March 14 report
- cached vs non-cached comparison
- Flash-Lite vs premium-model comparison
- short methodology and assumption notes

## Communication Principles

This section should follow McKinsey-style communication:

- lead with the answer
- use numbers as proof, not decoration
- keep one message per block
- reduce text density
- make detailed evidence optional

## Proposed Content Structure

### 1. Section heading

Headline:

`The delivery cost is measured in cents. The value captured is much higher.`

Supporting text:

`ResolveKit is inexpensive to operate, which creates room to price below incumbents without weakening the business case.`

### 2. Three proof cards

- blended cached cost per resolved issue on Flash-Lite
- premium model cost multiple vs Flash-Lite
- suggested ResolveKit price vs incumbent benchmark

### 3. Business implication block

Three short points:

- cheap to deliver
- easier to price attractively
- strong margin headroom

### 4. Expandable calculations panel

Contains:

- what is included in the estimate
- four real scenarios from the report
- compact table or stacked cards for costs
- caching impact statement
- model note on `Gemini 3 Pro Preview` retirement and `Gemini 3.1 Pro Preview` use

## Scope

Files expected to change:

- `website/src/app/presentation/page.tsx`
- `tests/test_website_presentation_contract.py`

`website/src/app/presentation/nav.tsx` should only change if the visible label becomes unclear after the rewrite.

## Verification

- presentation contract test if runnable
- website build
- diff review for copy density and section clarity
