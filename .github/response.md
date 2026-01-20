# cu-tool — Operational Log

## ⚠️ ANALYSIS FROZEN

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
**Status**: TH-04 complete — Proof runner generates annotated screenshots from detections.json

**Completed**:

- ✅ TH-01 to TH-03: JSON export pipeline (`pnpm proof:export`)
- ✅ TH-04: Proof runner (`pnpm proof:run`) — Generates annotated screenshots + manifest JSON

**Next step**: TH-05+ — Detector hardening (global chrome/modal exclusions, carousel split logic, etc.)

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

---

## TH-01: JSON Export Script (2026-01-20)

**What was added**:

- New script: `analysis/scripts/export-detections.ts` — TypeScript export tool using `better-sqlite3`
- New command: `pnpm proof:export` — Runs the export script from repo root
- Output file: `analysis/artifacts/visual-proof/detections.json` — Component detections for proof pack URLs

**How to run**:

```bash
pnpm proof:export
```

**What it does**:

1. Loads proof pack URL lists from text files (VLP, Editorial, Homepage)
2. Queries SQLite DB (`api/data/cu-tool.db`) for component detections
3. Joins `david_component_usage` table with `url_inventory` (market='UK')
4. Parses evidence strings into structured JSON (best-effort, never fails):
   - `image_carousel`, `card_carousel`: Extracts `items=[...]`, `controls=yes/no`, `deduped`
   - `cards_section`: Extracts `sections`, `items_per_section=[...]`
   - `accordion`: Extracts `items`, `source`
5. Exports to JSON with proof pack structure, summary stats, and per-URL detections

**Output format**:

```json
{
  "generated_at": "<ISO timestamp>",
  "market": "UK",
  "proof_pack": { "vlp": [...], "editorial": [...], "homepage": [...] },
  "summary": {
    "total_urls_requested": 6,
    "total_urls_found_in_inventory": 3,
    "total_urls_with_detections": 3,
    "total_detection_rows": 5
  },
  "urls": [
    {
      "url": "<url>",
      "url_id": <int or null>,
      "detections": [
        {
          "component_key": "<string>",
          "instance_count": <int>,
          "confidence": "<string|null>",
          "evidence_raw": "<string|null>",
          "evidence_parsed": <object|null>
        }
      ]
    }
  ]
}
```

**Warnings**:

- Prints WARN if URL not found in `url_inventory` (not fetched or analyzed yet)
- Prints WARN if URL has 0 detections (not analyzed yet)
- Prints WARN if total URLs ≠ 5 (expected: 2 VLP + 3 Editorial, 5 total)

**Current results** (2026-01-20):

- 6 URLs requested (2 VLP + 3 Editorial + 1 Homepage)
- 3 URLs found in inventory (2 VLP + 1 Editorial)
- 3 URLs with detections (all 3 found URLs have detections)
- 5 total detection rows exported

**Why**:
Phase 1 (JSON export) enables the visual proof workflow:

- Provides input for screenshot capture (TH-02)
- Establishes data contract for QA UI (TH-03)
- Enables reproducible, version-controlled proof pack

**Evidence parsing rationale**:

- Lightweight, best-effort parsing (never throws)
- Converts string evidence into structured objects for easier consumption
- Preserves `evidence_raw` always (original source of truth)
- Enables future extensions without schema changes

**Risks / open questions**:

- 3 URLs not in inventory (not fetched yet) — OK for POC, will be fetched when full UK analysis runs
- Homepage not analyzed yet — Optional for proof pack, can be excluded from final QA

**Next recommended step**:
TH-02 — Screenshot capture runner (read detections.json, capture bounding boxes with Playwright)

---

## TH-04: Proof Runner (Live) (2026-01-20)

**What was added**:

- New runner script: `analysis/visual-proof/runner/run.ts` — Playwright-based proof runner
- New command: `pnpm proof:run` — Generates annotated screenshots + manifest JSON
- Outputs (local-only, gitignored):
  - `analysis/artifacts/visual-proof/full/<slug>/<slug>.annotated.png` — Full-page screenshots with colored overlays
  - `analysis/artifacts/visual-proof/full/<slug>/<slug>.manifest.json` — Bbox coordinates + locator metadata

**How to run**:

```bash
pnpm proof:export  # First, export detections.json
pnpm proof:run     # Then, generate annotated screenshots
```

**What it does**:

1. Loads `detections.json` (created by TH-01)
2. For each URL with detections:
   - Launches Playwright Chromium (1920x1080 viewport)
   - Navigates to live URL with `domcontentloaded` + `networkidle` wait
   - Dismisses cookie/consent overlays (OneTrust)
   - For each detection (component_key + instance_count):
     - Queries DOM using documented selector strategy (from `docs/visual-proof/runner.md`)
     - Filters out global chrome (header/nav/footer/modals)
     - Computes bounding boxes in document coordinates
     - Deduplicates nested boxes
     - Injects colored overlays with labels
   - Captures full-page annotated screenshot
   - Generates manifest JSON with bbox coordinates + selector metadata
3. Saves outputs to `analysis/artifacts/visual-proof/full/<slug>/`

**Locator strategy implementation**:

- Component-to-selector mappings from runner.md (all 11 v1 component types)
- Global chrome exclusions: `header`, `nav`, `footer`, `[role="dialog"]`, `[aria-modal="true"]`, OneTrust, meganav
- Bbox validation: min 20px height, 50px width, reasonable y-range (-200 to 20000)
- Nested box deduplication: skip boxes fully contained in larger boxes

**Overlay injection**:

- Colored borders (4px solid, component-specific colors from runner.md)
- Labels: `<component_key> #<index>` (e.g., `image_carousel #1`)
- Positioned with `position: absolute` using document coordinates
- `z-index: 999999` to render above all page content
- `pointer-events: none` to avoid layout shifts

**Manifest JSON format**:

```json
{
  "url": "<url>",
  "slug": "<slug>",
  "timestamp": "<ISO>",
  "viewport": { "width": 1920, "height": 1080 },
  "detections": [
    {
      "component_key": "<string>",
      "expected_instances": <int>,
      "found_instances": <int>,
      "selector_used": "<CSS selector>",
      "instances": [
        {
          "bbox": { "x": <int>, "y": <int>, "width": <int>, "height": <int> },
          "selector_used": "<CSS selector>"
        }
      ],
      "notes": "<optional warning message>"
    }
  ]
}
```

**Current results** (2026-01-20):

- 3 URLs processed (Juke, Ariya, Electric Vehicles)
- Juke: 4/5 image_carousel, 1/1 card_carousel (1 carousel not found on live page)
- Ariya: 2/7 image_carousel, 1/1 card_carousel (5 carousels not found — possible DOM change)
- Electric Vehicles: 2/2 cards_section
- Total: 10 detection rows, 9 components highlighted
- Screenshots: 10-12MB each (full-page PNGs)
- Manifests: 0.9-1.9KB each (JSON)

**Why**:
Visual proof foundation for detector validation:

- Provides visual evidence of what detectors actually find
- Enables human QA labeling (next phase: TH-26+)
- Documents locator strategy execution (not just specification)
- Catches DOM structure changes vs cached HTML

**Discrepancies (expected)**:

- Found fewer instances than expected (Juke: 4/5, Ariya: 2/7)
- **Not a bug**: Live pages may differ from cached HTML used by detectors
- Detectors analyze static HTML; runner queries live DOM (dynamic content, A/B tests, etc.)
- Discrepancies inform detector hardening (next phase)

**Risks / open questions**:

- Navigation timeouts on networkidle (15s) — pages still load, warning logged, screenshots captured
- Large screenshot files (10-12MB each) — OK for proof pack (5 pages), would need optimization for full-site
- Some components not found on live pages vs detections — need to investigate if detector over-counted or page changed

**Next recommended step**:
TH-14+ — Detector hardening (add global chrome/modal exclusions to all detectors)
