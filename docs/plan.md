# Tool Hardening + Visual Proof + Human QA — Implementation Plan

**Objective**: Harden component detectors through visual proof validation and human QA before returning to full UK market analysis.

**Scope**: UK market only, 5 proof pages (2 VLP + 3 Editorial), 11 component types (v1 model).

**Component Types (v1)**:

- **hero** (primary page-entry hero only)
- **promo_section** (campaign/banner sections, hero-like blocks not at top)
- **media_text_split** (2-column layout with media + text; media_type: image|video|carousel)
- **info_specs** (key facts strip, 3–6 spec items)
- **next_action_panel** (conversion CTA hub, 3–6 actions)
- **image_carousel** (standalone image-first carousel)
- **card_carousel** (standalone card carousel)
- **cards_section** (static section with ≥3 cards; card_type classification: model_grade|accessory|offer|generic)
- **accordion** (collapsible content, footer-excluded)
- **tabs** (role=tablist, mega-nav excluded)
- **anchor_nav** (in-page navigation)

**Strategy**: Export DB detections → render live overlays → human labels → precision gates → detector fixes → regression tests → return to analysis.

---

## Non-Goals

- **No multi-user QA**: Single operator, local file system only
- **No modal/popup analysis**: Modals ([role="dialog"], [aria-modal="true"]) excluded from detection and proof overlays (v1 baseline only; v2 track can add modal analysis with scripted interactions)
- **No ML training**: Labels are for validation only, not model training
- **No real-time monitoring**: Single snapshot analysis, no live dashboards
- **No visual regression testing**: Screenshots for human QA only, not automated comparison

---

## Resource Constraints

- **Pages**: 5 total (2 VLP + 3 Editorial)
- **Components**: 11 types (v1 model: hero, promo_section, media_text_split, info_specs, next_action_panel, image_carousel, card_carousel, cards_section, accordion, tabs, anchor_nav)
- **Labels required**: ~20–40 per component type (estimate: 250–400 total labels)
- **Timeline**: 3 sprints (S/M, M/L, M duration) before returning to full analysis
- **QA operator**: 1 person, ~3–5 hours labeling time

---

## Phase 1: JSON Export (DB → detections.json)

**Objective**: Export structured component detections from `david_component_usage` for proof pack pages.

**Tasks**:

- Create export script reading from `david_component_usage` + `url_inventory`
- Output format: `detections.json` with per-URL, per-component-instance records
- Include: component_key, instance_count, evidence (parsed), url, market
- Filter to 5 proof pages only (pages.vlp.txt + pages.editorial.txt)
- Store in `analysis/artifacts/visual-proof/detections.json`

**Outputs**:

- `analysis/artifacts/visual-proof/detections.json`
- Schema documented in `docs/visual-proof/data-contracts.md`

**Acceptance Criteria**:

- JSON contains exactly 5 URLs (2 VLP + 3 Editorial)
- Each URL has array of component instances with parsed evidence fields
- Evidence includes: item counts, selector hints, control presence
- File size < 50KB (proof pack only, not full dataset)
- No DB credentials or sensitive data in JSON

---

## Phase 2: Proof Runner (Live) — Overlay Rendering from JSON

**Objective**: Render bounding box overlays on live pages using detections from JSON (no heuristic detection in runner).

**Tasks**:

- Create `analysis/visual-proof/runner/full.ts` (Playwright-based)
- Load detections from `detections.json`
- For each URL:
  - Launch browser, navigate to live URL
  - Dismiss cookie overlay (best-effort)
  - For each detection in JSON:
    - Query DOM using component-specific locator strategy
    - Compute bounding boxes (document coordinates)
    - Inject colored overlay divs with labels
  - Capture annotated screenshot
  - Generate manifest JSON with bbox coordinates + locators used
- Store outputs in `analysis/artifacts/visual-proof/full/<slug>/`

**Outputs**:

- `<slug>.annotated.png` (screenshot with overlays)
- `<slug>.manifest.json` (bbox coordinates, locators, metadata)
- Execution log with success/failure per URL

**Acceptance Criteria**:

- All 5 pages have annotated screenshots
- Overlays use distinct colors per component type
- Manifest includes: component_key, bbox {x,y,width,height}, locator, note
- No overlays on global chrome (header/nav/footer)
- Bbox coordinates are positive document-based (not viewport-relative)
- Runner completes in < 5 minutes for 5 pages

---

## Phase 3: Locator Strategy & Data Contracts

**Objective**: Define component-to-DOM mapping rules and JSON schemas.

**Tasks**:

- Document locator strategy for each component type in `docs/visual-proof/runner.md`
- Define detection-to-locator mapping (evidence → querySelectorAll pattern)
- Specify global chrome exclusion rules (header, nav, footer, dialogs, OneTrust)
- Document visibility validation thresholds (min height/width, y-range)
- Finalize JSON contracts in `docs/visual-proof/data-contracts.md`

**Outputs**:

- `docs/visual-proof/data-contracts.md` (3 schemas: detections, manifest, labels)
- `docs/visual-proof/runner.md` (locator mapping table, exclusion rules)

**Acceptance Criteria**:

- Each component type has documented CSS selector pattern
- Global chrome exclusions are explicit (6+ selectors)
- Contracts include field types, constraints, examples
- JSONL format rationale documented (append-only, streaming, no corruption)

---

## Phase 4: Detector Hardening

**Objective**: Fix known detector issues before human QA. Harden ALL 11 component types in priority order.

**Scope**: All 11 component types (v1 model)

**Execution Order** (hardening sequence by risk):

1. **accordion** — Highest corruption risk (footer chrome leakage, 1,838 pages affected)
2. **cards_section** — High risk (≥3 cards threshold, footer link sections, AEM grid confusion)
3. **image_carousel** — High risk (hero sections, galleries, footer carousels)
4. **card_carousel** — Medium-high risk (split logic complexity, misclassification)
5. **hero** — Medium risk (only top-of-page hero; exclude hero-like blocks lower in page)
6. **promo_section** — Medium risk (hero-like blocks in content flow)
7. **media_text_split** — Medium risk (nested carousel no-double-count rule)
8. **tabs** — Lower risk (ARIA role-based, mega-nav exclusion)
9. **info_specs** — Lower risk (spec strip detection)
10. **next_action_panel** — Lower risk (CTA hub detection)
11. **anchor_nav** — Lowest risk (in-page navigation)

**Tasks**:

- **Global chrome + modal exclusions**: Update all detectors to filter header/nav/footer/dialogs/[role="contentinfo"]/[role="banner"]/[role="dialog"]/[aria-modal="true"]
- **Hero vs promo rule**: Implement top-of-page detection for hero; classify hero-like blocks lower in page as promo_section
- **Media_text_split variants**: Add media_type classification (image|video|carousel); implement nested carousel no-double-count rule
- **Carousel split logic**: Separate image_carousel vs card_carousel using item type heuristics (≥1 <img> → image, ≥1 heading → card)
- **Cards_section detector**: Require ≥3 card-like items with link+heading/media; exclude footer link sections; ignore AEM grid scaffolding; add card_type classification (model_grade|accessory|offer|generic)
- **Accordion footer inflation**: Exclude [role="contentinfo"] from accordion detection (expect ~1,800 fewer detections)
- **Tabs detector**: Verify ARIA role filtering ([role="tablist"]), exclude mega-nav tabs
- **Info_specs detector**: Detect key facts strips (3–6 spec items, value+label pairs)
- **Next_action_panel detector**: Detect conversion CTA hubs (3–6 actions, icon+label+link)
- **Anchor_nav detector**: Detect in-page navigation (content flow only, exclude header/footer)
- Run full detector suite on 5 proof pages (all 11 types)
- Compare new detections vs JSON export (diff analysis per component type)

**Outputs**:

- Updated detector functions in `api/src/david-components.ts`
- Diff report: `analysis/artifacts/visual-proof/detector-changes.md`
- Re-export detections.json with hardened detectors

**Acceptance Criteria**:

- All detectors exclude global chrome (header/nav/footer/contentinfo/dialogs)
- Carousel split logic documented (≥1 <img> → image, ≥1 heading → card)
- Accordion detector skips footer chrome (expect ~1,800 fewer detections)
- Diff report shows before/after counts per component type
- New detections.json reflects hardened logic

---

## Phase 5: Human QA UI (Single-User, Minimal Interaction)

**Objective**: Build Next.js page for human labeling of component detections.

**Tasks**:

- Create `/web/app/qa/page.tsx` (Next.js App Router)
- Load manifest JSON + annotated screenshot for current page
- Display full-page screenshot with highlighted components
- UI controls:
  - Keyboard shortcuts: `c` (confirm), `w` (wrong), `s` (skip), `n` (next)
  - Component selection dropdown (shown when `w` pressed): Fixed list of 6 component types + "None / False positive" + "Other" (with optional text field)
  - Current detection info panel: component_key, bbox, locator, note
  - Progress counter: `N of M components labeled`
- On label action:
  - `c` → Confirm as detected type, append to `labels.jsonl`: `{url, component_key, bbox, label: "confirm", timestamp}`
  - `w` → Show dropdown, operator selects correct type, append: `{url, component_key, bbox, label: "wrong", correct_type: "<selected>", note: "<optional>", timestamp}`
  - `s` → Skip (uncertain), append: `{url, component_key, bbox, label: "skip", timestamp}`
  - Auto-advance to next detection after label
  - No save button (writes are immediate)
- Local-only: No auth, no DB, file writes only

**Outputs**:

- `/web/app/qa/page.tsx` (QA UI component)
- `analysis/artifacts/visual-proof/labels.jsonl` (append-only labels)
- Documentation: `docs/visual-proof/qa-ui.md`

**Acceptance Criteria**:

- UI displays annotated screenshot at actual size (scrollable viewport)
- Hotkeys work without focus issues
- Labels append to JSONL immediately (no batch save)
- JSONL format: one JSON object per line, no array wrapper
- File survives browser refresh (persistent appends)
- No network requests during labeling (local file writes only)

---

## Phase 6: Regression Harness (Precision Gate)

**Objective**: Define precision thresholds and automated regression tests.

**Tasks**:

- Parse `labels.jsonl` to compute precision per component type
- Precision = `confirm_count / (confirm_count + wrong_count)` (skips excluded)
- **Minimum sample size**: Require ≥10 labeled detections per component to enforce gate; otherwise report "insufficient sample" (not pass/fail)
- Define quality gates by impact class:
  - **Class A (highest corruption risk)**: accordion ≥ 90%, cards_section ≥ 90%
  - **Class B**: image_carousel ≥ 85%, card_carousel ≥ 85%
  - **Class C**: hero ≥ 80%, media_text_split ≥ 80%, promo_section ≥ 80%, info_specs ≥ 80%, next_action_panel ≥ 80%, tabs ≥ 80%, anchor_nav ≥ 80%
- Create `analysis/scripts/regression-check.ts` (pass/fail per component with sample size check)
- Output: `analysis/artifacts/visual-proof/regression-report.md`

**Outputs**:

- `analysis/scripts/regression-check.ts` (precision calculator + gate validator)
- `analysis/artifacts/visual-proof/regression-report.md` (gate results + counts)
- Documentation: `docs/visual-proof/quality-gates.md`

**Acceptance Criteria**:

- Script reads labels.jsonl, groups by component_key
- Computes precision with 2 decimal places
- Outputs pass/fail per gate with actual vs threshold
- Report includes: total labels, confirm/wrong/skip counts per component
- If any gate fails, script exits with code 1
- If all gates pass, script exits with code 0

---

## Phase 7: Return to UK Analysis (Post-Gates)

**Objective**: Run hardened detectors on full UK dataset (8,468 URLs) only after gates pass.

**Tasks**:

- Verify all quality gates pass (minimum sample size met, precision thresholds met)
- Reset `david_component_usage` table (DELETE WHERE market='UK')
- Run `POST /api/analysis/david-components/start?market=UK&reset=true`
- Wait for completion (~60 min)
- Generate final analysis reports (coverage %, component rankings, evidence samples)
- Update `.github/response.md` with final UK results

**Outputs**:

- Updated `david_component_usage` table with hardened detections
- Final analysis reports in `analysis/artifacts/uk-final/`
- Updated `.github/response.md` with post-gate results

**Acceptance Criteria**:

- All quality gates passed before starting (or "insufficient sample" for low-volume components)
- Analysis completes for all 8,468 URLs
- No regression in precision vs proof pack labels
- Reports include: total detections per component, coverage %, top 10 URLs per component
- `.github/response.md` documents changes from pre-gate to post-gate

---

## Risks & Mitigations

| Risk                                                            | Impact   | Mitigation                                                                          |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| **Locator fragility**: DOM selectors break on live pages        | High     | Document selector patterns, use robust strategies (class prefixes, role attributes) |
| **Bbox offscreen**: Components below fold, overlays not visible | Medium   | Scroll to component before screenshot, validate y-coordinate range                  |
| **Dynamic DOM**: Carousels load images async, timing issues     | Medium   | Wait for network idle, add explicit delays after navigation                         |
| **Label bias**: Operator confirms false positives               | High     | Clear labeling guidelines, "wrong" examples documented                              |
| **Gate failure**: Precision below threshold, blocks analysis    | Critical | Phase 4 detector hardening BEFORE QA, iterative fixes                               |
| **JSONL corruption**: Appends fail mid-write, file corrupted    | Low      | Use atomic writes (temp file + rename), validate JSON per line                      |

---

## Confirmed Architectural Decisions

### 1. Proof Page Selection

**Decision**: Start with the current 5 pages (2 VLP + 3 Editorial) as the initial proof pack. Pages may be expanded during QA if needed. No expansion is required before Sprint 1.

**Rationale**: The goal is detector correctness, not coverage. QA-driven expansion is cheaper and more targeted than pre-selecting additional pages. If QA reveals systematic issues on specific page types, we can add 2-3 representative pages iteratively.

**Implementation**: Mark proof page set as "initial / expandable during QA" in documentation.

---

### 2. Locator Strategy Robustness

**Decision**: Use a **hybrid locator strategy** combining structural selectors (ARIA roles, DOM hierarchy) with class-based patterns. Do NOT rely on data-\* attributes as a hard dependency.

**Rationale**:

- Class names may change between POC and production (CSS refactoring, framework upgrades)
- ARIA roles and structural signals (header, nav, footer, section) are more stable
- data-\* attributes are not guaranteed to exist across all markets or page types

**Locator Strategy Hierarchy**:

1. **Primary**: ARIA roles (`[role="tablist"]`, `[role="contentinfo"]`) + HTML5 semantic elements
2. **Secondary**: Class prefixes / patterns (`[class*="swiper"]`, `[class*="accordion"]`)
3. **Tertiary**: data-\* attributes (optional signal, fallback only)

**Implementation**: Document hybrid strategy in `docs/visual-proof/runner.md`. Proof runner must handle locator failures gracefully (log warning, continue).

---

### 3. QA Operator Interaction Model

**Decision**: Operator selects from a **fixed list of component types** (dropdown or keyboard shortcuts). Support variant classification for media_text_split (media_type) and cards_section/card_carousel (card_type). Include "Other / Incorrect detection" option with optional short text field for edge cases.

**Rationale**:

- Reduces cognitive load (no free-text recall, faster labeling)
- Keeps labeling consistent across operator sessions
- Variant fields capture critical subtype information (media_type, card_type)
- Still allows edge-case clarification when needed

**UI Specification**:

- **Primary action**: Operator confirms component type from fixed list (11 v1 types):
  - `c` → Confirm as detected type
  - `w` → Wrong (operator selects correct type from dropdown: hero, promo_section, media_text_split, info_specs, next_action_panel, image_carousel, card_carousel, cards_section, accordion, tabs, anchor_nav, "None / False positive", "Other")
  - `s` → Skip (uncertain, no label recorded)
  - `n` → Next (no label, advance)
- **Variant fields** (when applicable):
  - If corrected to media_text_split: dropdown for media_type (image|video|carousel)
  - If corrected to cards_section or card_carousel: dropdown for card_type (model_grade|accessory|offer|generic)
- **Secondary action**: If operator selects "Other / Incorrect detection", optional text field appears (max 100 chars)

**Implementation**: Update `docs/visual-proof/qa-ui.md` with component selection dropdown spec + variant fields. Update Phase 5 tasks to include dropdown UI implementation.

---

### 4. Gate Threshold Tuning

**Decision**: Use **impact-class based thresholds** as initial quality gates. Treat them as detector precision targets, not business KPIs. Thresholds may be tuned AFTER first QA pass based on empirical data. Require minimum sample size (≥10 labeled detections) to enforce gate.

**Rationale**:

- **These measure detector precision**, not business importance. A component can be business-critical but tolerate 80% precision if false positives are easily identifiable.
- **Class A components (highest corruption risk)** get strictest thresholds (90%). Accordion footer inflation and cards_section AEM grid confusion are highest-volume error sources.
- **Class B components (carousels)** get 85% threshold. High visibility but slightly subjective classification.
- **Class C components (remaining)** get 80% threshold. Lower volume or more robust detection.
- **Minimum sample size rule**: Require ≥10 labeled detections per component to enforce gate; otherwise report "insufficient sample" not pass/fail.

**Threshold Rationale by Impact Class**:

- **Class A (corruption risk, highest volume)**: accordion ≥ 90%, cards_section ≥ 90%
- **Class B (high visibility, subjective)**: image_carousel ≥ 85%, card_carousel ≥ 85%
- **Class C (lower volume or robust)**: hero ≥ 80%, media_text_split ≥ 80%, promo_section ≥ 80%, info_specs ≥ 80%, next_action_panel ≥ 80%, tabs ≥ 80%, anchor_nav ≥ 80%

**Adjustability**: After first QA run, if a component fails gate by <5% (e.g., 83% vs 85% threshold), team may:

1. Accept threshold miss if false positives are low-impact (document decision)
2. Lower threshold by 5% (e.g., 85% → 80%) and re-run QA on that component only
3. Fix detector and re-run full QA (preferred)

**Implementation**: Add impact-class threshold rationale to `docs/visual-proof/quality-gates.md`. Update Phase 6 tasks to include minimum sample size check + "threshold adjustment decision" step if gates fail.

---

### 5. Component Model & Detector Hardening Scope

**Decision**: **ALL 11 component types (v1 model) are in scope**. Prioritization is execution order only, not exclusion.

**v1 Component Model**:

1. **hero** — Primary page-entry hero at top of page ONLY
2. **promo_section** — Campaign/banner sections, hero-like blocks NOT at top
3. **media_text_split** — 2-column layout (media + text); variant: media_type (image|video|carousel)
4. **info_specs** — Key facts strip (3–6 spec items, value+label pairs)
5. **next_action_panel** — Conversion CTA hub (3–6 actions, icon+label+link)
6. **image_carousel** — Standalone image-first carousel (NOT inside media_text_split)
7. **card_carousel** — Standalone card carousel (NOT inside media_text_split)
8. **cards_section** — Static section with ≥3 cards; variant: card_type (model_grade|accessory|offer|generic)
9. **accordion** — Collapsible content (footer-excluded)
10. **tabs** — role=tablist (mega-nav excluded)
11. **anchor_nav** — In-page navigation (content flow only)

**Critical Rules**:

- **Hero vs promo**: ONLY the primary top-of-page hero is classified as hero. Any hero-like block lower in the page is promo_section or media_text_split depending on structure.
- **Media_text_split nested carousel no-double-count**: If a carousel exists within a media_text_split, treat it as media_text_split with media_type=carousel. Do NOT count it again as standalone image_carousel/card_carousel.
- **Cards_section vs AEM grid**: cards_section is a CONTAINER with ≥3 card-like items, NOT AEM layout grids. Explicitly ignore AEM grid scaffolding (`.responsivegrid`, `.aem-Grid*`, `.aem-GridColumn`, `.parsys`).
- **Card type classification**: For cards_section and card_carousel, classify card_type as model_grade_card (model/grade/trim), accessory_card, offer_card, or generic_card (fallback).
- **Modal/popup exclusion**: Baseline detections and visual proof must IGNORE modals/popup surfaces ([role="dialog"], [aria-modal="true"]) to prevent double counting and interaction-dependent content. Modal analysis is v2 track (out-of-scope for v1).

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
- Carousels have split logic complexity and footer/mega-nav leakage
- Hero vs promo distinction prevents misclassification
- Media_text_split nested carousel rule prevents double counting
- Modal exclusion prevents interaction-dependent content in baseline

**Implementation**: Update Phase 4 tasks in `docs/plan.md` to reflect full v1 scope + execution order. Update `docs/tracker.md` task descriptions to include all 11 component types + critical rules.

---

### 6. Global Chrome & Modal Exclusion Policy

**Decision**: All detectors must exclude global chrome (header, nav, footer) and modal/popup surfaces from baseline detections and visual proof overlays.

**Exclusion Selectors** (v1 baseline):

- `header`, `nav`, `footer`
- `[role="contentinfo"]`, `[role="banner"]`, `[role="navigation"]`
- `[role="dialog"]`, `[aria-modal="true"]` (modals/popups)
- `#onetrust-consent-sdk`, `.onetrust-pc-dark-filter` (cookie consent)
- `.meganav-container`, `[class*="c_010D"]` (Nissan-specific mega-nav)

**Rationale**:

- Global chrome components (e.g., footer accordions, mega-nav tabs) are NOT page content components
- Modal/popup analysis requires scripted interactions and separate denominators (v2 track)
- Cookie/consent overlays may be dismissed for screenshot clarity, but modal interiors are NOT analyzed in v1
- Prevents double counting and interaction-dependent content in baseline

**Implementation**: Document exclusion policy in `docs/visual-proof/runner.md`. Update all detector functions to filter exclusion selectors. Proof runner must skip modal DOM when computing bboxes and rendering overlays.

---

## Decision Lock

**Status**: ✅ All architectural decisions confirmed and documented.

**Ready to proceed**: Phase 1 (JSON Export) can start without further clarification.

**Next Step**: Begin Sprint 1 implementation — TH-01 (Create export script `analysis/scripts/export-detections.ts`).

- Carousels and cards produce the highest false-positive risk (swiper classes everywhere, footer carousels, mega-nav dropdowns)
- Accordion and cards_section produce highest false-positive risk (footer inflation, AEM grid confusion)
- Carousels have split logic complexity and footer/mega-nav leakage
- Hero vs promo distinction prevents misclassification
- Media_text_split nested carousel rule prevents double counting
- Modal exclusion prevents interaction-dependent content in baseline
- Tabs, info_specs, next_action_panel, and anchor_nav are lower risk but must still be validated (completeness over speed)

**Implementation**: Update Phase 4 tasks in `docs/plan.md` to reflect full scope + execution order. Update `docs/tracker.md` task TH-15 to explicitly list all 11 component types.

---

## Decision Lock

**Status**: ✅ All architectural decisions confirmed and documented.

**Ready to proceed**: Phase 1 (JSON Export) can start without further clarification.

**Next Step**: Begin Sprint 1 implementation — TH-01 (Create export script `analysis/scripts/export-detections.ts`).
