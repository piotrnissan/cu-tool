# UK Pre-Hardening Analysis Report (ARCHIVED)

## ⚠️ THIS ANALYSIS IS NOT VALID FOR CONCLUSIONS

This document contains pre-hardening component detection results from the initial UK analysis (January 2026). The data was generated BEFORE tool hardening, visual proof validation, and quality gates. Per project methodology, no component rankings or conclusions should be drawn from this data until detector hardening and human QA validation are complete.

**Status**: Analysis frozen. Preserved for historical reference only.

---

## Dataset

**Dataset**: 8,468 eligible UK URLs (fetched, deduplicated, HTML present)
**Analyzed**: 7,391 URLs with at least one detected component

---

## 1. cards_section Detector

### Overview

Replaced `cards_grid` (keyword-based) with `cards_section` (structural detection) to accurately count content components rather than AEM layout scaffolding.

**Rationale**: AEM uses "grid" classes throughout the page for layout. Keyword-based detection counted wrappers, not meaningful content sections.

### Detection Algorithm

**Card-like item definition** (structural, not class-based):

- Contains link: `a[href]`
- Contains visual media: `img`, `picture`, `svg`, or `[role="img"]`
- Contains heading: `h2`, `h3`, `h4`, or `[role="heading"]`

**Section detection**:

- Search within content root for containers (div/section/ul/ol/article) with ≥3 card-like children
- Deduplicate nested containers (keep outermost only)
- Ignore AEM layout wrappers (`.responsivegrid`, `.aem-Grid*`, `.aem-GridColumn`, `.parsys`) as candidates via `matches()`
- Count sections, not individual items

**Evidence format**: `cards_section: N sections, items_per_section=[3,4,6]`

### Results

#### Full UK Dataset (8,468 URLs)

**Statistics**:

```text
cards_section | 70 pages | 0.8% | min=1 | max=4 | avg=1.4 | total=96
```

**Key findings**:

- 70 pages (0.8% of 8,468 eligible URLs) contain cards_section components
- Lower prevalence than early validation suggested, but detection remains accurate
- Concentrated on fleet/brochure/product landing pages
- Average 1.4 sections per page (consistent with validation sample)

#### Early Validation Sample (200 URLs)

_Historical context: Initial validation showed 42 pages (21%) with cards_section. Full dataset reveals this component is concentrated in specific page types that were over-represented in the validation sample._

**Top URLs by instance count** (from validation sample):

| URL                                 | Instances | Evidence                      |
| ----------------------------------- | --------- | ----------------------------- |
| fleet-cars/fleet-car-solutions.html | 4         | `items_per_section=[4,3,4,4]` |
| fleet-cars/company-car-drivers.html | 4         | `items_per_section=[3,3,4,4]` |
| vehicles/brochures.html             | 3         | `items_per_section=[3,3,3]`   |
| vehicles/new-vehicles.html          | 2         | `items_per_section=[6,3]`     |

**Spec page behavior** (validation sample):

| URL                               | Instances | Evidence                |
| --------------------------------- | --------- | ----------------------- |
| ariya/price-specifications.html   | 1         | `items_per_section=[3]` |
| x-trail/price-specifications.html | 1         | `items_per_section=[5]` |
| juke/prices-specifications.html   | 1         | `items_per_section=[5]` |

### Backward Compatibility

- `cards_grid` component key no longer emitted
- Old data preserved in database for reference
- Reports must update to query `cards_section`

---

## 2. Carousel Detector Hardening

### Overview — Carousel Hardening

Reduced over-counting in image and card carousels through robust nested deduplication, mandatory control validation, and structural verification.

### Reusable SQL Queries

Created standardized queries in `analysis/sql/`:

**`component_stats.sql`** - Dynamic percentage calculation:

```sql
WITH analyzed_urls AS (
  SELECT COUNT(DISTINCT url_id) as total
  FROM david_component_usage
)
SELECT
  component_key,
  COUNT(DISTINCT url_id) as pages,
  ROUND(COUNT(DISTINCT url_id) * 100.0 / (SELECT total FROM analyzed_urls), 1) as pct,
  MIN(instance_count) as min,
  MAX(instance_count) as max,
  ROUND(AVG(instance_count), 1) as avg,
  SUM(instance_count) as total
FROM david_component_usage
WHERE component_key = 'cards_section'  -- Edit this
GROUP BY component_key;
```

**`top_urls_by_instances.sql`**:

```sql
SELECT
  ui.url,
  dcu.instance_count,
  dcu.evidence
FROM david_component_usage dcu
JOIN url_inventory ui ON dcu.url_id = ui.id
WHERE dcu.component_key = 'cards_section'  -- Edit this
ORDER BY dcu.instance_count DESC
LIMIT 10;  -- Edit this
```

### Detection Algorithm — Carousels

**Both carousel types (image_carousel, card_carousel)**:

1. **Collect raw candidates**:
   - Keyword-based: class/id/data-component contains carousel/slider/slideshow/swiper/slick
   - Control-based: containers with carousel navigation (`.swiper-pagination`, `.slick-dots`, etc.)

2. **Robust nested deduplication** (outermost-only):
   - Sort by DOM depth (outermost first)
   - Accept candidate only if NOT contained by already-accepted candidate

3. **Acceptance rules**:
   - **image_carousel**: ≥2 unique images + navigation controls
   - **card_carousel**: ≥2 card-like items (link + heading/media) + navigation/scrollable

**Evidence format**:

- `image_carousel: N (deduped), items=[2,5,...], controls=yes`
- `card_carousel: N (deduped), items=[3,4,...], controls`

### Results — Carousels

#### Full UK Dataset — Carousels (8,468 URLs)

**Final counts after hardening**:

| Component      | Pages | % of Eligible | Total Instances | Avg/Page |
| -------------- | ----- | ------------- | --------------- | -------- |
| image_carousel | 13    | 0.2%          | 52              | 4.0      |
| card_carousel  | 10    | 0.1%          | 10              | 1.0      |

**Key findings**:

- Both carousel types are rare across the full UK dataset
- image_carousel: 13 pages (0.2%), concentrated on vehicle product pages
- card_carousel: 10 pages (0.1%), exclusively on vehicle product pages
- Perfect 1:1 component-level counting for card_carousel maintained at scale
- No false positives detected in full dataset

#### Early Validation (200 URLs)

_Historical context: Initial hardening validation showed identical page counts for both carousel types, confirming detector stability._

**Before vs After hardening**:

| Component      | Before                           | After                            | Reduction |
| -------------- | -------------------------------- | -------------------------------- | --------- |
| image_carousel | 13 pages, 94 instances (7.2 avg) | 13 pages, 52 instances (4.0 avg) | 45%       |
| card_carousel  | 13 pages, 52 instances (4.0 avg) | 10 pages, 10 instances (1.0 avg) | 80%       |

**image_carousel - Top 5 URLs**:

| URL                                 | Instances | Evidence                               |
| ----------------------------------- | --------- | -------------------------------------- |
| vehicles/new-vehicles/ariya.html    | 7         | `items=[12,8,8,4,6,6,6], controls=yes` |
| e-power-flash-dc.html               | 5         | `items=[20,6,6,8,8], controls=yes`     |
| vehicles/new-vehicles/x-trail.html  | 5         | `items=[20,6,6,8,8], controls=yes`     |
| vehicles/new-vehicles/juke.html     | 5         | `items=[20,6,6,8,6], controls=yes`     |
| vehicles/new-vehicles/townstar.html | 4         | `items=[8,12,6,10], controls=yes`      |

**Manual validation**: <https://www.nissan.co.uk/vehicles/new-vehicles/ariya.html> confirmed to have ~6-7 distinct image carousels. Detector output of 7 is accurate.

**card_carousel - Top 5 URLs**:

| URL                                | Instances | Evidence              |
| ---------------------------------- | --------- | --------------------- |
| e-power-flash-dc.html              | 1         | `items=[6], controls` |
| vehicles/new-vehicles/qashqai.html | 1         | `items=[6], controls` |
| vehicles/new-vehicles/ariya.html   | 1         | `items=[4], controls` |
| vehicles/new-vehicles/x-trail.html | 1         | `items=[6], controls` |
| vehicles/new-vehicles/juke.html    | 1         | `items=[6], controls` |

**Key improvements**:

- Perfect 1:1 component-level counting for card_carousel
- image_carousel: nested sub-carousels properly deduplicated
- Vehicle product pages are primary users of both types

### card_carousel Refinements

Initial structural validation was too strict (0 detections). Applied fixes:

1. **Two-tier item search**:
   - Primary: Direct children with structural validation
   - Fallback: Items with carousel classes (card/item/slide/tile) within 5 levels deep

2. **Loosened heading detection**: h2-h6 (was h2-h5)

3. **Added lazy-load attributes**: data-src, data-lazy

4. **Scrollable carousel support**: Fallback for carousels without explicit controls (overflow-x, scroll-snap, ARIA carousel)

Result: 10 pages detected with clean 1:1 counting. All use explicit controls (scrollable fallback not triggered in UK sample).

---

## 3. Component Summary - Full UK Dataset

**Dataset**: 8,468 eligible UK URLs (fetched, deduplicated, HTML present)
**Analyzed**: 7,391 URLs with at least one detected component (87.3%)

| Component      | Pages | % of Eligible | Total Instances | Avg/Page |
| -------------- | ----- | ------------- | --------------- | -------- |
| accordion      | 7,296 | 86.2%         | 7,296           | 1.0      |
| cards_section  | 70    | 0.8%          | 96              | 1.4      |
| tabs           | 19    | 0.2%          | 20              | 1.1      |
| image_carousel | 13    | 0.2%          | 52              | 4.0      |
| card_carousel  | 10    | 0.1%          | 10              | 1.0      |
| anchor_nav     | 8     | 0.1%          | 8               | 1.0      |

**Key insights**:

- **accordion** appears on 86.2% of eligible URLs, but this signal is likely inflated by global chrome (e.g., mobile footer/navigation accordions). Treat accordion prevalence as provisional until the detector excludes global chrome.
- **cards_section**, **carousels**, and **tabs** are specialized components for specific page types
- Clean 1:1 component-level counting maintained for accordion, card_carousel, anchor_nav
- image_carousel averages 4 per page on vehicle pages (realistic for feature-rich product content)
- Early validation sample (200 URLs) over-represented cards_section and carousels

---

## 4. Component Usage by Page Type (Overall / VLP / Editorial)

### Methodology

**Segmentation definitions**:

- **VLP (Vehicle Landing Pages)**: URLs matching:
  - `https://www.nissan.co.uk/vehicles/new-vehicles%`
  - `https://micra.nissan.co.uk/%`
  - `https://leaf.nissan.co.uk/%`
- **Editorial**: All other eligible UK URLs (content, support, owner's manuals, fleet, etc.)

**Denominator (eligible URLs)**:

- market='UK', status='fetched', duplicate_of_id IS NULL, html_path IS NOT NULL, and html_path NOT LIKE '\_\_%' ESCAPE '\\'
- **Total**: 8,468 eligible URLs
- **VLP**: 102 URLs (1.2% of total)
- **Editorial**: 8,366 URLs (98.8% of total)

**Detection coverage**:

- URLs with at least one component detected: **7,391 URLs (87.3% of eligible)**
- URLs with zero detections: 1,077 (12.7%)

---

### UK Overall (8,468 eligible URLs)

| Component      | Pages | % of Eligible | Avg per Page | Total Instances |
| -------------- | ----- | ------------- | ------------ | --------------- |
| accordion      | 7,296 | 86.2%         | 1.0          | 7,296           |
| cards_section  | 70    | 0.8%          | 1.4          | 96              |
| tabs           | 19    | 0.2%          | 1.1          | 20              |
| image_carousel | 13    | 0.2%          | 4.0          | 52              |
| card_carousel  | 10    | 0.1%          | 1.0          | 10              |
| anchor_nav     | 8     | 0.1%          | 1.0          | 8               |

---

### VLP (102 eligible URLs)

| Component      | Pages | % of Eligible VLP | Avg per Page | Total Instances |
| -------------- | ----- | ----------------- | ------------ | --------------- |
| image_carousel | 12    | 11.8%             | 3.9          | 47              |
| card_carousel  | 9     | 8.8%              | 1.0          | 9               |
| cards_section  | 8     | 7.8%              | 1.1          | 9               |
| tabs           | 5     | 4.9%              | 1.0          | 5               |
| accordion      | 5     | 4.9%              | 1.0          | 5               |

---

### Editorial (8,366 eligible URLs)

| Component      | Pages | % of Eligible Editorial | Avg per Page | Total Instances |
| -------------- | ----- | ----------------------- | ------------ | --------------- |
| accordion      | 7,291 | 87.2%                   | 1.0          | 7,291           |
| cards_section  | 62    | 0.7%                    | 1.4          | 87              |
| tabs           | 14    | 0.2%                    | 1.1          | 15              |
| anchor_nav     | 8     | 0.1%                    | 1.0          | 8               |
| image_carousel | 1     | 0.0%                    | 5.0          | 5               |
| card_carousel  | 1     | 0.0%                    | 1.0          | 1               |

**⚠️ Accordion reliability note**: The 87.2% accordion presence in Editorial is **NOT content-only** and should not be used as a reliable indicator yet. A histogram of detected accordion item counts shows an extreme skew toward very large item counts (51+), which is inconsistent with typical in-content FAQ/spec accordions and strongly suggests global chrome leakage (commonly mobile footer/navigation patterns).

---

### Key Findings

**Accordion inflation is segment-specific**:

- Editorial pages: **87.2%** accordion presence (7,291 of 8,366)
- VLP pages: **4.9%** accordion presence (5 of 102)
- **18x difference** confirms accordion inflation is concentrated in Editorial content (owner's manuals, support pages)

**VLP is carousel-heavy (expected pattern)**:

- image_carousel: 11.8% presence (product imagery)
- card_carousel: 8.8% presence (product features)
- cards_section: 7.8% presence (trim/spec comparison)
- Minimal accordion usage (4.9%) on VLP pages

**Editorial is accordion-dominated (likely inflated by global chrome)**:

- 87.2% accordion presence on Editorial pages indicates systematic detection of non-content accordions.
- Item-count histogram analysis is heavily concentrated in the 51+ bucket, which strongly suggests global chrome leakage (often mobile footer/navigation accordions) rather than editorial FAQ/spec accordions.
- Other detected components remain rare in Editorial: cards_section 0.7%, tabs 0.2%, carousels ~0%.

**Action**: Treat accordion as provisional for segment comparisons until the detector excludes global chrome; rerun UK analysis after the fix.

---

## 5. Known Limitations & Edge Cases

### cards_section

- **Cards without headings**: Won't detect if using h5/h6 or styled `<p>` tags as headings
- **Text-only cards**: Won't detect cards without images (by design)
- **Single-image links**: Won't detect simple image links without headings (intentional)

### image_carousel

- **Lazy-loaded images**: May miss if src/data-src not present in initial HTML
- **Unique image check**: May fail if carousel intentionally uses duplicate images

### card_carousel

- **Two-tier search**: Fallback to keyword-based item search may introduce minimal noise (mitigated by depth limit + structural validation)
- **Scrollable fallback**: Not triggered in UK sample; may need refinement for other markets

---

## 6. Next Steps (Historical)

### Manual QA (Recommended)

Validate top URLs for specialized components:

- **cards_section**: fleet-car-solutions, brochures, new-vehicles
- **image_carousel**: ariya, e-power-flash-dc, x-trail
- **card_carousel**: e-power-flash-dc, qashqai, ariya

Verify instance counts match visual inspection.

### Accordion Investigation

**High priority**: Investigate why accordion appears on 86.2% of pages (7,296 / 8,468).

Possible scenarios:

- Used for FAQs, specs, features across most content pages
- Footer/header accordion elements counted site-wide
- Overly broad detection capturing non-accordion elements

Recommended query:

```sql
SELECT ui.url, dcu.evidence
FROM david_component_usage dcu
JOIN url_inventory ui ON dcu.url_id = ui.id
WHERE dcu.component_key = 'accordion'
LIMIT 20;
```

### Cross-Market Validation

Run analysis on JP/US markets (if available) to validate detection patterns.

---

## Document Metadata

**Created**: January 2026
**Status**: ARCHIVED - Pre-hardening analysis (not valid for conclusions)
**Superseded by**: Tool Hardening + Visual Proof workflow (see [docs/plan.md](../../docs/plan.md))
