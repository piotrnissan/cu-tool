# Proof Runner Documentation

The **Proof Runner** (`analysis/visual-proof/runner/full.ts`) renders bounding box overlays on live pages using detections from JSON export. It does NOT re-run detectors — it queries the DOM using a locator strategy to find elements corresponding to DB detections.

---

## Execution Flow

```text
1. Load detections.json
2. For each URL:
   a. Launch Playwright browser (chromium, 1920x1080 viewport)
   b. Navigate to URL (wait for domcontentloaded + network idle)
   c. Dismiss cookie overlay (best-effort)
   d. For each component detection in JSON:
      i.   Query DOM using locator strategy
      ii.  Filter out global chrome elements
      iii. Compute bounding boxes (document coordinates)
      iv.  Validate visibility (height/width/y-range)
      v.   Inject colored overlay divs
   e. Capture full-page screenshot (.annotated.png)
   f. Generate manifest JSON (bbox coordinates + locators)
   g. Close browser
3. Save outputs to analysis/artifacts/visual-proof/full/<slug>/
```

---

## Locator Strategy

Maps `component_key` (from detections.json) to CSS selector patterns. Each component type has a specific query.

**Important**: The locator strategy is **permissive by design**. It may find more or fewer instances than the detector reported. Accuracy is validated later via human QA + quality gates (Phase 5-6), not during runner execution.

**Content Root**: Queries are scoped to the page's main content area (typically `<main>`, `[role="main"]`, or `<body>` as fallback). Elements inside global chrome containers (header/nav/footer) are filtered out post-query.

### Component-to-Selector Mapping (v1 Model)

| Component Key       | CSS Selector Pattern                                              | Notes                                                              |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `hero`              | `.hero, section.hero, [class*="hero-banner"]`                     | Top-of-page hero only (exclude hero-like blocks lower in page)     |
| `promo_section`     | `section[class*="promo"], [class*="banner"]`                      | Campaign/banner sections NOT at top                                |
| `media_text_split`  | `section[class*="split"], [class*="media-text"]`                  | 2-column layout with media + text; check for nested carousel       |
| `info_specs`        | `[class*="specs"], [class*="key-facts"]`                          | Spec strip with 3–6 items (value+label pairs)                      |
| `next_action_panel` | `[class*="next-steps"], [class*="action-panel"]`                  | Conversion CTA hub with 3–6 actions                                |
| `image_carousel`    | `[class*="swiper"], [class*="carousel"], [class*="slider"]`       | Must contain ≥1 `<img>` child, NOT inside media_text_split         |
| `card_carousel`     | `[class*="swiper"], [class*="carousel"], [class*="slider"]`       | Must contain ≥1 heading (h1-h6) child, NOT inside media_text_split |
| `cards_section`     | `section, div.cards, [class*="card-grid"]`                        | Container with ≥3 card-like items (link + heading/media)           |
| `accordion`         | `[class*="accordion"], details, [role="region"][aria-labelledby]` | Includes native `<details>` and ARIA accordions (NOT role="tab")   |
| `tabs`              | `[role="tablist"]`                                                | ARIA role for tab interfaces (exclude mega-nav)                    |
| `anchor_nav`        | `nav[class*="anchor"], [class*="page-nav"]`                       | In-page navigation (content flow only, exclude header/footer)      |

### Locator Strategy Robustness

**Problem**: Class names may change between POC detector implementation and production validation (CSS refactoring, framework upgrades).

**Solution**: Use a **hybrid locator strategy** combining structural selectors with class-based patterns.

**Locator Hierarchy**:

1. **Primary (most stable)**: ARIA roles (`[role="tablist"]`, `[role="contentinfo"]`) + HTML5 semantic elements (`header`, `nav`, `footer`, `section`)
2. **Secondary (stable but fallible)**: Class prefixes / patterns (`[class*="swiper"]`, `[class*="accordion"]`, `[class*="tabs"]`)
3. **Tertiary (optional signal)**: data-\* attributes (`[data-component]`, `[data-testid]`) — NOT guaranteed across all markets/pages

**Failure Handling**: If a locator fails to find a component on a proof page:

- Log warning: `"Locator failed for {component_key} on {url}"`
- Continue processing remaining components (do NOT abort)
- Include failed locator in manifest as `{"locator_status": "not_found"}`

**Example — Accordion Locator**:

```typescript
// Primary: ARIA role (most stable)
const accordionByRole = page
  .locator('[role="region"][aria-labelledby]')
  .first();

// Secondary: Class pattern (fallback if role missing)
const accordionByClass = page
  .locator('[class*="accordion"], [class*="collapsible"]')
  .first();

// Locator hierarchy
const accordion =
  (await accordionByRole.count()) > 0 ? accordionByRole : accordionByClass;
```

### Carousel Split Logic

**Problem**: Both `image_carousel` and `card_carousel` use similar DOM structures (swiper/carousel classes).

**Solution**: Inspect children to determine type:

- **Image carousel**: Contains ≥1 `<img>` element → visual gallery
- **Card carousel**: Contains ≥1 heading (h1, h2, h3, h4, h5, h6) → content cards

**Precedence**: If BOTH images and headings present, classify as `card_carousel` (more structured content).

---

## Global Chrome & Modal Exclusion Rules

**Problem**: Global chrome (header, nav, footer) and modal/popup surfaces can contain components that should NOT be counted as page content components in baseline analysis.

**Solution**: Filter out elements that are children of global chrome containers or modal dialogs.

### Exclusion Selectors (v1 Baseline)

```css
/* Global Chrome */
header,
nav,
footer,
[role="contentinfo"],
[role="banner"],
[role="navigation"],

/* Modals & Popups */
[role="dialog"],
[aria-modal="true"],

/* Cookie Consent */
#onetrust-consent-sdk,
.onetrust-pc-dark-filter,

/* Nissan-specific Mega-nav */
.meganav-container,
[class*="c_010D"]
```

### Modal/Popup Exclusion Policy (v1)

**Rationale**: Modals require scripted interactions (click to open) and have separate denominators from baseline page content. Including modal content in baseline detections leads to:

- Double counting (modal components also exist on page)
- Interaction-dependent content (not visible by default)
- Inconsistent results across pages (some modals open, some closed)

**v1 Baseline Rule**: All DOM under `[role="dialog"]` and/or `[aria-modal="true"]` is excluded from:

- Detector runs (component detection phase)
- Visual proof overlays (screenshot annotation)
- QA labeling (proof pack validation)

**v2 Track (Out-of-Scope)**: Modal analysis can be added as separate workstream with:

- Scripted interactions to open modals
- Separate denominator (modals per page, not pages with modals)
- Separate quality gates

**Cookie Consent Handling**: Cookie/consent overlays may be dismissed for screenshot clarity (one-time dismiss), but modal interiors (e.g., settings panels, privacy details) are NOT analyzed in v1.

### Implementation

```typescript
function isInsideGlobalChrome(element: Element): boolean {
  const globalChromeSelectors = [
    "header",
    "nav",
    "footer",
    '[role="contentinfo"]',
    '[role="banner"]',
    '[role="navigation"]',
    '[role="dialog"]',
    '[aria-modal="true"]',
    "#onetrust-consent-sdk",
    ".meganav-container",
    '[class*="c_010D"]',
  ];

  return globalChromeSelectors.some((selector) => {
    return element.closest(selector) !== null;
  });
}
```

**Usage**: After querying DOM with locator pattern, filter results:

```typescript
const candidates = page.locator('[class*="swiper"]');
const validElements = await candidates.filter(
  (el) => !isInsideGlobalChrome(el),
);
```

---

## Bounding Box Computation

**Problem**: `getBoundingClientRect()` returns **viewport-relative** coordinates. If element is scrolled past, `rect.y` is negative. We need **document coordinates** (always positive).

**Solution**: Add scroll offsets to convert viewport coords to document coords.

```typescript
async function getBoundingBox(element: ElementHandle): Promise<BoundingBox> {
  const rect = await element.boundingBox(); // Viewport-relative
  const scrollX = await page.evaluate(() => window.scrollX);
  const scrollY = await page.evaluate(() => window.scrollY);

  return {
    x: rect.x + scrollX,
    y: rect.y + scrollY,
    width: rect.width,
    height: rect.height,
  };
}
```

**Validation**: Ensure bbox is on-screen and reasonably sized:

- `bbox.height >= 20` (minimum height)
- `bbox.width >= 50` (minimum width)
- `-200 <= bbox.y <= 20000` (reasonable y-range, catch negative coords)

If validation fails, skip element and log warning.

**Deduplication**: After computing bboxes for a component_key, remove nested boxes:

- If `bbox_A` is fully contained within `bbox_B` (same component type), skip `bbox_A`
- Prevents double-counting when DOM has nested carousel/accordion structures
- Applied per component_key (image_carousel boxes don't dedupe card_carousel boxes)

---

## Overlay Injection

**Purpose**: Render colored bounding boxes on top of detected components for visual QA.

### Overlay Implementation

```typescript
async function injectOverlay(
  bbox: BoundingBox,
  componentKey: string,
  index: number,
) {
  await page.evaluate(
    ({ bbox, componentKey, index }) => {
      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.left = `${bbox.x}px`;
      overlay.style.top = `${bbox.y}px`;
      overlay.style.width = `${bbox.width}px`;
      overlay.style.height = `${bbox.height}px`;
      overlay.style.border = `4px solid ${getColorForComponent(componentKey)}`;
      overlay.style.zIndex = "999999";
      overlay.style.pointerEvents = "none";

      // Add label
      const label = document.createElement("div");
      label.textContent = `${componentKey} #${index + 1}`;
      label.style.position = "absolute";
      label.style.top = "0";
      label.style.left = "0";
      label.style.background = getColorForComponent(componentKey);
      label.style.color = "#fff";
      label.style.padding = "4px 8px";
      label.style.fontSize = "12px";
      label.style.fontFamily = "monospace";

      overlay.appendChild(label);
      document.body.appendChild(overlay);
    },
    { bbox, componentKey, index },
  );
}

function getColorForComponent(componentKey: string): string {
  const colors = {
    hero: "#FFE66D", // Yellow
    promo_section: "#FFA07A", // Light salmon
    media_text_split: "#98D8C8", // Seafoam
    info_specs: "#B4A7D6", // Lavender
    next_action_panel: "#FFB6C1", // Light pink
    image_carousel: "#95E1D3", // Mint
    card_carousel: "#A8E6CF", // Light green
    cards_section: "#FFD3B6", // Peach
    accordion: "#FF6B6B", // Red
    tabs: "#4ECDC4", // Teal
    anchor_nav: "#D4A5A5", // Dusty rose
  };
  return colors[componentKey] || "#888";
}
```

**Rationale for `position: absolute` + document coordinates**:

- Overlays positioned relative to `<body>` (not viewport)
- Coordinates match manifest JSON (document-based)
- Overlays scroll with page content

**Rationale for `z-index: 999999`**:

- Ensure overlays render above all page content
- Nissan site uses z-index up to ~10000 for modals/nav

---

## Expected Output Directory Structure

```text
analysis/artifacts/visual-proof/full/
├── juke/
│   ├── juke.annotated.png         # Full-page screenshot with overlays
│   └── juke.manifest.json         # Bbox coordinates + locator metadata
├── ariya/
│   ├── ariya.annotated.png
│   └── ariya.manifest.json
├── electric-vehicles/
│   ├── electric-vehicles.annotated.png
│   └── electric-vehicles.manifest.json
├── ownership/
│   ├── ownership.annotated.png
│   └── ownership.manifest.json
└── pop-up-event/
    ├── pop-up-event.annotated.png
    └── pop-up-event.manifest.json
```

**File naming**:

- Slug derived from URL: `https://www.nissan.co.uk/vehicles/new-vehicles/juke.html` → `juke`
- Editorial URLs: `https://www.nissan.co.uk/experience-nissan/electric-vehicles.html` → `electric-vehicles`

---

## Common Failure Modes

### 1. Bbox Offscreen (Negative Y-Coordinate)

**Symptom**: Overlay not visible, `bbox.y < 0` in manifest JSON

**Cause**: Element above fold, `getBoundingClientRect()` returns viewport-relative coords

**Fix**: Use document coordinates (scrollX/scrollY offset). Already implemented.

### 2. Overlays Not Visible

**Symptom**: Screenshot looks correct, but no colored boxes

**Causes**:

- Overlays rendered below page content (z-index too low)
- Overlays positioned off-screen (negative coords)
- Overlays filtered out by global chrome exclusion

**Debug**:

- Check manifest JSON: Are bbox coordinates reasonable?
- Check console logs: Were elements filtered out?
- Increase z-index or verify overlay injection code

### 3. Dynamic DOM (Components Load After Screenshot)

**Symptom**: Manifest JSON shows 0 highlights, but visual inspection shows components exist

**Causes**:

- Carousels load images asynchronously after `networkidle`
- Accordions/tabs rendered by JavaScript after page load
- Cookie overlay blocks entire page (not dismissed)

**Mitigations**:

- Add explicit delays after navigation (2-3 seconds)
- Wait for specific elements: `await page.waitForSelector('[class*="swiper"]')`
- Retry cookie dismissal if first attempt fails

### 4. Locator Mismatch (Detections vs Live DOM)

**Symptom**: `detections.json` shows 5 carousels, manifest JSON shows 3

**Causes**:

- DOM structure changed since HTML was cached
- Locator strategy more/less strict than detector
- Global chrome exclusions filter out elements that detector counted

**Not a bug**: This is expected. Discrepancies are valuable data points:

- If runner finds FEWER: Locator too strict, or page changed
- If runner finds MORE: Locator too broad, or detector missed elements
- Document discrepancies in `detector-changes.md`

---

## Retry Strategy

```typescript
async function navigateWithRetry(url: string, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000); // Extra delay for dynamic content
      return; // Success
    } catch (error) {
      if (i === maxRetries - 1) throw error; // Last retry failed
      console.warn(
        `Navigation failed (attempt ${i + 1}/${maxRetries}), retrying...`,
      );
      await page.waitForTimeout(5000); // Wait before retry
    }
  }
}
```

---

## Performance Expectations

**Single page**:

- Navigation: ~3-5 seconds (networkidle + delay)
- Component query + bbox computation: ~0.5-1 second
- Overlay injection: ~0.5 second
- Screenshot capture: ~1-2 seconds (full-page)
- **Total**: ~5-10 seconds per page

**Full proof pack (5 pages)**:

- Expected: ~30-60 seconds
- With retries: up to 2-3 minutes

**Optimization**:

- Run pages in parallel (Playwright supports multiple browser contexts)
- Reuse browser instance across pages
- Skip screenshot if manifest already exists (idempotent)

---

## Related Documentation

- [Data Contracts](data-contracts.md) — Manifest JSON schema
- [Overview](overview.md) — Full workflow
- [QA UI Documentation](qa-ui.md) — How screenshots are used
