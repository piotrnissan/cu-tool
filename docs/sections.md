# Sections — v0 Data Contract

**Status**: Draft  
**Version**: 0.1.0  
**Last updated**: 2026-01-28

---

## 1. Section definition

A **Section** is the primary unit of visual segmentation on a web page.

From a design perspective, a section is:

- A **horizontal slice** of the page that spans edge-to-edge (or nearly so)
- Visually perceived as **a single, cohesive unit**
- Typically separated from adjacent sections by:
  - Background color change
  - Background image or video treatment
  - Vertical spacing or rhythm shift
- May **contain multiple UI components** (hero, card grids, media splits, etc.), but remains a single section

**Key insight**: Sections define the **macro layout** of a page. Components exist **within** sections.

Sections are what designers sketch first when wireframing. They represent the primary visual hierarchy before any component-level thinking happens.

**Assumptions**:

- ~90% of sections are full-width
- Sections may contain nested or overlapping components
- A single section may have multiple layout patterns inside it

---

## 2. Section data contract

```json
{
  "section_id": "string",
  "bbox": {
    "x": "number",
    "y": "number",
    "width": "number",
    "height": "number"
  },
  "background_kind": "enum (see below)",
  "layout_kind": "enum (see below)",
  "contains_components": ["string"] // optional
}
```

### Field descriptions

| Field                 | Type     | Required | Description                                                                                                      |
| --------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `section_id`          | string   | ✅       | Unique identifier for this section (e.g., `section_0`, `section_1`)                                              |
| `bbox`                | object   | ✅       | Page-relative bounding box (x, y, width, height in pixels)                                                       |
| `background_kind`     | enum     | ✅       | Visual background treatment (see enum)                                                                           |
| `layout_kind`         | enum     | ✅       | Overall layout structure (see enum)                                                                              |
| `contains_components` | string[] | ⚪       | Optional list of component IDs detected within this section (informational only; not used for section detection) |

---

## 3. Enums

### `background_kind`

Describes the **visual background treatment** of the section.

| Value         | Meaning                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `solid_light` | Solid light-colored background (white, off-white, light gray)          |
| `solid_dark`  | Solid dark-colored background (black, dark gray, dark blue)            |
| `gradient`    | Gradient background (any direction)                                    |
| `image`       | Static image background (photo, illustration, texture)                 |
| `video`       | Video background (autoplay, muted, looping)                            |
| `mixed`       | Multiple background treatments in the same section (rare but possible) |
| `unknown`     | Could not determine background treatment                               |

**Design note**: This enum replaces per-component fields like `dominant_bg` or `has_large_image`. Background treatment is a **section-level** property.

---

### `layout_kind`

Describes the **overall layout structure** of the section.

| Value         | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `full_width`  | Section spans edge-to-edge (most common)                           |
| `constrained` | Section content is centered with max-width constraint              |
| `grid`        | Section contains a visible grid layout (cards, tiles, etc.)        |
| `stacked`     | Section contains vertically stacked elements (text blocks, images) |
| `unknown`     | Could not determine layout structure                               |

**Design note**: These values are **descriptive, not prescriptive**. A section may be `full_width` and still contain a `constrained` content wrapper inside it. This field describes the **dominant visual impression**.

---

## 4. Design rationale

### Why section-first?

**Component detection has proven fragile** because:

- DOM structures vary wildly across pages and CMSs
- Nesting and wrapping patterns break selector-based detection
- Components are often split across multiple DOM subtrees
- No clear "entry point" for where to start detection

**Sections provide a stable foundation** because:

- Sections are **visually obvious** to humans (and easier to annotate)
- Sections are **layout-driven**, not DOM-driven
- Sections naturally align with **design process** (wireframes start with sections)
- Sections reduce false positives by providing clear **boundaries** for component detection

### Alignment with design perception

Designers think in layers:

1. **Page sections** (macro layout, rhythm, visual separation)
2. **Components** (hero, cards, media splits)
3. **Elements** (buttons, text, images)

Current component detection tries to solve layers 2 and 3 simultaneously, leading to ambiguity.

**Section-first segmentation respects this hierarchy.**

### Failure mode reduction

By detecting sections first:

- We establish **clear boundaries** before looking for components
- We reduce "spillover" (one component bleeding into another)
- We can **validate** that detected components fall within section bounds
- We enable **section-level QA** ("does this section make sense?") before component-level QA

### Enabling human QA + learning loops

Sections are:

- Easier to **annotate** (fewer, larger units)
- Easier to **verify** (visual bounding boxes)
- More **stable** across page refreshes or A/B tests
- A natural unit for **regression testing** (section count, section order)

Future: Section annotations can train models to predict `background_kind`, `layout_kind`, and component expectations per section type.

---

## 5. Explicit non-goals (v0)

This v0 contract intentionally **does NOT solve**:

❌ **Perfect semantic meaning**  
We do not attempt to classify sections as "hero", "product showcase", "testimonials", etc. That is a future classification task.

❌ **Nested component correctness**  
We do not enforce that all components are correctly detected or that they fall within section bounds. Sections are **informational** in v0.

❌ **Automatic section classification**  
We do not infer section "type" or "purpose". Sections are described by background and layout only.

❌ **Machine learning**  
No ML models are used in v0. Section detection may be rule-based, heuristic, or even manual (via visual proof tooling).

❌ **Cross-page section matching**  
We do not attempt to say "this section on Page A is the same as this section on Page B." Each page's sections are independent.

❌ **Component containment validation**  
We do not enforce that `contains_components` is exhaustive or correct. It is informational only.

---

## 6. Examples

### Example 1: Automotive VLP (Vehicle Landing Page)

```json
[
  {
    "section_id": "section_0",
    "bbox": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
    "background_kind": "image",
    "layout_kind": "full_width",
    "contains_components": ["hero_001"]
  },
  {
    "section_id": "section_1",
    "bbox": { "x": 0, "y": 1080, "width": 1920, "height": 800 },
    "background_kind": "solid_light",
    "layout_kind": "grid",
    "contains_components": ["cards_section_001"]
  },
  {
    "section_id": "section_2",
    "bbox": { "x": 0, "y": 1880, "width": 1920, "height": 600 },
    "background_kind": "video",
    "layout_kind": "full_width",
    "contains_components": ["media_text_split_001"]
  },
  {
    "section_id": "section_3",
    "bbox": { "x": 0, "y": 2480, "width": 1920, "height": 1200 },
    "background_kind": "solid_dark",
    "layout_kind": "stacked",
    "contains_components": ["accordion_001", "accordion_002"]
  }
]
```

**Notes**:

- Hero section has full-width image background
- Feature cards sit on a light background
- Video section showcases driving footage
- Dark section at bottom contains multiple accordions (FAQ, specs)

---

### Example 2: Editorial page (Electric Vehicles)

```json
[
  {
    "section_id": "section_0",
    "bbox": { "x": 0, "y": 0, "width": 1920, "height": 900 },
    "background_kind": "gradient",
    "layout_kind": "full_width",
    "contains_components": ["hero_001"]
  },
  {
    "section_id": "section_1",
    "bbox": { "x": 0, "y": 900, "width": 1920, "height": 1400 },
    "background_kind": "solid_light",
    "layout_kind": "constrained",
    "contains_components": [
      "text_block_001",
      "text_block_002",
      "media_text_split_001"
    ]
  },
  {
    "section_id": "section_2",
    "bbox": { "x": 0, "y": 2300, "width": 1920, "height": 700 },
    "background_kind": "image",
    "layout_kind": "full_width",
    "contains_components": ["cta_banner_001"]
  }
]
```

**Notes**:

- Gradient hero (brand treatment)
- Long-form editorial content in constrained layout on light background
- Full-width CTA with dramatic background image

---

### Example 3: Homepage

```json
[
  {
    "section_id": "section_0",
    "bbox": { "x": 0, "y": 0, "width": 1920, "height": 1200 },
    "background_kind": "video",
    "layout_kind": "full_width",
    "contains_components": ["hero_001"]
  },
  {
    "section_id": "section_1",
    "bbox": { "x": 0, "y": 1200, "width": 1920, "height": 950 },
    "background_kind": "solid_light",
    "layout_kind": "grid",
    "contains_components": ["cards_section_001"]
  },
  {
    "section_id": "section_2",
    "bbox": { "x": 0, "y": 2150, "width": 1920, "height": 650 },
    "background_kind": "solid_dark",
    "layout_kind": "full_width",
    "contains_components": ["media_text_split_001"]
  },
  {
    "section_id": "section_3",
    "bbox": { "x": 0, "y": 2800, "width": 1920, "height": 800 },
    "background_kind": "solid_light",
    "layout_kind": "grid",
    "contains_components": ["cards_section_002"]
  },
  {
    "section_id": "section_4",
    "bbox": { "x": 0, "y": 3600, "width": 1920, "height": 500 },
    "background_kind": "gradient",
    "layout_kind": "constrained",
    "contains_components": ["cta_banner_001"]
  }
]
```

**Notes**:

- Video hero (flagship treatment)
- Alternating rhythm: light → dark → light
- Multiple card sections (featured vehicles, news, etc.)
- Gradient CTA footer

---

## Next steps (not in scope for v0)

- Define section detection heuristics
- Build visual proof tooling for section annotations
- Validate section segmentation on baseline pages
- Design section-aware component detection
- Create section-level regression tests
