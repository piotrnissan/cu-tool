#!/usr/bin/env tsx
/**
 * Visual Proof Runner — DEMO
 *
 * Generates annotated screenshot + JSON metadata for the first VLP page.
 * This is a minimal proof-of-concept showing how live component detection
 * and visual annotation will work.
 *
 * Usage: pnpm proof:demo
 */

import { chromium, Page } from "playwright";
import fs from "fs";
import path from "path";

const COLORS = {
  tabs: "#3b82f6", // blue
  image_carousel: "#10b981", // green
  cards_section: "#f59e0b", // amber
  accordion: "#8b5cf6", // purple
  card_carousel: "#ec4899", // pink
  anchor_nav: "#14b8a6", // teal
};

interface Highlight {
  component_key: string;
  selector_summary: string;
  bbox: { x: number; y: number; width: number; height: number };
  note: string;
}

async function dismissCookieOverlay(page: Page): Promise<void> {
  try {
    // Common cookie consent patterns
    const selectors = [
      'button:has-text("Accept")',
      'button:has-text("Agree")',
      'button:has-text("OK")',
      "#onetrust-accept-btn-handler",
      ".onetrust-close-btn-handler",
      '[aria-label*="Accept"]',
      '[aria-label*="consent"]',
    ];

    for (const selector of selectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click({ timeout: 2000 });
        console.log(`  ✓ Dismissed cookie overlay (${selector})`);
        await page.waitForTimeout(1000);
        return;
      }
    }
  } catch (error) {
    // Best-effort, don't fail
    console.log("  ℹ No cookie overlay found (or already dismissed)");
  }
}

async function findTabs(page: Page): Promise<Highlight | null> {
  try {
    // Find tablist NOT inside global chrome
    const tablist = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('[role="tablist"]'),
      );

      // Comprehensive global chrome exclusions
      const globalChromeSelectors = [
        "header",
        "nav",
        "footer",
        '[role="contentinfo"]',
        ".meganav-container",
        '[class*="c_010D"]',
        '[role="dialog"]',
        '[aria-modal="true"]',
        "#onetrust-consent-sdk",
        '[id*="onetrust"]',
        '[class*="cookie"]',
        '[class*="consent"]',
      ];

      const filtered = candidates.filter((el) => {
        // Check if element is inside any global chrome container
        return !globalChromeSelectors.some((selector) => {
          const parent = el.closest(selector);
          return parent !== null;
        });
      });

      if (filtered.length === 0) return null;

      const element = filtered[0] as HTMLElement;
      const rect = element.getBoundingClientRect();

      // Skip if not visible or off-screen
      if (
        rect.height < 20 ||
        rect.width < 50 ||
        rect.y < 0 ||
        rect.x < 0 ||
        rect.y > window.innerHeight + 10000 // Way off-screen
      ) {
        return null;
      }

      return {
        bbox: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height,
        },
        selector:
          element.tagName.toLowerCase() +
          (element.className ? "." + element.className.split(" ")[0] : ""),
        tabCount: element.querySelectorAll('[role="tab"]').length,
      };
    });

    if (!tablist || tablist.tabCount === 0) return null;

    return {
      component_key: "tabs",
      selector_summary: tablist.selector,
      bbox: tablist.bbox,
      note: `Detected ${tablist.tabCount} tabs`,
    };
  } catch (error) {
    return null;
  }
}

async function findCarousel(page: Page): Promise<Highlight | null> {
  try {
    const carousel = await page.evaluate(() => {
      // Find containers with carousel/swiper keywords
      const allElements = document.querySelectorAll(
        '[class*="swiper"], [class*="carousel"], [class*="slider"]',
      );

      for (let i = 0; i < allElements.length; i++) {
        const container = allElements[i];

        // Skip if in header/nav/footer
        if (container.closest('header, nav, footer, [role="contentinfo"]')) {
          continue;
        }

        const images = container.querySelectorAll("img, picture");
        if (images.length < 2) continue;

        const rect = (container as HTMLElement).getBoundingClientRect();

        // Skip if too small or way off-screen
        if (
          rect.height < 20 ||
          rect.width < 50 ||
          rect.y < -200 ||
          rect.y > 20000
        ) {
          continue;
        }

        return {
          bbox: {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height,
          },
          selector:
            (container as HTMLElement).tagName.toLowerCase() +
            "." +
            (container.className as string).split(" ")[0],
          imageCount: images.length,
        };
      }

      return null;
    });

    if (!carousel) return null;

    return {
      component_key: "image_carousel",
      selector_summary: carousel.selector,
      bbox: carousel.bbox,
      note: `Detected carousel with ${carousel.imageCount} images`,
    };
  } catch (error) {
    console.log(`  [Carousel Error]: ${error}`);
    return null;
  }
}

async function findCardsSection(page: Page): Promise<Highlight | null> {
  try {
    const cardsSection = await page.evaluate(() => {
      // Comprehensive global chrome exclusions
      const globalChromeSelectors = [
        "header",
        "nav",
        "footer",
        '[role="contentinfo"]',
        ".meganav-container",
        '[class*="c_010D"]',
        '[role="dialog"]',
        '[aria-modal="true"]',
        "#onetrust-consent-sdk",
        '[id*="onetrust"]',
        '[class*="cookie"]',
        '[class*="consent"]',
      ];

      const isInGlobalChrome = (el: Element): boolean => {
        return globalChromeSelectors.some((selector) => {
          return el.closest(selector) !== null;
        });
      };

      // Find containers with >=3 card-like items
      const containers = Array.from(
        document.querySelectorAll("div, section, ul, article"),
      );

      for (const container of containers) {
        // Skip AEM layout wrappers and global chrome
        if (
          container.matches(
            ".responsivegrid, .aem-Grid, .aem-GridColumn, .parsys",
          ) ||
          isInGlobalChrome(container)
        ) {
          continue;
        }

        const children = Array.from(container.children);
        if (children.length < 3) continue;

        // Count card-like items: link + (heading OR image)
        const cardLikeCount = children.filter((child) => {
          const hasLink = child.querySelector("a[href]");
          const hasHeading = child.querySelector(
            'h2, h3, h4, [role="heading"]',
          );
          const hasMedia = child.querySelector(
            'img, picture, svg, [role="img"]',
          );
          return hasLink && (hasHeading || hasMedia);
        }).length;

        if (cardLikeCount >= 3) {
          const rect = (container as HTMLElement).getBoundingClientRect();

          // Skip if not visible or off-screen
          if (
            rect.height < 20 ||
            rect.width < 50 ||
            rect.y < 0 ||
            rect.x < 0 ||
            rect.y > window.innerHeight + 10000
          ) {
            continue;
          }

          return {
            bbox: {
              x: rect.x + window.scrollX,
              y: rect.y + window.scrollY,
              width: rect.width,
              height: rect.height,
            },
            selector:
              container.tagName.toLowerCase() +
              (container.className
                ? "." + (container.className as string).split(" ")[0]
                : ""),
            itemCount: cardLikeCount,
          };
        }
      }

      return null;
    });

    if (!cardsSection) return null;

    return {
      component_key: "cards_section",
      selector_summary: cardsSection.selector,
      bbox: cardsSection.bbox,
      note: `Detected ${cardsSection.itemCount} card-like items`,
    };
  } catch (error) {
    return null;
  }
}

async function injectOverlays(
  page: Page,
  highlights: Highlight[],
): Promise<void> {
  await page.evaluate(
    (data) => {
      const { highlights, colors } = data;

      highlights.forEach((highlight, index) => {
        const { component_key, bbox } = highlight;
        const color = colors[component_key] || "#666666";

        // Create outline box
        const outline = document.createElement("div");
        outline.style.cssText = `
        position: absolute;
        left: ${bbox.x}px;
        top: ${bbox.y}px;
        width: ${bbox.width}px;
        height: ${bbox.height}px;
        border: 3px solid ${color};
        pointer-events: none;
        z-index: 999999;
        box-sizing: border-box;
      `;

        // Create label
        const label = document.createElement("div");
        label.textContent = `${index + 1}. ${component_key}`;
        label.style.cssText = `
        position: absolute;
        left: ${bbox.x}px;
        top: ${bbox.y - 30}px;
        background: ${color};
        color: white;
        padding: 4px 8px;
        font-family: monospace;
        font-size: 12px;
        font-weight: bold;
        border-radius: 3px;
        pointer-events: none;
        z-index: 999999;
        white-space: nowrap;
      `;

        document.body.appendChild(outline);
        document.body.appendChild(label);
      });
    },
    { highlights, colors: COLORS },
  );
}

async function main() {
  console.log("🎬 Visual Proof Runner — DEMO\n");

  // Parse CLI arguments
  const args = process.argv.slice(2);
  let targetUrl: string | null = null;

  for (const arg of args) {
    if (arg.startsWith("--url=")) {
      targetUrl = arg.substring(6);
    }
  }

  // Read first URL from VLP pages if no CLI arg
  if (!targetUrl) {
    const vlpPagesPath = path.join(
      process.cwd(),
      "analysis/visual-proof/pages.vlp.txt",
    );
    const vlpContent = fs.readFileSync(vlpPagesPath, "utf-8");
    const urls = vlpContent
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));

    if (urls.length === 0) {
      console.error("❌ No URLs found in pages.vlp.txt");
      process.exit(1);
    }

    targetUrl = urls[0];
  }

  console.log(`📄 Demo URL: ${targetUrl}\n`);

  // Generate slug from URL
  const urlObj = new URL(targetUrl);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const slug =
    pathParts[pathParts.length - 1]?.replace(".html", "") ||
    urlObj.hostname.split(".")[0];

  console.log(`🔧 Slug: ${slug}`);

  // Launch browser
  console.log("\n🌐 Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  try {
    // Navigate
    console.log(`📡 Loading page...`);
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000); // Allow JS to settle and carousels to initialize

    // Dismiss cookie overlay
    await dismissCookieOverlay(page);

    // Additional wait for dynamic content
    await page.waitForTimeout(1000);

    // Scroll to top to ensure consistent viewport coordinates
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Capture BEFORE screenshot
    const outputDir = path.join(
      process.cwd(),
      "analysis/artifacts/visual-proof/demo",
    );
    fs.mkdirSync(outputDir, { recursive: true });

    const beforePath = path.join(outputDir, `${slug}.before.png`);
    console.log("\n📸 Capturing BEFORE screenshot...");
    await page.screenshot({ path: beforePath, fullPage: true });
    console.log(`  ✓ Saved: ${beforePath}`);

    // Find components
    console.log("\n🔍 Searching for components...");
    const highlights: Highlight[] = [];

    const tabs = await findTabs(page);
    if (tabs) {
      console.log(`  ✓ Found: ${tabs.component_key} (${tabs.note})`);
      highlights.push(tabs);
    }

    const carousel = await findCarousel(page);
    if (carousel) {
      console.log(`  ✓ Found: ${carousel.component_key} (${carousel.note})`);
      highlights.push(carousel);
    }

    const cardsSection = await findCardsSection(page);
    if (cardsSection) {
      console.log(
        `  ✓ Found: ${cardsSection.component_key} (${cardsSection.note})`,
      );
      highlights.push(cardsSection);
    }

    if (highlights.length === 0) {
      console.log("  ℹ No components detected (this is OK for demo)");
    }

    // Inject overlays
    if (highlights.length > 0) {
      console.log("\n🎨 Injecting visual annotations...");
      await injectOverlays(page, highlights);
      await page.waitForTimeout(500); // Let overlays render
    }

    // Capture AFTER screenshot with overlays
    const afterPath = path.join(outputDir, `${slug}.after.png`);
    const jsonPath = path.join(outputDir, `${slug}.json`);

    console.log("📸 Capturing AFTER screenshot...");
    await page.screenshot({ path: afterPath, fullPage: true });
    console.log(`  ✓ Saved: ${afterPath}`);

    // Save JSON metadata
    const metadata = {
      url: targetUrl,
      slug,
      timestamp: new Date().toISOString(),
      highlights: highlights.map((h) => ({
        component_key: h.component_key,
        selector_summary: h.selector_summary,
        bbox: h.bbox,
        note: h.note,
      })),
    };

    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
    console.log(`  ✓ Saved: ${jsonPath}`);

    console.log("\n✅ Demo complete!");
    console.log(`\n📊 Results:`);
    console.log(`   - Components found: ${highlights.length}`);
    console.log(
      `   - BEFORE: analysis/artifacts/visual-proof/demo/${slug}.before.png`,
    );
    console.log(
      `   - AFTER: analysis/artifacts/visual-proof/demo/${slug}.after.png`,
    );
    console.log(`   - JSON: analysis/artifacts/visual-proof/demo/${slug}.json`);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
