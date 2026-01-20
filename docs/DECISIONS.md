# Architectural Decisions — Tool Hardening + Visual Proof + Human QA

**Date**: 2026-01-20  
**Context**: Pre-Sprint 1 decision lock (before implementation begins)  
**Status**: ✅ All decisions confirmed and documented (updated for v1 component model)

This document summarizes the key architectural decisions for the Tool Hardening + Visual Proof + Human QA workstream. These decisions are **locked** and implementation may proceed without further clarification.

Full details available in [docs/plan.md](./plan.md) — "Confirmed Architectural Decisions" section.

**v1 Component Model**: 11 component types (hero, promo_section, media_text_split, info_specs, next_action_panel, image_carousel, card_carousel, cards_section, accordion, tabs, anchor_nav)

---

## 1. Proof Page Selection

**Decision**: Start with **5 pages** (2 VLP + 3 Editorial) as the initial proof pack. Pages may be expanded during QA if needed. No expansion is required before Sprint 1.

**Rationale**:

- Goal is detector **correctness**, not coverage
- QA-driven expansion is cheaper and more targeted than pre-selecting additional pages
- If QA reveals systematic issues on specific page types, we can add 2-3 representative pages iteratively

**Impact**:

- Phase 2 (Proof Runner): 5 URLs to process
- Phase 5 (QA UI): ~50-150 detections to label (estimated)

---

## 2. Locator Strategy Robustness

**Decision**: Use a **hybrid locator strategy** combining structural selectors (ARIA roles, DOM hierarchy) with class-based patterns. Do NOT rely on data-\* attributes as a hard dependency.

**Rationale**:

- Class names may change between POC and production (CSS refactoring, framework upgrades)
- ARIA roles and structural signals (header, nav, footer, section) are more stable
- data-\* attributes are not guaranteed to exist across all markets or page types

**Locator Hierarchy**:

1. **Primary**: ARIA roles (`[role="tablist"]`, `[role="contentinfo"]`) + HTML5 semantic elements
2. **Secondary**: Class prefixes / patterns (`[class*="swiper"]`, `[class*="accordion"]`)
3. **Tertiary**: data-\* attributes (optional signal, fallback only)

**Impact**:

- Phase 2 (Proof Runner): Implement hybrid locator strategy in runner script
- Phase 3 (Data Contracts): Document locator hierarchy in `docs/visual-proof/runner.md`
- Risk: If locator fails, log warning and continue (do NOT abort)

---

## 3. QA Operator Interaction Model

**Decision**: Operator selects from a **fixed list of component types** (dropdown or keyboard shortcuts). Include an "Other / Incorrect detection" option with optional short text field for edge cases.

**Rationale**:

- Reduces cognitive load (no free-text recall, faster labeling)
- Keeps labeling consistent across operator sessions
- Still allows edge-case clarification when needed

**UI Specification**:

- **Primary action**: Operator confirms component type from fixed list (11 v1 types):
  - `c` → Confirm as detected type
  - `w` → Wrong (operator selects correct type from dropdown: hero, promo_section, media_text_split, info_specs, next_action_panel, image_carousel, card_carousel, cards_section, accordion, tabs, anchor_nav, "None / False positive", "Other")
  - `s` → Skip (uncertain, no label recorded)
  - `n` → Next (no label, advance)
- **Variant fields** (when applicable):
  - If correcting to media_text_split: dropdown for media_type (image|video|carousel)
  - If correcting to cards_section or card_carousel: dropdown for card_type (model_grade|accessory|offer|generic)
- **Secondary action**: If operator selects "Other", optional text field appears (max 100 chars)

**Impact**:

- Phase 5 (QA UI): Implement component selection dropdown (TH-22)
- Phase 5 (QA UI): Update `labels.jsonl` schema to include `correct_type` and `note` fields
- Data contract: [docs/visual-proof/data-contracts.md](./visual-proof/data-contracts.md) — Labels Schema

---

## 4. Gate Threshold Tuning

**Decision**: Keep the proposed thresholds (90%/85%/80%/75%) as **initial quality gates**. Treat them as detector precision targets, not business KPIs. Thresholds may be tuned AFTER first QA pass based on empirical data.

**Rationale**:

- **These measure detector precision**, not business importance. A component can be business-critical but tolerate 80% precision if false positives are easily identifiable.
- **Higher-volume components tolerate slightly lower precision initially**. Carousels (high volume, high visibility) get stricter thresholds (90%). Accordions (high volume, footer inflation known) get looser thresholds (75%).
- **Goal is to block clearly broken detectors**, not to over-optimize early. An 85% card_carousel detector is good enough to proceed; a 60% detector is not.

**Threshold Rationale by Component**:

- **Image carousel (90%)**: High visibility (hero sections, galleries), false positives erode trust
- **Card carousel (85%)**: Common on Editorial pages, slightly subjective (card vs image classification)
- **Hero CTA + tabs (80%)**: Lower volume, less critical, combined gate reduces QA burden
- **Accordion + cards_section (75%)**: Highest volume (accordion footer inflation), most subjective (≥3 cards threshold)

**Adjustability**: After first QA run, if a component fails gate by <5% (e.g., 83% vs 85% threshold), team may:

1. Accept threshold miss if false positives are low-impact (document decision)
2. Lower threshold by 5% (e.g., 85% → 80%) and re-run QA on that component only
3. Fix detector and re-run full QA (preferred)

**Impact**:

- Phase 6 (Regression Harness): Implement 4 gates with initial thresholds (TH-27 to TH-30)
- Phase 6 (Gate Validation): Include threshold adjustment decision step if gates fail
- Documentation: [docs/visual-proof/quality-gates.md](./visual-proof/quality-gates.md)

---

## 5. Component Model & Detector Hardening Scope

**Decision**: **ALL 11 component types (v1 model) are in scope**. Prioritization is execution order only, not exclusion.

**v1 Component Model** (11 types):

1. **hero** — Primary page-entry hero at top ONLY
2. **promo_section** — Campaign/banner sections, hero-like blocks NOT at top
3. **media_text_split** — 2-column layout (media + text); variant: media_type (image|video|carousel)
4. **info_specs** — Key facts strip (3–6 spec items)
5. **next_action_panel** — Conversion CTA hub (3–6 actions)
6. **image_carousel** — Standalone image-first carousel (NOT inside media_text_split)
7. **card_carousel** — Standalone card carousel (NOT inside media_text_split)
8. **cards_section** — Static section with ≥3 cards; variant: card_type (model_grade|accessory|offer|generic)
9. **accordion** — Collapsible content (footer-excluded)
10. **tabs** — role=tablist (mega-nav excluded)
11. **anchor_nav** — In-page navigation (content flow only)

**Critical Rules**:

- **Hero vs promo**: ONLY top-of-page hero is `hero`. Hero-like blocks lower in page are `promo_section` or `media_text_split`.
- **Media_text_split nested carousel no-double-count**: If carousel exists within media_text_split, classify as media_text_split with media_type=carousel (NOT standalone carousel).
- **Cards_section vs AEM grid**: cards_section is CONTAINER with ≥3 cards, NOT AEM layout grids.
- **Modal/popup exclusion**: Baseline detections IGNORE modals ([role="dialog"], [aria-modal="true"]). Modal analysis is v2 track.

**Execution Order** (hardening sequence by corruption risk):

1. accordion (highest corruption risk: footer chrome leakage)
2. cards_section (AEM grid confusion, footer link sections)
3. image_carousel (hero sections, footer carousels)
4. card_carousel (split logic complexity)
5. hero (top-of-page only)
6. promo_section (hero-like blocks in content flow)
7. media_text_split (nested carousel no-double-count)
8. tabs (mega-nav exclusion)
9. info_specs (spec strip detection)
10. next_action_panel (CTA hub detection)
11. anchor_nav (in-page navigation)

**Rationale**:

- Accordion and cards_section produce highest false-positive risk (footer inflation, AEM grid confusion)
- Hero vs promo distinction prevents misclassification
- Media_text_split nested carousel rule prevents double counting
- Modal exclusion prevents interaction-dependent content in baseline

**Impact**:

- Phase 4 (Detector Hardening): All 11 component types + modal exclusions (TH-14 to TH-25)
- Task count: Sprint 2 increases to 19 tasks (detector hardening + QA UI)
- Documentation: [docs/tracker.md](./tracker.md) — Sprint 2 tasks updated

---

## Decision Lock

**Status**: ✅ All architectural decisions confirmed and documented (v1 component model).

**Ready to proceed**: Phase 1 (JSON Export) can start without further clarification.

**Next Step**: Begin Sprint 1 implementation — TH-01 (Create export script `analysis/scripts/export-detections.ts`).

---

## Change Log

| Date       | Section | Change                                                                 |
| ---------- | ------- | ---------------------------------------------------------------------- |
| 2026-01-20 | All     | Initial decision lock (pre-Sprint 1)                                   |
| 2026-01-20 | 3       | Added component selection dropdown spec                                |
| 2026-01-20 | 4       | Added threshold adjustability rules                                    |
| 2026-01-20 | 5       | Updated to v1 11-component model (removed hero_cta, added 6 new types) |
| 2026-01-20 | All     | Added modal exclusion policy, hero vs promo rule, nested carousel rule |
