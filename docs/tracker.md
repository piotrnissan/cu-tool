# Tool Hardening + Visual Proof + Human QA — Task Tracker

**Status Legend**: ☐ Todo | 🔄 Doing | ✅ Done

---

## Sprint 1: JSON Export + Proof Runner + Data Contracts (S/M, 2-3 days)

### Phase 1: JSON Export

- ✅ **TH-01**: Create export script `analysis/scripts/export-detections.ts` (Size: S, Risk: Low) — Done 2026-01-20
- ✅ **TH-02**: Generate `detections.json` for proof pack pages (pipeline verification only; data quality and detector accuracy out of scope) (Size: S, Risk: Low) — Done 2026-01-20
- ✅ **TH-03**: Validate JSON export (pipeline verification only; data quality and detector accuracy out of scope) (Size: S, Risk: Low) — Done 2026-01-20

### Phase 2: Proof Runner (Live)

- ✅ **TH-04**: Create `analysis/visual-proof/runner/run.ts` (comprehensive implementation) (Size: M, Risk: Medium) — Done 2026-01-20
- ✅ **TH-05**: Implement locator strategy for each component type (Size: L, Risk: High) — Done 2026-01-20 (integrated in TH-04; pipeline implemented, accuracy not yet validated)
- ✅ **TH-06**: Implement global chrome exclusion filter (Size: M, Risk: Medium) — Done 2026-01-20 (integrated in TH-04; pipeline implemented, accuracy not yet validated)
- ✅ **TH-07**: Implement bbox computation (Size: M, Risk: Medium) — Done 2026-01-20 (integrated in TH-04; pipeline implemented, accuracy not yet validated)
- ✅ **TH-08**: Implement overlay injection (Size: M, Risk: Low) — Done 2026-01-20 (integrated in TH-04; pipeline implemented, accuracy not yet validated)
- ✅ **TH-09**: Capture annotated screenshots (Size: S, Risk: Low) — Done 2026-01-20 (integrated in TH-04; pipeline implemented, accuracy not yet validated)
- ✅ **TH-10**: Generate manifest JSON (Size: M, Risk: Low) — Done 2026-01-20 (integrated in TH-04; pipeline implemented, accuracy not yet validated)
- ✅ **TH-11**: Test runner on single page (Juke VLP) (Size: M, Risk: Medium) — Done 2026-01-20 (validated runner execution on 3 pages: juke, ariya, electric-vehicles)

### Phase 3: Data Contracts & Documentation

- ✅ **TH-12**: Document locator strategy in `docs/visual-proof/runner.md` (Size: M, Risk: Low) — Verified 2026-01-21 (docs complete; accuracy validated later)
- ✅ **TH-13**: Define JSON contracts in `docs/visual-proof/data-contracts.md` (Size: M, Risk: Low) — Verified 2026-01-21 (contracts complete; export/QA will enforce)

---

## Sprint 2: Detector Hardening + Human QA UI (M/L, 3-4 days)

### Phase 4: Detector Hardening

**Execution Order**: All 11 component types (v1 model) in priority sequence by corruption risk

- ✅ **TH-14**: Harden cards_section detector — exclude support/owners teasers; cards_section = product/offers only (intent filter) (Size: M, Risk: Medium) — Done 2026-01-21
- ✅ **TH-14.1**: Verify global chrome + modal exclusions across all detectors (audit-only; no code changes required) — Verified 2026-01-21
- ✅ **TH-15**: Implement hero vs promo rule (top-of-page hero only) (Size: M, Risk: Medium)
- ✅ **TH-16**: Implement media_text_split with media_type variants (image|video|carousel) + nested carousel no-double-count (Size: L, Risk: High)
- ✅ **TH-17**: Implement carousel split logic (image_carousel vs card_carousel) (Size: M, Risk: High) — Done 2026-01-22
- ✅ **TH-18**: Harden cards_section detector (≥3 cards, exclude footer, ignore AEM grids, add card_type classification) (Size: L, Risk: High) — Done 2026-01-22
- ✅ **TH-19**: Fix accordion footer inflation (exclude [role="contentinfo"]) (Size: M, Risk: Medium) — Done 2026-01-22
- ✅ **TH-20**: Harden tabs detector (verify ARIA role filtering, exclude mega-nav) (Size: S, Risk: Low) — Done 2026-01-22
- ✅ **TH-21**: Implement info_specs detector (3–6 spec items, value+label pairs) (Size: M, Risk: Medium) — Done 2026-01-22
- ✅ **TH-22**: Implement next_action_panel detector (full-width section; supports both icon tiles and large button rows) (Size: M, Risk: Medium) — Done 2026-01-22
- ✅ **TH-23**: Implement anchor_nav detector (in-page navigation, content flow only) (Size: M, Risk: Low) — Done 2026-01-22
- ✅ **TH-24**: Make david-components analysis deterministic for proof pack by supporting `url_ids` and scoped reset (Size: M, Risk: Medium) — Done 2026-01-22
- ✅ **TH-25**: Re-run hardened detectors on proof pack + verify outputs (Size: S, Risk: Low)

### Phase 5: Human QA UI

- ✅ **TH-26**: Create `/web/app/qa/page.tsx` skeleton (Size: M, Risk: Low) — Done 2026-01-23
- ✅ **TH-27**: Implement keyboard shortcuts + component selection dropdown (11 v1 types + "None" + "Other") (Size: M, Risk: Medium) — Done 2026-01-23
- ✅ **TH-28**: Implement variant field dropdowns (media_type for media_text_split, card_type for cards_section/card_carousel) (Size: M, Risk: Medium) - Done 2026-01-26
- ✅ **TH-29**: Implement label appending to JSONL (with corrected_component_key, media_type, card_type, note fields) (Size: M, Risk: Medium) - Done 2026-01-26
- ✅ **TH-30**: Implement auto-advance to next detection (Size: S, Risk: Low) - Done 2026-01-26
- ✅ **TH-31**: Test QA UI with 1-2 pages (Size: M, Risk: Medium) - Typed mock detections, auto-advance, keyboard-first compact QA UI - Done 2026-01-26
- ✅ **TH-32.1**: QA UI: 2-column layout + preview placeholder (Size: S, Risk: Low) - Refactor QA UI to a fixed-width left column (no vertical scroll) and a right-side Preview panel with placeholder for screenshot rendering. This task prepares the UI for TH-33. - Done 2026-01-26
- ✅ **TH-32**: Document QA UI in `docs/visual-proof/qa-ui.md` (Size: S, Risk: Low) — Done 2026-01-26
- ☐ **TH-32.2**: Load real detection instances from proof-pack manifests (Size: M, Risk: Medium) — Replace typed mock detections in QA UI with a real queue built from manifest.json files under analysis/artifacts/visual-proof/full/\*\*. Each queue item must include: slug, page_url, component_key, bbox, and a deterministic detection_id.
- ☐ **TH-32.3**: Implement QA preview (annotated screenshot + bbox highlight) (Size: M, Risk: Medium) — Right column renders the annotated full-page screenshot and visually highlights the current bbox instance from the queue. MVP: image render + bbox rectangle; scroll-to-bbox optional.
- ☐ **TH-32.4**: Generate first real QA labels.jsonl for v1-uk proof pack (Size: QA, Risk: Medium) — Perform a manual QA pass using /qa and produce analysis/qa-results/v1-uk/labels.jsonl with real decisions (correct/wrong/false_positive/etc). Target: ≥50 scored labels total (scored = correct + wrong_type + false_positive), or ≥10 scored per Class A component.
- ☐ **TH-32.5**: Phase 5 DoD check (labels.jsonl readiness) (Size: S, Risk: Low) — Confirm labels.jsonl exists, is non-empty, and each line contains: timestamp, detection_id, page_url, component_key, decision.

---

## Sprint 3: Regression Harness + Return to Analysis (M, 2-3 days)

### Phase 6: Regression Harness

**Phase 6 starts only after Phase 5 DoD (TH-32.5).**

- ☐ **TH-33**: Create `analysis/scripts/regression-check.ts` (Size: M, Risk: Low)
- ☐ **TH-34**: Define impact-class quality gates (Class A: 90%, Class B: 85%, Class C: 80%) + minimum sample size rule (≥10 labels) (Size: M, Risk: Low)
- ☐ **TH-35**: Generate regression report (precision per component + pass/fail/insufficient) (Size: M, Risk: Low)
- ☐ **TH-36**: Implement gate validator with sample size check (Size: S, Risk: Low)
- ☐ **TH-37**: Document gates in `docs/visual-proof/quality-gates.md` (Size: S, Risk: Low)

### Phase 7: Return to UK Analysis

- ☐ **TH-38**: Verify all quality gates pass (or insufficient sample for low-volume components) (Size: S, Risk: Critical)
- ☐ **TH-39**: Reset UK dataset in `david_component_usage` (Size: S, Risk: High)
- ☐ **TH-40**: Run full UK analysis with hardened detectors (Size: XL, Risk: High)
- ☐ **TH-41**: Generate final analysis reports (Size: M, Risk: Low)
- ☐ **TH-42**: Update `.github/response.md` with post-gate results (Size: M, Risk: Low)

---

## Quality Gates (explicit tasks)

- ☐ **QG-01**: Class A Pass (accordion ≥ 90%, cards_section ≥ 90%) (Size: QA, Risk: High)
- ☐ **QG-02**: Class B Pass (image_carousel ≥ 85%, card_carousel ≥ 85%) (Size: QA, Risk: High)
- ☐ **QG-03**: Class C Pass (hero, media_text_split, promo_section, info_specs, next_action_panel, tabs, anchor_nav ≥ 80%) (Size: QA, Risk: Medium)

---

## Summary

**Total tasks**: 46 (+ 3 quality gate classes)
**Sprints**: 3
**Current status**: Sprint 1 complete (TH-01 to TH-13), Sprint 2 Phase 4 complete (TH-14 to TH-25), Sprint 2 Phase 5 in progress (TH-26 to TH-32.5)
**Next step**: TH-32.2

- Sprint 1: TH-01 to TH-13 (13 tasks, S/M risk, 2-3 days)
- Sprint 2: TH-14 to TH-32.5 (23 tasks, M/L risk, 4-5 days)
- Sprint 3: TH-33 to TH-42 (10 tasks, M risk, 2-3 days)

---

## Backlog (Post-POC / Future Enhancements)

- ☐ **TH-01.1**: Optional: backfill `final_url`/`canonical_url` for fetched rows where NULL to enable redirect-based resolution in proof pack export (Size: S, Risk: Low)
