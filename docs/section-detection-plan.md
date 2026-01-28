# Section Detection v0 — Execution Plan

**Status**: Draft  
**Version**: 0.1.0  
**Last updated**: 2026-01-28  
**Related docs**: [sections.md](sections.md), [section-detection.md](section-detection.md)

---

## Goal

Detect page sections on real production automotive/marketing pages with **sufficient accuracy** to serve as boundaries for downstream component detection and human QA.

Success for v0 means:

- **6 baseline pages** (UK Nissan: 3 VLP + 2 editorial + 1 homepage) are correctly segmented into sections
- Each section has a `section_id`, `bbox`, `background_kind`, and `layout_kind`
- Section boundaries are visually obvious and match human intuition when overlaid on screenshots
- **Zero unintentional splits** in hero, card grid, or editorial content sections
- Human QA can verify section correctness in <30 seconds per page

We are NOT optimizing for perfect classification or scale. We are proving the concept works on known pages.

---

## Non-goals

v0 explicitly does NOT attempt to:

❌ **Semantic section classification** — We do not label sections as "hero", "testimonials", "CTA", etc.  
❌ **Component containment enforcement** — We do not validate that components fall within section bounds.  
❌ **Multi-viewport support** — Desktop only (1920px).  
❌ **Dynamic content handling** — No lazy-loaded images, no accordion expansion, no tab switching.  
❌ **Cross-page section matching** — We do not say "this section on Page A equals this section on Page B."  
❌ **Automated correction** — Human QA identifies issues; we do not auto-fix them in v0.  
❌ **Scale optimization** — We are not building for 1000+ pages yet.

---

## Constraints

### Viewport

- Desktop only: 1920×1080 viewport
- No mobile, tablet, or responsive breakpoints

### Data sources

- Existing HTML cache (`api/data/html/UK/*.html.gz`)
- Existing screenshot generation pipeline (Playwright)
- No external APIs, no CMS metadata

### Performance

- Section detection must complete in <5 seconds per page (not optimized, but must be usable)
- Detection runs server-side (Node.js / TypeScript)

### QA assumptions

- Human reviewers have design/UI literacy
- QA is visual (screenshot + overlays), not DOM inspection
- QA happens AFTER detection, not during

### Technical assumptions

- DOM is available (parsed HTML)
- Computed styles are available (via headless browser)
- Bounding boxes can be extracted (via browser APIs)

---

## Phase 0 — Scope lock

Before writing any detection code, freeze these decisions:

### Page scope

- **Exactly 6 pages** from UK Nissan baseline:
  - `vlp-ariya`
  - `vlp-juke`
  - `vlp-qashqai`
  - `editorial-electric-vehicles`
  - `editorial-owners`
  - `homepage`

These pages represent the **canonical test set** for v0. No other pages are in scope.

### Section data contract

- Fields are frozen per [sections.md](sections.md):
  - `section_id` (string)
  - `bbox` (x, y, width, height)
  - `background_kind` (enum: 7 values)
  - `layout_kind` (enum: 5 values)
  - `contains_components` (optional, informational only)

### Excluded zones

- Header/navigation (above first meaningful content)
- Footer (below last meaningful content)
- Cookie banners, modals, sticky elements (fixed/sticky positioning)

These are **chrome**, not content. They are filtered out before detection runs.

### Output format

- JSON file per page: `{slug}.sections.json`
- Stored in `analysis/artifacts/visual-proof/full/{slug}/`
- Human-readable, diff-friendly

### Why lock scope now

Prevents scope creep during implementation. If detection fails on these 6 pages, adding more pages won't help. If it succeeds, we scale later.

---

## Phase 1 — Minimal signals

Implement **exactly 3 signals**, no more:

### Signal A: Background color transitions

- Sample background color every 100px vertically
- Detect transitions where ΔE (color distance) exceeds threshold
- Produces: Y-coordinates where background changes

**Z-index handling** (critical):

- When sampling at (x, y), query `elementsFromPoint(x, y)`
- Walk from topmost to bottommost in paint order
- Return first element with opaque `background-color` (alpha ≥ 0.9)
- If all elements are transparent → mark as `unknown` background
- This prevents false classifications on gradient overlays and transparent text containers

**Why this signal**: Most reliable boundary indicator. Background changes are how designers separate sections.

### Signal B: Full-width media (images only)

- Find all `<img>` and elements with `background-image`
- Filter to width ≥90% of viewport
- Produces: Y-ranges occupied by large images

**Why this signal**: Heroes and feature sections always have full-width images. High signal-to-noise ratio.

### Signal C: Explicit container boundaries

- Query direct children of `<body>` or `<main>`
- Filter to width ≥95% viewport, height ≥200px
- Exclude header/footer by position heuristics
- Produces: Top/bottom Y of each candidate container

**Why this signal**: Even bad CMSs wrap sections in top-level divs. This provides coarse initial segmentation.

### What we are NOT implementing yet

- Video detection (deferred)
- Gradient detection (deferred)
- Grid/rhythm patterns (deferred)
- Vertical gap analysis (too noisy)
- Container width changes (too weak)

**Rationale**: Start with the strongest signals. Add complexity only if needed.

---

## Phase 2 — Boundary merge & filtering

Combine the 3 signals into a single boundary list.

### Step 1: Candidate boundaries

- Collect all Y-coordinates from Signals A, B, C
- Sort ascending
- Each Y is a candidate section boundary

### Step 2: Prioritization

When multiple signals produce close Y-values (<50px apart):

1. Background color transition (Signal A) — highest priority
2. Full-width image top edge (Signal B) — second priority
3. Container boundary (Signal C) — lowest priority

Merge to the highest-priority signal.

### Step 3: Remove spurious splits

- If a candidate boundary creates a section <150px tall → remove it
- If a candidate boundary falls within 50px of a stronger boundary → merge

### Step 4: Validate contiguity

- Sections must be contiguous (no gaps)
- Sections must cover from first content to last content (exclude header/footer)

**Output**: Sorted list of Y-coordinates defining section boundaries.

---

## Phase 3 — Section properties

For each section (defined by Y-range), assign properties.

### Assign `background_kind`

1. Check if full-width image exists in section → `image`
2. Sample dominant background color:
   - Lightness >70% → `solid_light`
   - Lightness <30% → `solid_dark`
   - Otherwise → `unknown`
3. If no clear winner → `unknown`

**Deferred for v0**: `gradient`, `video`, `mixed` (detect as `unknown` for now).

### Assign `layout_kind`

1. Check if section width ≥95% viewport → `full_width`
2. Check if inner content is centered with visible margins → `constrained`
3. If unclear → `unknown`

**Deferred for v0**: `grid`, `stacked` (detect as `unknown` for now).

### Assign `bbox`

- `x`: 0 (sections are page-wide)
- `y`: Section top Y
- `width`: 1920 (viewport width)
- `height`: Section bottom Y - section top Y

### Assign `section_id`

- Sequential: `section_0`, `section_1`, ..., `section_N`
- Ordered top-to-bottom by Y position

### Assign `contains_components` (optional)

- Leave empty in v0
- This field is populated by downstream component detection (future work)

---

## Phase 3.5 — Dry-run validation

Before generating screenshots, validate detection output programmatically.

### For each page, verify:

1. **Section count is reasonable**: 3–15 sections (flag if 0, 1, 2, or >20)
2. **Y-positions are monotonically increasing**: No overlaps, no negative heights
3. **No degenerate sections**: All sections ≥150px and ≤3000px tall
4. **Boundaries are within page bounds**: First section Y ≥ header bottom, last section Y ≤ footer top

### If any page fails validation:

- Output section JSON to console for inspection
- Debug detection logic before proceeding to screenshots
- Do NOT generate visual proof for broken output

**Impact**: Catches implementation bugs before visual proof step. Saves 1–2 debugging cycles.

---

## Phase 4 — Visual proof integration

Sections must be visible in the visual proof pipeline.

### Screenshot overlays

- Render section boundaries as **horizontal lines** on screenshots
- Label each section with `section_id` and `background_kind`
- Use color-coding:
  - `solid_light` → blue
  - `solid_dark` → yellow
  - `image` → green
  - `unknown` → red

### Manifest updates

Extend `{slug}.manifest.json` to include:

```json
{
  "url": "...",
  "viewport": { ... },
  "sections": [
    { "section_id": "section_0", "bbox": { ... }, "background_kind": "image", "layout_kind": "full_width" }
  ],
  "detections": [ ... ]
}
```

### Why this matters

- Human QA needs to **see** sections to verify them
- Overlays make section boundaries obvious
- Misclassifications (wrong `background_kind`) are immediately visible

---

## Phase 5 — Manual QA sanity pass

Run detection on all 6 baseline pages. Generate annotated screenshots.

### QA calibration (before full review)

Before reviewing all 6 pages, lead engineer + 1–2 reviewers **jointly review 1 page** (`vlp-ariya`).

For each detected boundary, discuss:

- Should this be a boundary? Why or why not?
- Is `background_kind` correct?
- Would you split or merge any sections?

**Document 3–5 examples** of "correct" and "incorrect" boundaries.
Use these as a **calibration guide** for remaining 5 pages.

**Why calibration matters**:

- Reduces inter-reviewer disagreement
- Surfaces ambiguous cases early (before they become QA failures)
- Creates concrete reference for future QA rounds

### Human reviewers verify:

1. **Section count**: Does the number of sections feel right?
2. **Section boundaries**: Are boundaries placed where you'd expect visual separation?
3. **Background classification**: Does `background_kind` match what you see?
4. **Obvious errors**: Are there unintentional splits in heroes or card grids?

### Reviewers do NOT fix:

- Component detection issues (out of scope)
- `layout_kind` misclassification (informational only in v0)
- Minor boundary position errors (<20px off)
- Edge cases on non-baseline pages

### QA pass/fail criteria

**Pass**: ≥4 of 6 pages have correct section boundaries and no major splits.  
**Fail**: ≥3 pages have major errors (hero split, card grid split, wildly wrong count).

### What happens if QA fails

- Review signal thresholds (color ΔE, width %, height minimums)
- Check if excluded zones (header/footer) are correct
- Add one targeted fix per failure mode
- Re-run detection and QA

Do NOT add new signals or refactor the pipeline. Fix the existing logic.

---

## Phase 6 — Decision point

After QA pass, choose next step based on outcomes:

### Outcome A: All 6 pages pass cleanly

→ **Expand scope** to 10–15 additional UK pages.  
→ Test generalization before adding complexity.

### Outcome B: 5–6 pages pass, minor issues only

→ **Document known limitations** (e.g., gradient sections marked as `unknown`).  
→ Proceed to integrate with component detection.

### Outcome C: 3–4 pages pass, systematic failures

→ **Add one missing signal** (likely grid/rhythm detection to prevent false splits).  
→ Re-run QA on baseline pages only.

### Outcome D: <3 pages pass

→ **Stop and debug**. Signals are not working as expected.  
→ Manually inspect DOM + screenshots for one failing page.  
→ Identify root cause before continuing.
→ If root cause requires >1 day fix or architectural change → **declare v0 failed** and document why.

### Outcome E: Pages fail for different root causes

Example: VLP pages fail because heroes are videos (Signal B doesn't fire), while editorial pages fail because inline images create false splits (Signal B fires too often).

→ **Group pages by failure pattern**.
→ Implement targeted fix for the **largest group only**.
→ Accept that smallest group may remain broken in v0.
→ Document which pages are deferred and why.

**No speculative work**. Each decision is based on evidence from the 6 baseline pages.

---

## Why this plan is intentionally conservative

### Staged approach reduces risk

- Each phase produces a **verifiable artifact** (boundaries, properties, screenshots)
- If a phase fails, we know exactly where the problem is
- No "build everything and hope it works" risk

### Minimal signals first

- Complex detection systems fail in complex ways
- 3 strong signals beat 6 mediocre signals
- Adding signals is easy; removing them is painful

### Human QA as a gate

- Automated metrics can't catch "this boundary feels wrong"
- Designers/analysts have the ground truth in their heads
- QA forces us to produce **visually correct** output, not just technically valid JSON

### No premature optimization

- We don't know which signals matter most yet
- We don't know which pages are hardest yet
- v0 is **learning**, not shipping to production

### Section-first is unproven

- This is a new approach for this codebase
- We must validate it works before scaling
- 6 pages is enough to prove or disprove the model

---

## Exit criteria for v0

v0 is **done** when ALL of the following are true:

✅ **Detection code is implemented** for Signals A, B, C and the merge/filter pipeline.  
✅ **6 baseline pages** have section JSON files in `analysis/artifacts/visual-proof/full/{slug}/`.  
✅ **Annotated screenshots** show section boundaries overlaid on all 6 pages.  
✅ **≥4 of 6 pages pass QA** (correct boundaries, no major splits, reasonable `background_kind`).  
✅ **Known limitations are documented** in a `KNOWN_ISSUES.md` or inline comments.  
✅ **Section data is consumed** by at least one downstream tool (e.g., visual proof manifest or component detector).

**Why 4/6 not 5/6**: Realistic expectation given automotive page complexity (gradients, overlays, video heroes). Grid/rhythm signal will likely be needed for remaining pages — that's expected learning, not failure.

v0 is **not done** if:

- Detection runs but QA hasn't reviewed output
- Output exists but isn't visually verifiable (no screenshots)
- Code works on 2 pages but crashes on others
- Exit criteria are "mostly" met (all criteria must be 100% met)

---

## Next steps after v0

Not in scope for this plan, but acknowledged:

1. **v1**: Add grid/rhythm detection to prevent false splits in card sections
2. **v1**: Support `gradient` and `video` background detection
3. **v1**: Expand to 20–30 UK pages
4. **v2**: Integrate section detection into component detection pipeline
5. **v2**: Build QA correction UI (annotate section boundaries)
6. **v3**: Multi-market support (DE, FR, etc.)

Each version builds on validated learnings from the previous one.
