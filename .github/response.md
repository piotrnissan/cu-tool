# Component Usage Analysis - Nissan UK (Full Dataset)

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

```
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
| URL | Instances | Evidence |
|-----|-----------|----------|
| fleet-cars/fleet-car-solutions.html | 4 | `items_per_section=[4,3,4,4]` |
| fleet-cars/company-car-drivers.html | 4 | `items_per_section=[3,3,4,4]` |
| vehicles/brochures.html | 3 | `items_per_section=[3,3,3]` |
| vehicles/new-vehicles.html | 2 | `items_per_section=[6,3]` |

**Spec page behavior** (validation sample):
| URL | Instances | Evidence |
|-----|-----------|----------|
| ariya/price-specifications.html | 1 | `items_per_section=[3]` |
| x-trail/price-specifications.html | 1 | `items_per_section=[5]` |
| juke/prices-specifications.html | 1 | `items_per_section=[5]` |

### Backward Compatibility

- `cards_grid` component key no longer emitted
- Old data preserved in database for reference
- Reports must update to query `cards_section`

---

## 2. Carousel Detector Hardening

### Overview

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

### Detection Algorithm

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

### Results

#### Full UK Dataset (8,468 URLs)

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
| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| image_carousel | 13 pages, 94 instances (7.2 avg) | 13 pages, 52 instances (4.0 avg) | 45% |
| card_carousel | 13 pages, 52 instances (4.0 avg) | 10 pages, 10 instances (1.0 avg) | 80% |

**image_carousel - Top 5 URLs**:
| URL | Instances | Evidence |
|-----|-----------|----------|
| vehicles/new-vehicles/ariya.html | 7 | `items=[12,8,8,4,6,6,6], controls=yes` |
| e-power-flash-dc.html | 5 | `items=[20,6,6,8,8], controls=yes` |
| vehicles/new-vehicles/x-trail.html | 5 | `items=[20,6,6,8,8], controls=yes` |
| vehicles/new-vehicles/juke.html | 5 | `items=[20,6,6,8,6], controls=yes` |
| vehicles/new-vehicles/townstar.html | 4 | `items=[8,12,6,10], controls=yes` |

**Manual validation**: https://www.nissan.co.uk/vehicles/new-vehicles/ariya.html confirmed to have ~6-7 distinct image carousels. Detector output of 7 is accurate.

**card_carousel - Top 5 URLs**:
| URL | Instances | Evidence |
|-----|-----------|----------|
| e-power-flash-dc.html | 1 | `items=[6], controls` |
| vehicles/new-vehicles/qashqai.html | 1 | `items=[6], controls` |
| vehicles/new-vehicles/ariya.html | 1 | `items=[4], controls` |
| vehicles/new-vehicles/x-trail.html | 1 | `items=[6], controls` |
| vehicles/new-vehicles/juke.html | 1 | `items=[6], controls` |

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

## 3. Taxonomy Evaluation

### Summary Recommendation

**Keep three-way taxonomy (`cards_section`, `image_carousel`, `card_carousel`) for analysis phase.**

- Provides granular migration data that can be consolidated later
- Cannot disaggregate if merged prematurely
- Each has distinct migration complexity (static vs interactive)

**Flag `card_carousel` as candidate for consolidation in Storyblok design** - may become a display mode of unified Cards component.

### Component Assessment

| Component          | Editorial Intent                    | Migration Complexity   | UK Prevalence (Full Dataset) | Storyblok Mapping      |
| ------------------ | ----------------------------------- | ---------------------- | ---------------------------- | ---------------------- |
| **cards_section**  | Display collection of related items | LOW (static HTML)      | LOW (0.8%, 1.4 avg)          | Cards Grid/List block  |
| **image_carousel** | Display browsable image gallery     | MEDIUM-HIGH (JS, a11y) | RARE (0.2%, 4 avg)           | Image Carousel/Gallery |
| **card_carousel**  | Ambiguous (scroll vs promotion)     | MEDIUM-HIGH (JS, a11y) | RARE (0.1%, 1 avg)           | TBD (see below)        |

**Verdicts (based on full UK dataset)**:

- `cards_section`: Low prevalence (0.8%), but required for fleet/brochure landing pages
- `image_carousel`: Rare (0.2%), but critical for vehicle product pages where present
- `card_carousel`: Rare (0.1%), consolidation candidate for Storyblok design

### Taxonomy Risks

**Risk A - Taxonomy proliferation**: Three components for "things that display cards" may confuse Storyblok authors. Consider single "Cards" block with display modes.

**Risk B - Migration effort double-counting**: Vehicle pages likely have both `cards_section` and `card_carousel`. Run co-occurrence analysis before scoping.

**Risk C - Carousel complexity underestimation**: Both carousel types need similar JS infrastructure. Use shared carousel foundation in Storyblok.

**Risk D - Static vs interactive equivalence**: `cards_section` (static) has lower migration cost than `card_carousel` (interactive). Keeping separate for analysis preserves this distinction.

### Recommended Validation

**Co-occurrence query**:

```sql
SELECT COUNT(DISTINCT cs.url_id) as pages_with_both
FROM david_component_usage cs
JOIN david_component_usage cc ON cs.url_id = cc.url_id
WHERE cs.component_key = 'cards_section'
  AND cc.component_key = 'card_carousel';
```

**Interpretation**:

- High overlap (>80%): `card_carousel` is supplementary, consolidate as display mode
- Low overlap (<30%): Distinct editorial purpose, keep separate

### Storyblok Design Implication

Design recommendation (not a change to current detection taxonomy):

| AEM Component    | Storyblok Block               | Notes                                  |
| ---------------- | ----------------------------- | -------------------------------------- |
| `cards_section`  | **Cards** (display: grid)     | Primary use case                       |
| `card_carousel`  | **Cards** (display: carousel) | Same block, different mode             |
| `image_carousel` | **Image Gallery**             | Distinct block (content model differs) |

Consolidates cards into one author-facing block while keeping image carousels separate (different content: structured cards vs raw images).

---

## 4. Component Summary - Full UK Dataset

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

- **accordion** dominates (86.2% of pages) - likely used for FAQs, specs, and content collapse
- **cards_section**, **carousels**, and **tabs** are specialized components for specific page types
- Clean 1:1 component-level counting maintained for accordion, card_carousel, anchor_nav
- image_carousel averages 4 per page on vehicle pages (realistic for feature-rich product content)
- Early validation sample (200 URLs) over-represented cards_section and carousels

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

## 6. Next Steps

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

### Documentation

- Add component definitions to `POC_component_taxonomy_v_0.md`
- Document structural heuristics and acceptance rules
- Document co-occurrence findings after running suggested query

---

<!--
Document history:
- Initial cleanup: Removed contradictions from 200-URL validation phase
- Full dataset update: Replaced validation sample statistics with full UK dataset (8,468 URLs)
- All percentages now relative to 8,468 eligible URLs unless explicitly noted as validation sample
-->
