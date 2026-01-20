# Component Analysis Methodology — Nissan UK

## Overview

This document defines the methodology for identifying, classifying, and counting components across the Nissan UK website for the cu-tool POC.

---

## Eligible URLs

**Definition**: URLs that are included in component analysis.

**Criteria** (SQL-compatible):

```sql
market = 'UK'
AND status = 'fetched'
AND duplicate_of_id IS NULL
AND html_path IS NOT NULL
AND html_path NOT LIKE '\\_\\_%' ESCAPE '\\'
```

**Explanation**:

- `market = 'UK'`: UK market only (www.nissan.co.uk, micra.nissan.co.uk, leaf.nissan.co.uk)
- `status = 'fetched'`: Successfully downloaded HTML
- `duplicate_of_id IS NULL`: Not marked as duplicate (based on canonical URL + content hash)
- `html_path NOT NULL`: HTML file saved to disk
- `html_path NOT LIKE '\\_\\_%'`: Exclude temp/system files

**UK Dataset Size**: 8,468 eligible URLs (as of 2026-01-20)

---

## Page Classification

### VLP (Vehicle Landing Pages)

**Definition**: Product pages for specific vehicle models.

**UK Matching Rules**:

- URL starts with `https://www.nissan.co.uk/vehicles/new-vehicles`
- OR URL host is `https://micra.nissan.co.uk/`
- OR URL host is `https://leaf.nissan.co.uk/`

**Examples**:

- ✅ `https://www.nissan.co.uk/vehicles/new-vehicles/juke.html`
- ✅ `https://www.nissan.co.uk/vehicles/new-vehicles/ariya/design.html`
- ✅ `https://micra.nissan.co.uk/`
- ✅ `https://micra.nissan.co.uk/design.html`
- ❌ `https://www.nissan.co.uk/vehicles/brochures.html` (not VLP, is Editorial)

**UK Dataset Size**: 102 VLP URLs (1.2% of total eligible)

---

### Editorial

**Definition**: All non-VLP content pages (excluding homepage).

**UK Matching Rules**:

- Eligible URL (as defined above)
- AND NOT a VLP URL
- AND NOT the homepage (see below)

**Examples**:

- ✅ `https://www.nissan.co.uk/experience-nissan/electric-vehicles.html`
- ✅ `https://www.nissan.co.uk/ownership.html`
- ✅ `https://www.nissan.co.uk/owners/car-repair/car-owner-manual/...`
- ✅ `https://www.nissan.co.uk/fleet-cars/company-car-drivers.html`
- ❌ `https://www.nissan.co.uk/` (homepage, separate category)

**UK Dataset Size**: 8,366 Editorial URLs (98.8% of total eligible)

---

### Homepage

**Definition**: Root URL of the primary market domain.

**UK Matching Rules**:

- URL exactly equals `https://www.nissan.co.uk/`

**Examples**:

- ✅ `https://www.nissan.co.uk/`
- ❌ `https://www.nissan.co.uk/index.html` (redirects to `/`, counts as same)
- ❌ `https://micra.nissan.co.uk/` (VLP, not homepage)

**UK Dataset Size**: 1 URL

**Note**: Homepage is excluded from VLP/Editorial component rankings to avoid skewing results. Homepage typically contains a mix of global chrome, hero banners, and promotional cards that don't represent typical page patterns.

---

## Denominator Definition

**Question**: "What percentage of pages contain component X?"

**Answer**: Percentage is calculated relative to **eligible URLs** in the relevant segment:

- **Overall**: `pct = (pages_with_component / 8,468) * 100`
- **VLP**: `pct = (vlp_pages_with_component / 102) * 100`
- **Editorial**: `pct = (editorial_pages_with_component / 8,366) * 100`

**Important**: Denominators are based on URL counts, not on total HTML files or sitemap entries. Duplicates are excluded.

---

## Component Taxonomy

Eleven component types are detected (v1 model):

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

- **Hero vs promo**: ONLY top-of-page hero is `hero`. Hero-like blocks lower in page are `promo_section` or `media_text_split`.
- **Media_text_split nested carousel no-double-count**: If carousel exists within media_text_split, classify as media_text_split with media_type=carousel (NOT standalone carousel).
- **Modal exclusion**: Baseline detections IGNORE modals ([role="dialog"], [aria-modal="true"]).

**Note**: Component definitions and detection algorithms are documented in `api/src/david-components.ts` and `.github/response.md`.

---

## Counting Rules

### Component-Level Counting

**Definition**: One record per component type per page, storing the **count of instances** of that component on the page.

**Example**:

- Page A has 3 image carousels → `{ component_key: 'image_carousel', instance_count: 3 }`
- Page B has 1 cards_section → `{ component_key: 'cards_section', instance_count: 1 }`

**Evidence Format**: Each detection includes evidence string for auditability:

- `accordion: 1, items=192, source=aria-controls`
- `cards_section: 2 sections, items_per_section=[3,4]`
- `image_carousel: 3 (deduped), items=[5,8,12], controls=yes`

### Instance Deduplication

**Problem**: Nested carousels or overlapping containers can cause double-counting.

**Solution**: Outermost-only deduplication (keep parent, discard nested children).

**Example**:

- DOM has carousel A containing carousel B
- Detector finds both A and B
- Deduplication keeps A, discards B
- Result: `instance_count = 1`

---

## Known Limitations

### Accordion (PROVISIONAL)

**Issue**: Accordion detection is currently **inflated** due to global footer chrome leakage.

**Evidence**:

- 87.2% of Editorial pages detected with accordion (7,291 of 8,366)
- 1,838 pages show exactly 192-item accordions (footer navigation using aria-controls pattern)
- SQL: `SELECT COUNT(*) FROM david_component_usage WHERE component_key = 'accordion' AND evidence LIKE '%items=192%';` → 1,838

**Implication**: Accordion counts in Editorial segment are **unreliable** until footer/chrome exclusion fix is implemented.

**Status**: Detection includes `GLOBAL_CHROME_EXCLUSIONS` list (footer, header, nav, cookie consent), but owner's manual pages still leak footer accordions.

**Recommendation**: Do NOT use Editorial accordion prevalence (87.2%) for migration planning. VLP accordion counts (4.9%) appear accurate.

---

### Lazy-Loaded Images

**Issue**: Image carousels may miss images if `src` or `data-src` attributes are not present in initial HTML.

**Mitigation**: Detectors check both `src` and `data-src` attributes. Playwright-based visual proof will load pages to networkidle state.

---

### Card Heading Detection

**Issue**: Cards without h2/h3/h4 headings (using h5/h6 or styled `<p>` tags) won't be detected.

**Rationale**: Intentional design choice to detect semantic card structures, not layout wrappers.

---

## Reproducibility

### Database

**Single source of truth**: `api/data/cu-tool.db` (SQLite)

**Tables**:

- `url_inventory` — URL metadata (status, final_url, canonical_url, content_hash, duplicate_of_id)
- `david_component_usage` — Component detections (url_id, component_key, instance_count, evidence)

**Note**: Database is .gitignored. To reproduce analysis, re-run inventory + fetch + analysis pipeline.

### Analysis Queries

**Location**: `analysis/sql/` (reusable SQL queries)

**Standard queries**:

- `eligible_urls_uk.sql` — Filter to eligible URLs
- `component_ranking_overall.sql` — Overall component prevalence
- `component_ranking_vlp.sql` — VLP-specific ranking
- `component_ranking_editorial.sql` — Editorial-specific ranking
- `accordion_item_histogram.sql` — Accordion item count distribution

---

## Visual Proof Pack

**Purpose**: Validate component detection accuracy with visual evidence (screenshots + JSON metadata).

**Scope**: 2-3 VLP pages + 2-3 Editorial pages

**Output**: `analysis/artifacts/visual-proof/<slug>.(png|json)`

**Methodology**: See `analysis/visual-proof/README.md`

---

**Last Updated**: 2026-01-20
