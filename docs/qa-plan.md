# Human QA Plan — Component Detection (v1)

## 1. Purpose

Human QA validates and calibrates component detection outputs by reviewing visual candidates produced by the pipeline. The goal is to assess precision/recall trade-offs, identify false positives/negatives, and generate actionable feedback for iterative hardening—without changing detectors during QA.

## 2. Scope (QA v1)

This QA round focuses on a limited, representative UK set to validate end‑to‑end behavior (API → proof runner → visual review) prior to scaling.

### 2.1 Pages

- Homepage (UK)
- 2–3 Vehicle Landing Pages (VLP)
- 2–3 Editorial / campaign pages

### 2.2 Component Types (v1)

All v1 component keys currently emitted by the API (e.g., hero, banner/promo_section, media_text_split, cards_section, image_carousel, card_carousel, icon_grid, info_specs, next_action_panel, anchor_nav, tabs, accordion).

## 3. Non-Goals

- No detector logic changes during QA
- No attempt to force Found == Expected
- No taxonomy expansion or renaming in this phase
- No UI/UX polish beyond what is required for review

## 4. Inputs

<!-- What QA operates on (detections.json, proof runner artifacts, screenshots) -->

## 5. QA Workflow

<!-- High-level flow, no UI details -->

### 5.1 Review Unit

<!-- What a single QA decision applies to -->

### 5.2 Decision Types

<!-- Correct / Incorrect / Unknown / Other -->

## 6. Output

<!-- What data is produced by QA -->

## 7. Rules & Principles

<!-- Guardrails (Found > 0 is OK, no hotfixing, etc.) -->

## 8. Iteration Loop

<!-- How QA feedback is fed back into detector improvements -->

## 9. Exit Criteria

<!-- When this QA phase is considered complete -->

## 10. Open Questions

<!-- Parked questions, explicitly not resolved yet -->
