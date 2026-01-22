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

-### Phase 4: Detector Hardening

**Execution Order**: All 11 component types (v1 model) in priority sequence by corruption risk

- ✅ **TH-14**: Harden cards_section detector — exclude support/owners teasers; cards_section = product/offers only (intent filter) (Size: M, Risk: Medium) — Done 2026-01-21
- ✅ **TH-14.1**: Verify global chrome + modal exclusions across all detectors (audit-only; no code changes required) — Verified 2026-01-21
- ✅ **TH-15**: Implement hero vs promo rule (top-of-page hero only) (Size: M, Risk: Medium)
- ✅ **TH-16**: Implement media_text_split with media_type variants (image|video|carousel) + nested carousel no-double-count (Size: L, Risk: High)
- ✅ **TH-17**: Implement carousel split logic (image_carousel vs card_carousel) (Size: M, Risk: High) — Done 2026-01-22
- ✅ **TH-18**: Harden cards_section detector (≥3 cards, exclude footer, ignore AEM grids, add card_type classification) (Size: L, Risk: High) — Done 2026-01-22
- ✅ **TH-19**: Fix accordion footer inflation (exclude [role="contentinfo"]) (Size: M, Risk: Medium) — Done 2026-01-22
- [ ] **TH-20**: Harden tabs detector (verify ARIA role filtering, exclude mega-nav) (Size: S, Risk: Low)
- [ ] **TH-21**: Implement info_specs detector (3–6 spec items, value+label pairs) (Size: M, Risk: Medium)
- [ ] **TH-22**: Implement next_action_panel detector (3–6 actions, icon+label+link) (Size: M, Risk: Medium)
- [ ] **TH-23**: Implement anchor_nav detector (in-page navigation, content flow only) (Size: M, Risk: Low)
- [ ] **TH-24**: Run hardened detectors on 5 proof pages (all 11 types) (Size: M, Risk: Medium)
- [ ] **TH-25**: Re-export detections.json with hardened detectors (Size: S, Risk: Low)

### Phase 5: Human QA UI

- [ ] **TH-26**: Create `/web/app/qa/page.tsx` skeleton (Size: M, Risk: Low)
- [ ] **TH-27**: Implement keyboard shortcuts + component selection dropdown (11 v1 types + "None" + "Other") (Size: M, Risk: Medium)
- [ ] **TH-28**: Implement variant field dropdowns (media_type for media_text_split, card_type for cards_section/card_carousel) (Size: M, Risk: Medium)
- [ ] **TH-29**: Implement label appending to JSONL (with corrected_component_key, media_type, card_type, note fields) (Size: M, Risk: Medium)
- [ ] **TH-30**: Implement auto-advance to next detection (Size: S, Risk: Low)
- [ ] **TH-31**: Test QA UI with 1-2 pages (Size: M, Risk: Medium)
- [ ] **TH-32**: Document QA UI in `docs/visual-proof/qa-ui.md` (Size: S, Risk: Low)

---

## Sprint 3: Regression Harness + Return to Analysis (M, 2-3 days)

### Phase 6: Regression Harness

- [ ] **TH-33**: Create `analysis/scripts/regression-check.ts` (Size: M, Risk: Low)
- [ ] **TH-34**: Define impact-class quality gates (Class A: 90%, Class B: 85%, Class C: 80%) + minimum sample size rule (≥10 labels) (Size: M, Risk: Low)
- [ ] **TH-35**: Generate regression report (precision per component + pass/fail/insufficient) (Size: M, Risk: Low)
- [ ] **TH-36**: Implement gate validator with sample size check (Size: S, Risk: Low)
- [ ] **TH-37**: Document gates in `docs/visual-proof/quality-gates.md` (Size: S, Risk: Low)

### Phase 7: Return to UK Analysis

- [ ] **TH-38**: Verify all quality gates pass (or insufficient sample for low-volume components) (Size: S, Risk: Critical)
- [ ] **TH-39**: Reset UK dataset in `david_component_usage` (Size: S, Risk: High)
- [ ] **TH-40**: Run full UK analysis with hardened detectors (Size: XL, Risk: High)
- [ ] **TH-41**: Generate final analysis reports (Size: M, Risk: Low)
- [ ] **TH-42**: Update `.github/response.md` with post-gate results (Size: M, Risk: Low)

---

## Quality Gates (explicit tasks)

- [ ] **QG-01**: Class A Pass (accordion ≥ 90%, cards_section ≥ 90%) (Size: QA, Risk: High)
- [ ] **QG-02**: Class B Pass (image_carousel ≥ 85%, card_carousel ≥ 85%) (Size: QA, Risk: High)
- [ ] **QG-03**: Class C Pass (hero, media_text_split, promo_section, info_specs, next_action_panel, tabs, anchor_nav ≥ 80%) (Size: QA, Risk: Medium)

---

## Summary

**Total tasks**: 42 (+ 3 quality gate classes)
**Sprints**: 3
**Next step**: TH-19 (fix accordion footer inflation)

- Sprint 1: TH-01 to TH-13 (13 tasks, S/M risk, 2-3 days)
- Sprint 2: TH-14 to TH-32 (19 tasks, M/L risk, 4-5 days)
- Sprint 3: TH-33 to TH-42 (10 tasks, M risk, 2-3 days)

**Current status**: Sprint 1 complete (TH-01 to TH-13), Sprint 2 ready to start
**Next step**: TH-20 (Harden tabs detector (verify ARIA role filtering, exclude mega-nav))

---

## Backlog (Post-POC / Future Enhancements)

- [ ] **TH-01.1**: Optional: backfill `final_url`/`canonical_url` for fetched rows where NULL to enable redirect-based resolution in proof pack export (Size: S, Risk: Low)
