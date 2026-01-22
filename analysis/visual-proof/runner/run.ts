#!/usr/bin/env tsx
/**
 * TH-04: Proof Runner (Live)
 *
 * Reads detections.json and generates annotated screenshots + manifest JSON
 * for each URL using documented locator strategy.
 *
 * Outputs:
 * - analysis/artifacts/visual-proof/full/<slug>/<slug>.annotated.png
 * - analysis/artifacts/visual-proof/full/<slug>/<slug>.manifest.json
 *
 * Usage: pnpm proof:run
 */

import { chromium, Page, Browser, ElementHandle } from "playwright";
import fs from "fs";
import path from "path";

// --- Types ---

interface Detection {
  component_key: string;
  instance_count: number;
  confidence: string | null;
  evidence_raw: string | null;
  evidence_parsed: unknown | null;
}

interface UrlData {
  url: string;
  url_id: number | null;
  detections: Detection[];
}

interface DetectionsJson {
  generated_at: string;
  market: string;
  urls: UrlData[];
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FoundInstance {
  bbox: BoundingBox;
  selector_used: string;
}

interface ManifestDetection {
  component_key: string;
  expected_instances: number;
  found_instances: number;
  selector_used: string;
  instances: FoundInstance[];
  notes?: string;
}

interface Manifest {
  url: string;
  slug: string;
  timestamp: string;
  viewport: { width: number; height: number };
  detections: ManifestDetection[];
  error?: string;
}

// --- Configuration ---

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DETECTIONS_PATH = path.join(
  REPO_ROOT,
  "analysis/artifacts/visual-proof/detections.json",
);
const OUTPUT_BASE = path.join(
  REPO_ROOT,
  "analysis/artifacts/visual-proof/full",
);

const VIEWPORT = { width: 1920, height: 1080 };
const NAVIGATION_TIMEOUT = 30000;
const NETWORK_IDLE_TIMEOUT = 15000;

// --- Component Colors (from runner.md) ---

const COMPONENT_COLORS: Record<string, string> = {
  hero: "#FFE66D",
  promo_section: "#FFA07A",
  media_text_split: "#98D8C8",
  info_specs: "#B4A7D6",
  next_action_panel: "#FFB6C1",
  image_carousel: "#95E1D3",
  card_carousel: "#A8E6CF",
  cards_section: "#FFD3B6",
  accordion: "#FF6B6B",
  tabs: "#4ECDC4",
  anchor_nav: "#D4A5A5",
};

// --- Component Selector Mappings (from runner.md) ---

const COMPONENT_SELECTORS: Record<string, string> = {
  hero: '.hero, section.hero, [class*="hero-banner"]',
  promo_section: 'section[class*="promo"], [class*="banner"]',
  media_text_split:
    'div.c_302A:has(.grid-column.column-8), section[class*="split"], [class*="media-text"]',
  info_specs: '[class*="specs"], [class*="key-facts"]',
  next_action_panel: '[class*="next-steps"], [class*="action-panel"]',
  image_carousel: '[class*="swiper"], [class*="carousel"], [class*="slider"]',
  card_carousel: '[class*="swiper"], [class*="carousel"], [class*="slider"]',
  cards_section: 'section, div.cards, [class*="card-grid"]',
  accordion: '[class*="accordion"], details, [role="region"][aria-labelledby]',
  tabs: '[role="tablist"]',
  anchor_nav: 'nav[class*="anchor"], [class*="page-nav"]',
};

// --- Global Chrome Exclusion Selectors ---

const GLOBAL_CHROME_SELECTORS = [
  "header",
  "nav",
  "footer",
  '[role="contentinfo"]',
  '[role="banner"]',
  '[role="navigation"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  "#onetrust-consent-sdk",
  ".onetrust-pc-dark-filter",
  ".meganav-container",
  '[class*="c_010D"]',
  '[id*="onetrust"]',
  '[class*="cookie"]',
  '[class*="consent"]',
];

// --- Helper Functions ---

function getSlugFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Extract last meaningful segment
    const segments = pathname.split("/").filter((s) => s && s !== ".html");
    if (segments.length === 0) return "homepage";
    const lastSegment = segments[segments.length - 1];
    return lastSegment.replace(/\.html$/, "");
  } catch {
    return "unknown";
  }
}

function isInsideGlobalChrome(element: Element): boolean {
  return GLOBAL_CHROME_SELECTORS.some((selector) => {
    try {
      return element.closest(selector) !== null;
    } catch {
      return false;
    }
  });
}

async function dismissCookieOverlay(page: Page): Promise<void> {
  try {
    const cookieSelectors = [
      "#onetrust-accept-btn-handler",
      ".onetrust-close-btn-handler",
      'button:has-text("Accept")',
      'button:has-text("Agree")',
      '[aria-label*="Accept"]',
    ];

    for (const selector of cookieSelectors) {
      try {
        const button = page.locator(selector).first();
        const isVisible = await button
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (isVisible) {
          await button.click({ timeout: 2000 });
          console.log(`    ✓ Dismissed cookie overlay`);
          await page.waitForTimeout(1000);
          return;
        }
      } catch {
        // Try next selector
      }
    }
  } catch (error) {
    // Best-effort, don't fail
  }
}

async function getBoundingBox(
  page: Page,
  element: ElementHandle,
): Promise<BoundingBox | null> {
  try {
    const box = await element.boundingBox();
    if (!box) return null;

    // Get scroll offsets to convert to document coordinates
    const scrollOffsets = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    const bbox: BoundingBox = {
      x: Math.round(box.x + scrollOffsets.x),
      y: Math.round(box.y + scrollOffsets.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };

    // Validate bbox
    if (
      bbox.height < 20 ||
      bbox.width < 50 ||
      bbox.y < -200 ||
      bbox.y > 20000
    ) {
      return null;
    }

    return bbox;
  } catch {
    return null;
  }
}

function isBoxContainedIn(inner: BoundingBox, outer: BoundingBox): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

async function injectOverlay(
  page: Page,
  bbox: BoundingBox,
  componentKey: string,
  index: number,
): Promise<void> {
  await page.evaluate(
    ({
      bbox,
      componentKey,
      index,
      color,
    }: {
      bbox: BoundingBox;
      componentKey: string;
      index: number;
      color: string;
    }) => {
      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.left = `${bbox.x}px`;
      overlay.style.top = `${bbox.y}px`;
      overlay.style.width = `${bbox.width}px`;
      overlay.style.height = `${bbox.height}px`;
      overlay.style.border = `4px solid ${color}`;
      overlay.style.zIndex = "999999";
      overlay.style.pointerEvents = "none";
      overlay.style.boxSizing = "border-box";

      const label = document.createElement("div");
      label.textContent = `${componentKey} #${index + 1}`;
      label.style.position = "absolute";
      label.style.top = "0";
      label.style.left = "0";
      label.style.background = color;
      label.style.color = "#fff";
      label.style.padding = "4px 8px";
      label.style.fontSize = "12px";
      label.style.fontFamily = "monospace";
      label.style.fontWeight = "bold";
      label.style.whiteSpace = "nowrap";

      overlay.appendChild(label);
      document.body.appendChild(overlay);
    },
    {
      bbox,
      componentKey,
      index,
      color: COMPONENT_COLORS[componentKey] || "#888",
    },
  );
}

async function findComponentInstances(
  page: Page,
  componentKey: string,
  expectedCount: number,
): Promise<{ instances: FoundInstance[]; notes?: string }> {
  const selector = COMPONENT_SELECTORS[componentKey];
  if (!selector) {
    return {
      instances: [],
      notes: `No selector defined for component_key: ${componentKey}`,
    };
  }

  try {
    // Query all matching elements
    const elements = await page.evaluate(
      ({
        selector,
        globalChromeSelectors,
      }: {
        selector: string;
        globalChromeSelectors: string[];
      }) => {
        const candidates = Array.from(document.querySelectorAll(selector));

        // Filter out global chrome
        const filtered = candidates.filter((el) => {
          return !globalChromeSelectors.some((chromeSelector: string) => {
            try {
              return el.closest(chromeSelector) !== null;
            } catch {
              return false;
            }
          });
        });

        // Return element data for bbox computation
        return filtered.map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
          };
        });
      },
      { selector, globalChromeSelectors: GLOBAL_CHROME_SELECTORS },
    );

    // Convert to document coordinates and validate
    const validBoxes: BoundingBox[] = [];
    for (const el of elements) {
      const bbox: BoundingBox = {
        x: Math.round(el.x + el.scrollX),
        y: Math.round(el.y + el.scrollY),
        width: Math.round(el.width),
        height: Math.round(el.height),
      };

      // Validate
      if (
        bbox.height >= 20 &&
        bbox.width >= 50 &&
        bbox.y >= -200 &&
        bbox.y <= 20000
      ) {
        validBoxes.push(bbox);
      }
    }

    // Dedupe nested boxes
    const deduped: BoundingBox[] = [];
    for (const bbox of validBoxes) {
      const isNested = deduped.some((existing) =>
        isBoxContainedIn(bbox, existing),
      );
      if (!isNested) {
        // Also check if this box contains any existing boxes (keep outer)
        const containsExisting = deduped.findIndex((existing) =>
          isBoxContainedIn(existing, bbox),
        );
        if (containsExisting !== -1) {
          deduped[containsExisting] = bbox;
        } else {
          deduped.push(bbox);
        }
      }
    }

    // Limit to expected count
    const instances: FoundInstance[] = deduped
      .slice(0, expectedCount)
      .map((bbox) => ({
        bbox,
        selector_used: selector,
      }));

    let notes: string | undefined;
    if (instances.length === 0) {
      notes = `No instances found (expected ${expectedCount})`;
    } else if (instances.length < expectedCount) {
      notes = `Found ${instances.length} of ${expectedCount} expected instances`;
    }

    return { instances, notes };
  } catch (error) {
    return {
      instances: [],
      notes: `Locator error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function processUrl(browser: Browser, urlData: UrlData): Promise<void> {
  const { url, detections } = urlData;
  const slug = getSlugFromUrl(url);

  console.log(`\n📄 Processing: ${url}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   Detections: ${detections.length}`);

  const outputDir = path.join(OUTPUT_BASE, slug);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const screenshotPath = path.join(outputDir, `${slug}.annotated.png`);
  const manifestPath = path.join(outputDir, `${slug}.manifest.json`);

  let page: Page | null = null;

  try {
    page = await browser.newPage();
    await page.setViewportSize(VIEWPORT);

    // Navigate with retry
    console.log(`   ⏳ Loading page...`);
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT,
      });
      await page.waitForLoadState("networkidle", {
        timeout: NETWORK_IDLE_TIMEOUT,
      });
      await page.waitForTimeout(2000); // Extra delay for dynamic content
    } catch (error) {
      console.warn(`   ⚠ Navigation warning: ${error}`);
      // Continue anyway - page might be partially loaded
    }

    // Dismiss cookie overlay
    await dismissCookieOverlay(page);

    // Process each detection
    const manifestDetections: ManifestDetection[] = [];

    for (const detection of detections) {
      console.log(
        `   🔍 ${detection.component_key} (expect ${detection.instance_count})`,
      );

      const { instances, notes } = await findComponentInstances(
        page,
        detection.component_key,
        detection.instance_count,
      );

      console.log(`      Found: ${instances.length}`);
      if (notes) {
        console.log(`      Note: ${notes}`);
      }

      // Inject overlays
      for (let i = 0; i < instances.length; i++) {
        await injectOverlay(
          page,
          instances[i].bbox,
          detection.component_key,
          i,
        );
      }

      manifestDetections.push({
        component_key: detection.component_key,
        expected_instances: detection.instance_count,
        found_instances: instances.length,
        selector_used: COMPONENT_SELECTORS[detection.component_key] || "",
        instances,
        notes,
      });
    }

    // Capture screenshot
    console.log(`   📸 Capturing screenshot...`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    // Write manifest
    const manifest: Manifest = {
      url,
      slug,
      timestamp: new Date().toISOString(),
      viewport: VIEWPORT,
      detections: manifestDetections,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`   ✅ Complete!`);
    console.log(`      Screenshot: ${screenshotPath}`);
    console.log(`      Manifest: ${manifestPath}`);
  } catch (error) {
    console.error(`   ❌ Error processing ${url}:`, error);

    // Write error manifest
    const errorManifest: Manifest = {
      url,
      slug,
      timestamp: new Date().toISOString(),
      viewport: VIEWPORT,
      detections: [],
      error:
        error instanceof Error
          ? error.message
          : `Unknown error: ${String(error)}`,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(errorManifest, null, 2));

    // Try to capture error state screenshot
    if (page) {
      try {
        await page.screenshot({ path: screenshotPath, fullPage: false });
      } catch {
        // Ignore screenshot errors
      }
    }
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// --- Main ---

async function main(): Promise<void> {
  console.log("=== TH-04: Proof Runner (Live) ===\n");

  // Load detections.json
  console.log(`Loading detections from: ${DETECTIONS_PATH}`);
  if (!fs.existsSync(DETECTIONS_PATH)) {
    console.error(`❌ File not found: ${DETECTIONS_PATH}`);
    console.error(`Run 'pnpm proof:export' first to generate detections.json`);
    process.exit(1);
  }

  const detectionsJson: DetectionsJson = JSON.parse(
    fs.readFileSync(DETECTIONS_PATH, "utf-8"),
  );

  const urlsWithDetections = detectionsJson.urls.filter(
    (u) => u.detections.length > 0,
  );

  console.log(`\nURLs to process: ${urlsWithDetections.length}`);
  console.log(`Output directory: ${OUTPUT_BASE}\n`);

  if (urlsWithDetections.length === 0) {
    console.log("⚠ No URLs with detections found. Nothing to do.");
    return;
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_BASE)) {
    fs.mkdirSync(OUTPUT_BASE, { recursive: true });
  }

  // Launch browser
  console.log("🚀 Launching browser...");
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // Process each URL
    for (const urlData of urlsWithDetections) {
      await processUrl(browser, urlData);
    }

    console.log("\n✅ All pages processed!");
    console.log(`\nOutputs saved to: ${OUTPUT_BASE}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
