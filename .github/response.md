# cu-tool — Operational Log

**⚠️ ANALYSIS FROZEN ⚠️**

This file tracks project status and documentation updates during tool hardening. No component rankings, usage statistics, or conclusions are valid until detector hardening and quality gates are complete.

**Authoritative documentation**: See [/docs](../docs) for v1 component model specifications and implementation plan.

**Historical pre-hardening analysis**: Archived at [analysis/archive/uk-prehardening-report.md](../analysis/archive/uk-prehardening-report.md) (not valid for conclusions).

---

## Dataset Scope

**Market**: UK (Nissan)  
**Eligible URLs**: 8,468 (fetched, deduplicated, HTML present)  
**Status**: Tool hardening in progress (Phase 1-3)

Analysis is frozen until visual proof QA validates detectors and quality gates pass.

---

## Documentation Updates

### v1 Component Model Alignment (2026-01-20)

**8 documentation files updated** to remove legacy references and ensure 100% alignment with v1 11-component model:

1. [docs/plan.md](../docs/plan.md) — Removed duplicated Decision Lock section, updated component taxonomy references
2. [docs/methodology.md](../docs/methodology.md) — Replaced "Six component types" with "Eleven component types (v1 model)", added critical rules
3. [docs/DECISIONS.md](../docs/DECISIONS.md) — Updated QA dropdown to list all 11 v1 types, added variant fields
4. [docs/visual-proof/runner.md](../docs/visual-proof/runner.md) — Expanded component-to-selector mapping table (6→11 types), fixed accordion selector
5. [docs/visual-proof/quality-gates.md](../docs/visual-proof/quality-gates.md) — Updated to impact-class model (Class A/B/C)
6. [docs/visual-proof/qa-ui.md](../docs/visual-proof/qa-ui.md) — Added 8 critical operator guidelines
7. [docs/visual-proof/overview.md](../docs/visual-proof/overview.md) — Updated task count to 42 tasks, 3 quality gate classes
8. [docs/visual-proof/data-contracts.md](../docs/visual-proof/data-contracts.md) — Removed CTA-specific field, confirmed v1 variant schema

**Verification**: Zero hero_cta references remain in /docs except one clearly marked historical changelog entry.

### Decision Lock Confirmation (2026-01-20)

**10+ files updated** to convert open questions to confirmed architectural decisions:

- Proof page selection: 5 pages (2 VLP + 3 Editorial), expandable during QA
- Locator strategy: Hybrid (ARIA roles + HTML5 semantic primary, class patterns secondary)
- QA operator interaction: Fixed component type dropdown (11 v1 types) + variant fields
- Quality gate thresholds: Impact-class based (Class A: 90%, Class B: 85%, Class C: 80%), minimum sample size ≥10
- Component model: v1 11-type model with critical rules (hero vs promo, nested carousel exclusion, modal baseline exclusion)
- Modal exclusion: Baseline detections ignore modals; modal analysis deferred to v2

See [docs/DECISIONS.md](../docs/DECISIONS.md) for full rationale.

---

## v1 Component Model (11 Types)

**Authoritative list** (see [docs/methodology.md](../docs/methodology.md) for definitions):

1. hero
2. promo_section
3. media_text_split
4. info_specs
5. next_action_panel
6. image_carousel
7. card_carousel
8. cards_section
9. accordion
10. tabs
11. anchor_nav

**Critical rules**:

- Hero vs promo: Position-based (top-of-page ONLY = hero; hero-like blocks NOT at top = promo_section)
- Nested carousel: No double-counting (carousel inside media_text_split = media_text_split with variant)
- Modal exclusion: Baseline detections ignore `[role="dialog"]`, `[aria-modal="true"]`

---

## Quality Gates (Impact-Class Model)

**Class A** (accordion, cards_section): 90% threshold — Highest corruption risk  
**Class B** (image_carousel, card_carousel): 85% threshold — Split logic complexity  
**Class C** (remaining 7 types): 80% threshold — Lower risk

**Minimum sample size**: ≥10 per component type to enforce threshold

See [docs/visual-proof/quality-gates.md](../docs/visual-proof/quality-gates.md) for full specification.

---

## Project Documentation Structure

**Core documentation**:

- [docs/plan.md](../docs/plan.md) — 7-phase implementation plan (42 tasks)
- [docs/tracker.md](../docs/tracker.md) — Task tracker (3 sprints, 3 quality gate classes)
- [docs/methodology.md](../docs/methodology.md) — Analysis methodology (eligibility, taxonomy, denominators)
- [docs/DECISIONS.md](../docs/DECISIONS.md) — Architectural decisions summary

**Visual proof pack documentation**:

- [docs/visual-proof/overview.md](../docs/visual-proof/overview.md) — Workflow, inputs/outputs
- [docs/visual-proof/data-contracts.md](../docs/visual-proof/data-contracts.md) — JSON schemas (detections, manifest, labels)
- [docs/visual-proof/runner.md](../docs/visual-proof/runner.md) — Locator strategy, bbox computation, modal exclusion
- [docs/visual-proof/qa-ui.md](../docs/visual-proof/qa-ui.md) — Human labeling workflow, operator guidelines
- [docs/visual-proof/quality-gates.md](../docs/visual-proof/quality-gates.md) — Thresholds, sample size rules

---

## Current Status

**Phase**: Tool Hardening (Phase 1-3 in progress)  
**Status**: Documentation complete, ready for Sprint 1 implementation

**Next step**: TH-01 — Create JSON export script (`analysis/scripts/export-detections.ts`) to export detections from `david_component_usage` table for 5 proof pages.

**Blocked**: Component usage analysis, rankings, and conclusions until detector hardening and quality gates complete.

---

## Document Purpose

This file serves as an operational log during tool hardening. It tracks:

- Documentation updates and architectural decisions
- Project status and phase progression
- Links to authoritative documentation

It does NOT contain:

- Component usage statistics or rankings (frozen until quality gates pass)
- Analysis conclusions or recommendations (invalid pre-hardening)
- SQL queries or data interpretations (Phase 7 deliverable)

**For current project status**: See [docs/tracker.md](../docs/tracker.md)  
**For implementation plan**: See [docs/plan.md](../docs/plan.md)  
**For v1 component model**: See [docs/methodology.md](../docs/methodology.md)
