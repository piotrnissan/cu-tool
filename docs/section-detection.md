# Section Detection — Heuristics & Pipeline

**Status**: Draft  
**Version**: 0.1.0  
**Last updated**: 2026-01-28  
**Parent document**: [sections.md](sections.md)

---

## Overview

This document describes **how to detect page sections** using visual and geometric signals, without relying on semantic HTML, CSS class names, or CMS metadata.

The goal is to produce a list of sections that match the [v0 Section Data Contract](sections.md).

---

## 1. Core principle: Visual-first, DOM-second

DOM is a **delivery mechanism**, not a design artifact.

The same visual section may be implemented as:

- One `<section>` element
- A `<div>` with arbitrary class names
- Multiple nested containers (wrappers, grids, inner/outer divs)
- Fragments spread across sibling elements

**We must detect sections based on what the user sees, not how the HTML is structured.**

DOM is used only to:

1. Obtain **bounding boxes** of elements
2. Detect **media presence** (images, videos)
3. Sample **computed background colors**

We do NOT use:

- Tag names as semantic signals (`<section>`, `<article>`, etc.)
- Class names or IDs
- ARIA roles for section detection (they are unreliable for layout)

---

## 2. Independent signals for section boundaries

Each signal below is computed independently. They are combined later.

### Signal A: Background color transitions

**What it detects**: Change in dominant background color along the Y-axis.

**How it works**:

1. Sample background color at regular vertical intervals (e.g., every 50–100px)
2. For each sample Y, find the outermost element(s) that span ≥80% of viewport width
3. Record computed `background-color` (resolve to RGB, ignore transparency for now)
4. Detect **sharp transitions** where color changes significantly (ΔE > threshold)

**Produces**: List of Y-coordinates where background color changes.

**Edge cases**:

- Gradients: Color changes smoothly → no hard boundary (mark as gradient zone)
- Transparent backgrounds: Walk up the DOM tree to find the first opaque ancestor
- Overlapping elements: Use the visually-topmost (highest z-index, last in paint order)

---

### Signal B: Full-width media (images, videos)

**What it detects**: Large images or videos that span the full viewport width.

**How it works**:

1. Query all `<img>`, `<video>`, `<picture>`, and elements with `background-image`
2. Filter to those where:
   - `width ≥ 90%` of viewport width, OR
   - `width ≥ 1200px` (absolute threshold for large screens)
3. Record the bounding box (top Y, bottom Y) of each

**Produces**: List of Y-ranges occupied by full-width media.

**Interpretation**:

- A full-width image/video usually indicates a **section boundary** at its top edge
- The media itself is often the **dominant visual** of that section
- Media that spans >600px height is likely a hero or major feature section

---

### Signal C: Large vertical gaps

**What it detects**: Significant vertical spacing between content blocks.

**How it works**:

1. Identify all "content boxes" — elements with visible content (text, images, interactive elements)
2. Compute vertical gaps between consecutive content boxes
3. Flag gaps that exceed a threshold (e.g., >80px)

**Produces**: List of Y-coordinates where large gaps occur.

**Interpretation**:

- Large gaps often indicate **section separation**
- But: Large gaps can also exist **within** a section (e.g., between heading and content)
- Combine with background signal for disambiguation

---

### Signal D: Container width changes

**What it detects**: Transition between full-width and constrained layouts.

**How it works**:

1. For each major content block, measure its width relative to viewport
2. Classify as:
   - `full_width`: ≥95% of viewport
   - `constrained`: Centered, with visible margins (typically 1200px max-width or similar)
3. Detect transitions where layout width changes significantly

**Produces**: List of Y-coordinates where width treatment changes.

**Interpretation**:

- Full-width → constrained transition often indicates a new section
- BUT: Many sections are full-width with constrained **inner** content
- This signal is weaker than background/media signals

---

### Signal E: Explicit container boundaries

**What it detects**: DOM elements that visually behave as section containers.

**How it works**:

1. Query all direct children of `<body>` or `<main>`
2. For each, check if:
   - Width ≥ 95% of viewport
   - Height ≥ 200px (non-trivial content)
   - Not a header, footer, or navigation (exclude by position/role heuristics)
3. Record top and bottom Y of each qualifying container

**Produces**: List of candidate section boundaries.

**Why this helps**:

- Even without semantic tags, CMS output often wraps sections in top-level divs
- This provides a **coarse initial segmentation** to refine with other signals

**Caveats**:

- Many CMSs add extra wrapper divs (noise)
- Some sections are split across multiple siblings (requires merging)

---

### Signal F: Visual rhythm / repetition

**What it detects**: Repeated patterns that suggest grid or card layouts.

**How it works**:

1. Find groups of elements with similar:
   - Bounding box dimensions (within 10% tolerance)
   - Similar Y-positions (horizontally aligned)
   - Regular horizontal spacing
2. If ≥3 elements match → likely a grid/card section
3. Record the bounding box of the entire group

**Produces**: Y-ranges that contain grid/card patterns.

**Interpretation**:

- Grid sections should NOT be split into multiple sections
- The entire card grid is ONE section, regardless of internal structure

---

## 3. Section detection pipeline

### Step 1: Collect all signals

Run signals A–F independently. Each produces a list of:

- Y-coordinates (boundaries), or
- Y-ranges (regions)

### Step 2: Build candidate boundaries

1. Start with **container boundaries** (Signal E) as coarse candidates
2. Add **background transition** points (Signal A)
3. Add **full-width media** top edges (Signal B)
4. Add **large gap** points (Signal C) — lower confidence

Create a sorted list of candidate Y-values.

### Step 3: Merge and filter boundaries

**Merge close boundaries**:

- If two candidate boundaries are within 50px, merge to the stronger signal
- Priority: background change > media edge > container edge > gap

**Remove spurious splits**:

- If a candidate boundary would create a section <150px tall → remove it
- If a grid pattern (Signal F) spans a candidate boundary → remove the boundary

### Step 4: Assign section properties

For each resulting section (Y-range):

1. **Determine `background_kind`**:
   - Check if full-width media exists → `image` or `video`
   - Check dominant background color:
     - Lightness >70% → `solid_light`
     - Lightness <30% → `solid_dark`
   - Check for gradient (color varies within section) → `gradient`
   - Multiple treatments → `mixed`
   - Can't determine → `unknown`

2. **Determine `layout_kind`**:
   - Check if grid pattern detected → `grid`
   - Check if all content is stacked vertically with no columns → `stacked`
   - Check container width: full viewport → `full_width`; centered with margins → `constrained`
   - Can't determine → `unknown`

3. **Compute `bbox`**:
   - x: 0 (sections are page-wide by definition)
   - y: Section top Y
   - width: Viewport width
   - height: Section bottom Y - top Y

### Step 5: Validate and output

- Ensure sections are contiguous (no gaps between them)
- Ensure sections cover the full page (from below header to above footer)
- Assign sequential `section_id` values

---

## 4. Handling hard cases

### Case 1: Full-width section with constrained inner content

**Problem**: The section spans edge-to-edge, but content is centered with margins.

**Solution**:

- `background_kind` is determined by the **outer** container (full-width)
- `layout_kind` may be `full_width` (if the visual impression is edge-to-edge) or `constrained` (if the content box dominates perception)
- Rule: If background is visually prominent (image, video, dark color) → `full_width`
- Rule: If background is neutral (white/light gray) and content is clearly boxed → `constrained`

---

### Case 2: Media split containing nested components

**Problem**: A 50/50 media split section contains a carousel on one side and a text block on the other.

**Solution**:

- This is **one section**, not multiple
- The nested carousel is a **component within** the section
- Section detection should NOT split at internal component boundaries
- Use grid/rhythm detection (Signal F) to identify when elements are **peers, not separate sections**

---

### Case 3: Long editorial section

**Problem**: A 3000px tall editorial section with multiple paragraphs, images, and pull quotes. Should NOT be split.

**Solution**:

- Check for **consistent background** throughout → no boundary
- Check for **consistent layout width** → no boundary
- Check that images are **inline** (not full-width) → no boundary
- Large gaps between paragraphs are expected → do NOT split on them
- Rule: If background and width are constant, keep as one section regardless of height

---

### Case 4: Hero vs. large promo banner

**Problem**: Both are full-width with big images. How to distinguish?

**Answer for v0**: We don't.

- Section detection does NOT classify sections semantically
- Both will be detected as sections with `background_kind: image` and `layout_kind: full_width`
- Semantic classification (hero vs. promo) is a **future task** (component detection or ML)

---

### Case 5: Mixed backgrounds within a section

**Problem**: A section has a gradient that transitions from dark to image.

**Solution**:

- If the transition is **within one visual unit** → keep as one section
- Mark as `background_kind: mixed`
- Signals: No hard color boundary (Signal A produces no spike), continuous container (Signal E)

---

### Case 6: Sticky/fixed elements overlapping sections

**Problem**: Sticky headers, floating CTAs, or chat widgets overlap section boundaries.

**Solution**:

- Exclude elements with `position: fixed` or `position: sticky` from section detection
- These are **chrome**, not content
- They should be filtered out before running the pipeline

---

### Case 7: Sections with internal tabbed or accordion content

**Problem**: A section contains tabs or an accordion. Expanded content changes section height.

**Solution for v0**:

- Run detection on the **current visual state**
- If content is collapsed, section height reflects collapsed state
- Dynamic content changes are **out of scope** for v0

---

## 5. Why this improves downstream work

### Better component detection

- Components are detected **within** section bounds → smaller search space
- We know the background context (dark/light) → can adjust component heuristics
- We know the layout (grid vs. stacked) → can choose appropriate component patterns
- False positives from adjacent sections are eliminated by boundaries

### Easier human QA

- Reviewers see **section boundaries** overlaid on screenshots → clear visual guide
- Sections are **countable** → "This page has 7 sections" is verifiable
- QA questions become concrete:
  - "Is this section boundary correct?"
  - "Is the background classification right?"
  - "Should these two sections be merged?"

### Enabling future learning

Without building ML now, we create the **data foundation**:

1. **Annotated sections** become training examples
2. **Section fingerprints** (bbox + background + layout) can be compared across pages
3. **QA corrections** feed back into heuristic tuning
4. **Section types** can be labeled later for supervised classification

The pipeline produces structured, consistent data — the hardest part of any ML project.

---

## 6. Implementation notes (non-binding)

These are suggestions, not requirements.

### Sampling strategy for background color

```
For Y from header_bottom to footer_top, step 100px:
  Find all elements at (viewport_center_x, Y)
  Walk from topmost to bottommost in paint order
  Record first opaque background-color
```

### Minimum section height

- Suggested threshold: 150px
- Rationale: Anything smaller is likely a separator/divider, not a section

### Grid detection threshold

- Minimum 3 elements
- Width variance <15%
- Height variance <20%
- Horizontal spacing variance <30%

### Confidence scoring (optional)

Each section could carry a `confidence` score (0–1) based on:

- Number of agreeing signals
- Strength of boundary signals
- Whether background is clearly classifiable

Low-confidence sections are flagged for human QA.

---

## 7. Open questions (not blocking v0)

1. **How to handle pages with no clear sections?** (e.g., single-scroll editorial)
   - Current answer: Treat entire content area as one section

2. **Should overlapping elements create sub-sections?**
   - Current answer: No. Overlaps are handled at component level.

3. **How to handle horizontal scrolling sections?**
   - Current answer: Out of scope for v0. Assume vertical scroll only.

4. **Should section detection run on mobile viewport too?**
   - Current answer: v0 targets desktop (1920px) only. Mobile is future work.

---

## 8. Relationship to existing component detection

Section detection **does not replace** component detection. It **precedes** it.

```
Page HTML
    ↓
[Section Detection] → List of Sections (bbox, background, layout)
    ↓
[Component Detection] → For each section, detect components within bounds
    ↓
[Visual Proof] → Annotated screenshot with sections + components
    ↓
[Human QA] → Verify / correct
```

Existing component detectors (`david-components.ts`) continue to work, but will be **scoped to sections** in future iterations.

---

## Summary

| Signal                      | Strength | What it catches                        |
| --------------------------- | -------- | -------------------------------------- |
| Background color transition | High     | Most section boundaries                |
| Full-width media            | High     | Hero, feature, promo sections          |
| Container boundaries        | Medium   | CMS-generated section wrappers         |
| Large vertical gaps         | Low      | Some section separations (noisy)       |
| Width changes               | Low      | Layout shifts (less reliable)          |
| Grid/rhythm patterns        | Medium   | Prevents false splits in card sections |

**Pipeline**: Coarse segmentation → boundary candidates → merge/filter → assign properties → validate.

**Hard cases**: Handled by combining signals and applying merge rules.

**Output**: Clean, countable, QA-able section list ready for component detection and human review.
