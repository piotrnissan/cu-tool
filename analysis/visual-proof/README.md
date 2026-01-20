# Visual Proof Pack — Workflow

## Overview

The visual proof pack validates component detection accuracy by generating **annotated screenshots** and **structured JSON metadata** for a curated set of pages.

**Purpose**:

- Visual evidence of component detection (bounding boxes or markers on screenshots)
- Structured data for programmatic comparison against database
- Manual QA support (compare visual vs detected)

**Scope**: 2-3 VLP pages + 2-3 Editorial pages (UK market only)

---

## Workflow

### Inputs

- **Page lists** (this directory):
  - `pages.vlp.txt` — VLP URLs (2-3)
  - `pages.editorial.txt` — Editorial URLs (2-3)
  - `pages.homepage.txt` — Homepage URL (optional, not included in primary proof pack)

- **Component detectors** (`api/src/david-components.ts`):
  - Detection logic for all 6 component types
  - Evidence generation for auditability

- **Database** (`api/data/cu-tool.db`):
  - `david_component_usage` table for comparison

---

### Process

1. **Load page** (Playwright)
   - Full page load with `networkidle` wait state
   - Fixed viewport: 1920x1080
   - Disable animations, clear cache

2. **Run detectors** (same logic as batch analysis)
   - Parse HTML with JSDOM
   - Run all 6 component detectors
   - Generate evidence strings

3. **Annotate components** (visual markers)
   - Locate each detected component instance in DOM
   - Draw bounding box or marker on screenshot
   - Label with component type + instance number

4. **Capture screenshot** (Playwright)
   - Full page screenshot (with annotations)
   - Save as PNG: `analysis/artifacts/visual-proof/<slug>.png`

5. **Generate JSON metadata**
   - Match `david_component_usage` schema
   - Include: url, component_key, instance_count, evidence, locators
   - Save as JSON: `analysis/artifacts/visual-proof/<slug>.json`

6. **Compare vs DB** (manual QA)
   - Load JSON + DB data side-by-side
   - Check for discrepancies (false positives/negatives)
   - Document in `docs/qa-notes.md`

---

### Outputs

**Location**: `analysis/artifacts/visual-proof/`

**Per page**:

- `<slug>.png` — Annotated screenshot
- `<slug>.json` — Structured metadata

**Example output structure**:

```json
{
  "url": "https://www.nissan.co.uk/vehicles/new-vehicles/juke.html",
  "slug": "vehicles-new-vehicles-juke",
  "timestamp": "2026-01-20T12:34:56Z",
  "components": [
    {
      "component_key": "image_carousel",
      "instance_count": 5,
      "evidence": "items=[20,6,6,8,6], controls=yes",
      "locators": [
        "div.swiper-container:nth-of-type(1)",
        "div.swiper-container:nth-of-type(2)",
        "...more locators..."
      ]
    },
    {
      "component_key": "cards_section",
      "instance_count": 1,
      "evidence": "items_per_section=[3]",
      "locators": ["section.trim-comparison"]
    }
  ]
}
```

**Summary report** (future):

- `analysis/artifacts/visual-proof/index.html` or `index.md`
- Thumbnails + links to full screenshots
- Component detection summary table

---

## Demo Runner

**Purpose**: Minimal proof-of-concept showing how component detection and visual annotation work.

**Command**:

```bash
pnpm proof:demo
```

**What it does**:

1. Reads the first URL from `pages.vlp.txt` (Micra page)
2. Opens page with Playwright (1920x1080 viewport)
3. Auto-dismisses cookie overlay (best-effort)
4. Searches for 2-3 demo components:
   - **Tabs**: `[role="tablist"]` outside global chrome
   - **Carousel**: Container with ≥2 images + controls
   - **Cards section**: Container with ≥3 card-like items (link + heading + media)
5. Injects visual overlays (colored bounding boxes + labels)
6. Saves outputs:
   - `analysis/artifacts/visual-proof/demo/<slug>.png` (annotated screenshot)
   - `analysis/artifacts/visual-proof/demo/<slug>.json` (metadata)

**Output example**:

```
📊 Results:
   - Components found: 2
   - PNG: analysis/artifacts/visual-proof/demo/micra.png
   - JSON: analysis/artifacts/visual-proof/demo/micra.json
```

**Note**: Demo uses conservative heuristics and may not find all components. Full runner (Sprint 2) will use actual detectors from `api/src/david-components.ts`.

---

## Runner Command (Placeholder)

**Future command**:

```bash
pnpm proof:visual
```

**Implementation plan**: Sprint 2 (see `docs/plan.md`)

**Expected behavior**:

1. Read page lists from `analysis/visual-proof/pages.*.txt`
2. For each URL:
   - Launch Playwright browser
   - Load page, run detectors, annotate, screenshot
   - Save PNG + JSON to `analysis/artifacts/visual-proof/`
3. Exit with summary (N pages processed, M components detected)

---

## Notes

### Do NOT Commit

- ❌ SQLite database: `api/data/cu-tool.db`
- ❌ HTML cache: `api/data/html-cache/`
- ✅ Screenshots + JSON: `analysis/artifacts/visual-proof/` (OK to commit)

### Reproducibility

Visual proof pack is a **point-in-time snapshot**. To reproduce:

1. Re-run inventory + fetch + analysis pipeline
2. Re-generate visual proof pack with same page list

**Caveat**: Page content may change over time. Proof pack is not regression testing.

---

## Locator Strategy (TBD)

Component locators will be documented in Sprint 2. Planned approach:

- **accordion**: `details` elements OR `[aria-expanded][aria-controls]` pairs
- **cards_section**: Container with ≥3 children matching card structure (link + image + heading)
- **tabs**: `[role="tablist"]` OR common tab class patterns
- **image_carousel**: Carousel containers with `img` children + navigation controls
- **card_carousel**: Carousel containers with card-like children
- **anchor_nav**: `nav` with anchor links (`#`) OR landmark with in-page links

---

**Status**: Sprint 1 complete (scaffolding), Sprint 2 next (implementation)
**Last Updated**: 2026-01-20
