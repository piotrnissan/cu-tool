# QA UI Documentation

The **QA UI** (`/web/app/qa/page.tsx`) is a Next.js page for human labeling of component detections. It displays annotated screenshots and allows a QA operator to confirm, reject, or skip each detection using keyboard shortcuts.

---

## Purpose

Provide visual evidence + structured labeling workflow to:

1. Validate detector precision (confirm vs wrong ratio)
2. Identify false positives (wrong classifications)
3. Identify edge cases (operator skips uncertain cases)
4. Generate ground truth for regression gates

**NOT for**:

- Multi-user collaboration (single operator, local file system)
- ML training data (labels validate detectors, not for model training)
- Production deployment (dev-only tool)

---

## UX Requirements

### Single-User, Minimal Interaction

- **No login/auth**: Operator runs locally, no server-side sessions
- **No database**: All state in filesystem (manifest JSON + labels.jsonl)
- **No save button**: Labels append immediately after each action
- **Keyboard-first**: All actions via hotkeys (no mouse clicks required)

### Display

- **Full-page screenshot**: Display `.annotated.png` at actual size (scrollable viewport)
- **Current detection panel**: Show component_key, bbox, locator, note for highlighted element
- **Component selection dropdown**: Fixed list (shown when `w` pressed): hero, promo_section, media_text_split, info_specs, next_action_panel, image_carousel, card_carousel, cards_section, accordion, tabs, anchor_nav, "None / False positive", "Other" (with optional text field)
- **Variant field dropdowns** (conditional):
  - If correcting to media_text_split: dropdown for media_type (image|video|carousel)
  - If correcting to cards_section or card_carousel: dropdown for card_type (model_grade|accessory|offer|generic)
- **Progress counter**: `N of M components labeled` (e.g., "5 of 23")
- **Hotkey legend**: Always visible (c=confirm, w=wrong, s=skip, n=next)

### Workflow

```text
1. Load first URL from manifest list
2. Display annotated screenshot + first highlight
3. Operator presses hotkey:
   - 'c' → Append {"label":"confirm"} to labels.jsonl, auto-advance to next highlight
   - 'w' → Show component selection dropdown:
     • Operator selects correct type from fixed list (11 v1 types + "None" + "Other")
     • If media_text_split selected: show media_type dropdown (image|video|carousel)
     • If cards_section or card_carousel selected: show card_type dropdown (model_grade|accessory|offer|generic)
     • If "Other" selected, optional text field appears (max 100 chars)
     • Append {"label":"wrong", "corrected_component_key":"<selected>", "media_type":"<if_applicable>", "card_type":"<if_applicable>", "note":"<optional>"} to labels.jsonl
     • Auto-advance to next highlight
   - 's' → Append {"label":"skip"} to labels.jsonl, auto-advance
   - 'n' → No label (skip without recording), advance to next
4. If last highlight on page:
   - Load next URL's screenshot + manifest
   - Reset to first highlight
5. If last URL:
   - Show "Labeling complete" message
   - Display summary stats (total labels, confirm/wrong/skip counts)
```

---

## Operator Guidelines

Critical rules for consistent labeling:

- **Hero vs promo**: ONLY the primary top-of-page hero is labeled `hero`. Any hero-like block lower in the page should be labeled as `promo_section` or `media_text_split` depending on structure.
- **Nested carousel no-double-count**: If a carousel exists within a media_text_split (2-column layout with media on one side), label it as `media_text_split` with `media_type=carousel`. Do NOT label it again as standalone `image_carousel` or `card_carousel`.
- **Modal/popup exclusion**: Detections inside modals ([role="dialog"], [aria-modal="true"]) should NOT appear in proof pack. If you see one, mark as "None / False positive" with note "modal content".
- **Cards_section vs grid**: `cards_section` is a content section with ≥3 card-like items (link+heading+media), NOT AEM layout grids. If detection is just a grid wrapper with no content, mark as wrong.
- **Accordion footer**: Accordions in footer ([role="contentinfo"]) should be excluded. If you see footer accordion, mark as "None / False positive".
- **Tabs mega-nav**: Tabs in global mega-nav should be excluded. Only count content tabs.
- **Anchor_nav location**: Anchor navigation must be in content flow. If in header/footer, mark as "None / False positive".
- **When uncertain**: Use `s` (skip) rather than guessing. Skipped labels don't affect precision calculation.

---

## Keyboard Shortcuts

| Key | Action   | Behavior                                                   |
| --- | -------- | ---------------------------------------------------------- |
| `c` | Confirm  | Label detection as correct, auto-advance                   |
| `w` | Wrong    | Show dropdown, operator selects correct type, auto-advance |
| `s` | Skip     | Label as uncertain, record skip                            |
| `n` | Next     | Skip without label (no JSONL append)                       |
| `←` | Previous | Go back to previous highlight (no undo)                    |
| `→` | Next     | Same as `n` (skip without label)                           |

**Implementation Notes**:

- Prevent default browser shortcuts (e.g., `n` = open new window, `s` = save page)
- Use `window.addEventListener('keydown', handler)` with `event.preventDefault()`
- No input fields on page (avoid focus issues)

---

## Current Detection Info Panel

**Location**: Fixed sidebar (right side) or bottom bar

**Contents**:

- **Component Key**: `image_carousel` (styled as pill/badge)
- **Bounding Box**: `x: 0, y: 6229.66, width: 1920, height: 811.41`
- **Locator**: `section.wds-carousel-section`
- **Note**: `Detected carousel with 20 images`
- **Progress**: `5 of 23 components labeled`

**Visual Cue**: Highlight current detection on screenshot (flash border, or zoom to bbox)

---

## Labels Output (JSONL Format)

**File**: `analysis/artifacts/visual-proof/labels.jsonl`

**Format**: Append-only, one JSON object per line (NO array wrapper)

**Write Strategy**:

1. On label action (`c`, `w`, `s`):
   - Construct JSON object: `{url, component_key, bbox, label, timestamp}`
   - Append to labels.jsonl: `fs.appendFileSync(path, JSON.stringify(obj) + '\n')`
   - Auto-advance to next highlight
2. No batch writes (immediate append after each action)
3. Use atomic writes if possible (temp file + rename)

**Example labels.jsonl**:

```jsonl
{"url":"https://www.nissan.co.uk/vehicles/new-vehicles/juke.html","component_key":"image_carousel","bbox":{"x":0,"y":6229.65625,"width":1920,"height":811.40625},"label":"confirm","timestamp":"2026-01-20T15:10:42.456Z"}
{"url":"https://www.nissan.co.uk/vehicles/new-vehicles/juke.html","component_key":"image_carousel","bbox":{"x":0,"y":8450.125,"width":1920,"height":450.5},"label":"confirm","timestamp":"2026-01-20T15:10:45.789Z"}
{"url":"https://www.nissan.co.uk/vehicles/new-vehicles/juke.html","component_key":"card_carousel","bbox":{"x":0,"y":12100.5,"width":1920,"height":520.25},"label":"wrong","timestamp":"2026-01-20T15:11:02.123Z"}
```

---

## File Persistence (Browser Refresh)

**Problem**: Browser refresh loses in-memory state (current URL, current highlight index).

**Solution**:

1. Store progress in localStorage: `{currentUrlIndex, currentHighlightIndex}`
2. On page load: Read localStorage, resume from saved position
3. On label action: Update localStorage before appending to JSONL

**Alternative**: Read labels.jsonl on page load, compute progress from existing labels (skip already-labeled highlights).

---

## No Network Requests (Local File Writes Only)

**Constraint**: QA UI must work offline, no API calls.

**Implementation**:

- Use Node.js filesystem APIs (Next.js server actions or API routes)
- `fs.appendFileSync()` for JSONL appends
- `fs.readFileSync()` for manifest JSON + screenshot loading

**File Paths**:

- Manifests: `analysis/artifacts/visual-proof/full/<slug>/<slug>.manifest.json`
- Screenshots: `analysis/artifacts/visual-proof/full/<slug>/<slug>.annotated.png`
- Labels: `analysis/artifacts/visual-proof/labels.jsonl`

**Next.js Server Action Example**:

```typescript
// app/qa/actions.ts (Server Action)
"use server";
import fs from "fs";
import path from "path";

export async function appendLabel(label: Label) {
  const labelsPath = path.join(
    process.cwd(),
    "analysis/artifacts/visual-proof/labels.jsonl",
  );
  const line = JSON.stringify(label) + "\n";
  fs.appendFileSync(labelsPath, line, "utf8");
}
```

---

## Labeling Guidelines (for Operator)

**Confirm** (`c`):

- Detection is correct AND correctly classified
- Example: Image carousel with 20 images → labeled as `image_carousel` ✅

**Wrong** (`w`):

- Detection is incorrect OR incorrectly classified
- Examples:
  - False positive: Footer link section labeled as `cards_section` ❌
  - Misclassification: Card carousel labeled as `image_carousel` ❌
  - Not a component: Random `<details>` tag in content labeled as `accordion` ❌

**Skip** (`s`):

- Uncertain, need more context
- Example: Carousel with mix of images + text cards (ambiguous split logic)

**Next** (`n`):

- Visual inspection only, no label recorded
- Use for quick browsing or re-reviewing previous labels

---

## UI Layout (Wireframe)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: QA Labeling Tool                                     │
│ [juke] 5 of 23 components labeled                            │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────────────┬──────────────────────────────┐
│                              │  Current Detection           │
│                              │  ───────────────────         │
│                              │  Component: image_carousel   │
│  Screenshot                  │  Locator: section.wds-...    │
│  (scrollable viewport)       │  Bbox: x:0 y:6229 w:1920...  │
│                              │  Note: Detected carousel...  │
│  [Image shows full page      │                              │
│   with colored bounding      │  ───────────────────         │
│   boxes highlighting         │  Hotkeys:                    │
│   detected components]       │  c - Confirm                 │
│                              │  w - Wrong                   │
│                              │  s - Skip                    │
│                              │  n - Next (no label)         │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

**Responsive**: On narrow screens, stack screenshot + panel vertically.

---

## Performance Expectations

**Single label action**:

- Append to JSONL: ~1-5ms (filesystem write)
- Update UI (auto-advance): ~10-50ms (React re-render)
- **Total**: < 100ms (feels instant)

**Full labeling session (200-300 labels)**:

- Average time per label: 2-5 seconds (visual inspection + decision)
- **Total**: 10-25 minutes (with breaks)

**Optimization**: Preload next screenshot while operator labels current one (background image loading).

---

## Error Handling

### JSONL Write Failure

**Symptom**: `fs.appendFileSync()` throws error (disk full, permissions, etc.)

**Mitigation**:

1. Show error toast: "Failed to save label, retrying..."
2. Retry up to 3 times with 1-second delay
3. If all retries fail: Block further labeling, show error message

**Recovery**: Operator can manually append label to JSONL using text editor (last resort).

### Manifest JSON Not Found

**Symptom**: Screenshot exists, but manifest JSON missing

**Mitigation**:

1. Skip URL, log warning
2. Continue with next URL
3. Document missing manifests in QA notes

### Screenshot File Too Large

**Symptom**: Browser struggles to render 5MB+ PNG files

**Mitigation**:

1. Compress PNGs during runner phase (pngquant, lossy compression)
2. Target < 1MB per screenshot
3. Use progressive loading (blur-up placeholder)

---

## Related Documentation

- [Data Contracts](data-contracts.md) — Labels JSONL schema
- [Overview](overview.md) — Full workflow
- [Quality Gates](quality-gates.md) — How labels are used for validation
