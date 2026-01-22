import { JSDOM } from "jsdom";

export interface ComponentDetection {
  componentKey: string;
  instanceCount: number;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

/**
 * Global chrome exclusion selectors
 * Apply to all detectors to filter out non-content elements
 */
const GLOBAL_CHROME_EXCLUSIONS = [
  // Footer (primary - semantic + role)
  "footer",
  '[role="contentinfo"]',

  // Header/nav
  "header",
  "nav",
  ".meganav-container",
  '[class*="c_010D"]',

  // Modal dialogs
  '[role="dialog"][aria-modal="true"]',

  // Cookie/consent overlays
  "#onetrust-consent-sdk",
  '[id*="onetrust"]',
  '[class*="onetrust"]',
  '[class*="cookie"]',
  '[class*="consent"]',

  // Footer fallback (class/id patterns)
  '[id*="footer"]',
  '[class*="footer"]',
];

/**
 * AEM layout wrapper patterns to avoid counting as component containers
 * Check with matches(), not closest()
 */
const AEM_LAYOUT_WRAPPERS = [
  ".responsivegrid",
  ".aem-Grid",
  '[class*="aem-Grid"]',
  ".aem-GridColumn",
  ".parsys",
  ".grid-row.bleed",
  ".dummy-parent-class",
];

/**
 * Get content root element (fallback chain for non-semantic HTML)
 */
function getContentRoot(doc: Document): Element {
  const candidates = [
    doc.querySelector("main"),
    doc.querySelector('[role="main"]'),
    doc.querySelector("article"),
    doc.querySelector("#main"),
    doc.querySelector("#content"),
    doc.querySelector("#page"),
    doc.querySelector("#container"),
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  return doc.body;
}

/**
 * Check if element is in global chrome context
 */
function isInGlobalChrome(element: Element): boolean {
  return GLOBAL_CHROME_EXCLUSIONS.some((selector) => {
    try {
      return element.closest(selector) !== null;
    } catch {
      return false;
    }
  });
}

/**
 * Check if element itself is an AEM layout wrapper
 */
function isAEMLayoutWrapper(element: Element): boolean {
  return AEM_LAYOUT_WRAPPERS.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

/**
 * Detects tabs component (ARIA-only: role="tablist" + role="tab" + role="tabpanel")
 * Strictly excludes global chrome (header/nav/footer/meganav/modals)
 */
function detectTabs(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const tablists = doc.querySelectorAll('[role="tablist"]');

  if (tablists.length === 0) return null;

  const contentRoot = getContentRoot(doc);
  const validTablists: Array<{ tabs: number; panels: number }> = [];

  tablists.forEach((tablist) => {
    // Exclude global chrome (header/nav/footer/meganav/modals)
    if (isInGlobalChrome(tablist)) return;

    // Require inside content root
    if (!contentRoot.contains(tablist)) return;

    // Require tabs with role="tab"
    const tabs = tablist.querySelectorAll('[role="tab"]');
    if (tabs.length === 0) return;

    let validPanelsCount = 0;

    tabs.forEach((tab) => {
      const ariaControls = tab.getAttribute("aria-controls");
      if (!ariaControls) return;

      const panel = doc.getElementById(ariaControls);
      if (!panel) return;

      // ARIA-only: require role="tabpanel" (no content-based fallback)
      const hasTabpanelRole = panel.getAttribute("role") === "tabpanel";

      if (hasTabpanelRole) {
        validPanelsCount++;
      }
    });

    // Only count this tablist if it has at least one valid panel
    if (validPanelsCount > 0) {
      validTablists.push({ tabs: tabs.length, panels: validPanelsCount });
    }
  });

  if (validTablists.length === 0) return null;

  // Calculate evidence
  const firstTablist = validTablists[0];
  const evidence = `tabs: ${firstTablist.tabs} tabs, ${firstTablist.panels} panels (ARIA-only)`;

  return {
    componentKey: "tabs",
    instanceCount: validTablists.length,
    confidence: "high",
    evidence,
  };
}

/**
 * Detects accordion component (details/summary OR aria-expanded patterns)
 */
function detectAccordion(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  // Method 1: Native details/summary (semantic HTML)
  const detailsElements = Array.from(doc.querySelectorAll("details")).filter(
    (el) => {
      // Exclude footer/contentinfo context
      if (el.closest('footer, [role="contentinfo"]')) return false;

      return !isInGlobalChrome(el) && contentRoot.contains(el);
    },
  );

  if (detailsElements.length >= 3) {
    return {
      componentKey: "accordion",
      instanceCount: 1,
      confidence: "high",
      evidence: `accordion: 1, items=${detailsElements.length}, source=details`,
    };
  }

  // Method 2: ARIA accordion pattern (aria-expanded + aria-controls)
  const ariaExpanded = Array.from(
    doc.querySelectorAll("[aria-expanded]"),
  ).filter((el) => {
    // Exclude footer/contentinfo context
    if (el.closest('footer, [role="contentinfo"]')) return false;

    // Exclude global chrome (footer, header, nav, etc.)
    if (isInGlobalChrome(el)) return false;

    // Require inside content root
    if (!contentRoot.contains(el)) return false;

    // REQUIRE aria-controls pointing to an existing panel
    const controls = el.getAttribute("aria-controls");
    if (!controls) return false;

    const panel = doc.getElementById(controls);
    if (!panel) return false;

    // Panel must have meaningful content (>= 50 chars to avoid footer toggles)
    const hasContent = (panel.textContent?.trim().length || 0) >= 50;
    return hasContent;
  });

  if (ariaExpanded.length >= 5) {
    return {
      componentKey: "accordion",
      instanceCount: 1,
      confidence: "medium",
      evidence: `accordion: 1, items=${ariaExpanded.length}, source=aria-controls`,
    };
  }

  return null;
}

/**
 * Detects anchor navigation (in-page nav with href="#..." patterns)
 */
function detectAnchorNav(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  // Find nav/list elements inside content root
  const candidates: Element[] = [];

  contentRoot.querySelectorAll("nav, ul, ol").forEach((container) => {
    // Exclude global chrome
    if (isInGlobalChrome(container)) return;

    const anchorLinks = container.querySelectorAll('a[href^="#"]');
    if (anchorLinks.length < 3) return;

    // Verify at least 50% of anchor targets exist in the DOM
    const validAnchors = Array.from(anchorLinks).filter((link) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return false;
      const targetId = href.slice(1);
      return doc.getElementById(targetId) !== null;
    });

    if (validAnchors.length >= 3) {
      candidates.push(container);
    }
  });

  if (candidates.length === 0) return null;

  const totalAnchors = candidates.reduce((sum, el) => {
    return sum + el.querySelectorAll('a[href^="#"]').length;
  }, 0);

  return {
    componentKey: "anchor_nav",
    instanceCount: candidates.length,
    confidence: "high",
    evidence: `${candidates.length} in-page nav(s) with ${totalAnchors} anchors (in content)`,
  };
}

/**
 * Helper: Check if element is within a media_text_split block
 * Used to prevent double-counting nested carousels
 */
function isWithinMediaTextSplit(element: Element): boolean {
  // Check if element has a parent that looks like media_text_split
  // Media_text_split containers have specific structural patterns:
  // - 2-column layout (grid/flex with 2 children)
  // - One side has media, other has text

  let current = element.parentElement;
  while (current) {
    // Skip AEM wrappers
    if (isAEMLayoutWrapper(current)) {
      current = current.parentElement;
      continue;
    }

    // Check if this container looks like media_text_split
    const children = Array.from(current.children).filter(
      (child) => !isAEMLayoutWrapper(child as Element),
    );

    if (children.length === 2) {
      // Check if one child has media and other has text (>100 chars)
      const child1 = children[0] as Element;
      const child2 = children[1] as Element;

      const child1HasMedia =
        child1.querySelector("img, video, iframe") !== null ||
        child1.querySelector('[class*="carousel"]') !== null ||
        child1.querySelector('[class*="slider"]') !== null;

      const child2HasMedia =
        child2.querySelector("img, video, iframe") !== null ||
        child2.querySelector('[class*="carousel"]') !== null ||
        child2.querySelector('[class*="slider"]') !== null;

      const child1Text = child1.textContent?.trim().length || 0;
      const child2Text = child2.textContent?.trim().length || 0;

      // One side media, other side text
      if (
        (child1HasMedia && child2Text >= 100) ||
        (child2HasMedia && child1Text >= 100)
      ) {
        return true;
      }
    }

    current = current.parentElement;
  }

  return false;
}

/**
 * Helper: Check if element has carousel navigation/pagination controls
 */
function hasCarouselControls(element: Element): boolean {
  const controls = element.querySelectorAll(
    ".swiper-pagination, .slick-dots, " +
      '[class*="pagination"], [class*="dots"], ' +
      'button[aria-label*="next" i], button[aria-label*="prev" i], ' +
      '[class*="prev"], [class*="next"], [class*="arrow"]',
  );
  return controls.length >= 1;
}

/**
 * Helper: Get DOM depth of an element
 */
function getDOMDepth(element: Element): number {
  let depth = 0;
  let current = element.parentElement;
  while (current) {
    depth++;
    current = current.parentElement;
  }
  return depth;
}

/**
 * Classify a carousel container as "image" or "card" based on hybrid heuristics.
 * Returns null if the container doesn't qualify as a carousel.
 * Ensures mutual exclusivity: a container is either image_carousel OR card_carousel.
 */
function classifyCarouselContainer(
  container: Element,
): "image" | "card" | null {
  // Basic carousel validation: require controls OR scrollable
  const hasControls = hasCarouselControls(container);
  const isScrollable = isScrollableCarousel(container);
  if (!hasControls && !isScrollable) return null;

  // Identify slide/item elements using same logic as existing detectors
  const itemSelectors = [
    '[class*="card"]',
    '[class*="item"]',
    '[class*="slide"]',
    '[class*="tile"]',
  ];

  // Collect potential items (prefer direct children, fallback to selector-based)
  let items = Array.from(container.children).filter((child) => {
    // Skip wrapper divs that only contain one child
    if (child.children.length === 1) return false;
    // Must have some content
    const text = child.textContent?.trim() || "";
    const hasContent =
      text.length > 10 || child.querySelector("img, picture, a[href]");
    return hasContent;
  });

  // Fallback: use selector-based item discovery
  if (items.length < 2) {
    const selectorItems: Element[] = [];
    itemSelectors.forEach((selector) => {
      const found = Array.from(container.querySelectorAll(selector));
      found.forEach((item) => {
        // Check if reasonably direct descendant (not too nested)
        let parent = item.parentElement;
        let depth = 0;
        while (parent && parent !== container && depth < 5) {
          parent = parent.parentElement;
          depth++;
        }
        if (parent === container && !selectorItems.includes(item)) {
          selectorItems.push(item);
        }
      });
    });
    if (selectorItems.length > items.length) {
      items = selectorItems;
    }
  }

  // Need at least 2 items to classify
  if (items.length < 2) return null;

  // Count card signals per item
  let cardSignalCount = 0;

  items.forEach((item) => {
    let hasCardSignal = false;

    // Card signals:
    // 1. Contains heading
    const hasHeading =
      item.querySelector("h2, h3, h4, h5, h6, [role='heading']") !== null;
    if (hasHeading) hasCardSignal = true;

    // 2. Contains CTA-like link/button with non-trivial text
    if (!hasCardSignal) {
      const links = item.querySelectorAll("a[href], button");
      for (const link of Array.from(links)) {
        const linkText = link.textContent?.trim() || "";
        if (linkText.length > 5) {
          hasCardSignal = true;
          break;
        }
      }
    }

    // 3. Contains substantial text (>40 chars)
    if (!hasCardSignal) {
      const text = item.textContent?.trim() || "";
      if (text.length > 40) {
        hasCardSignal = true;
      }
    }

    // Count signals
    if (hasCardSignal) {
      cardSignalCount++;
    }
  });

  // Classify: if 60%+ items have card signals => "card", else => "image"
  const cardThreshold = items.length * 0.6;
  if (cardSignalCount >= cardThreshold) {
    return "card";
  } else {
    return "image";
  }
}

/**
 * Detects image carousel (slider-like containers with navigation controls)
 * Hardened with robust nested deduplication
 */
function detectImageCarousel(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  // Step 1: Collect raw candidates
  const rawCandidates: Element[] = [];
  const carouselKeywords = [
    "carousel",
    "slider",
    "slideshow",
    "swiper",
    "slick",
  ];

  // Method 1: Keyword-based
  carouselKeywords.forEach((keyword) => {
    const elements = contentRoot.querySelectorAll(
      `[class*="${keyword}"], [id*="${keyword}"], [data-component*="${keyword}"]`,
    );

    elements.forEach((el) => {
      if (isInGlobalChrome(el)) return;
      if (isAEMLayoutWrapper(el)) return;
      if (!rawCandidates.includes(el)) {
        rawCandidates.push(el);
      }
    });
  });

  // Method 2: Control-based (containers with carousel controls)
  const controlSelectors = [
    ".swiper-pagination",
    ".slick-dots",
    '[class*="pagination"]',
    '[class*="dots"]',
  ];

  controlSelectors.forEach((selector) => {
    const controls = contentRoot.querySelectorAll(selector);
    controls.forEach((control) => {
      const container = control.parentElement;
      if (!container) return;
      if (isInGlobalChrome(container)) return;
      if (isAEMLayoutWrapper(container)) return;
      if (!rawCandidates.includes(container)) {
        rawCandidates.push(container);
      }
    });
  });

  if (rawCandidates.length === 0) return null;

  // Step 2: Robust nested deduplication (outermost-only)
  // Sort by DOM depth (outermost first)
  const sortedCandidates = rawCandidates.sort(
    (a, b) => getDOMDepth(a) - getDOMDepth(b),
  );

  const deduped: Element[] = [];
  sortedCandidates.forEach((candidate) => {
    // Accept only if NOT contained by any already-accepted candidate
    const isNested = deduped.some((accepted) => accepted.contains(candidate));
    if (!isNested) {
      deduped.push(candidate);
    }
  });

  // Step 3: Apply acceptance rules
  const imageCarousels: Array<{ element: Element; imageCount: number }> = [];

  deduped.forEach((container) => {
    // Skip if nested within media_text_split (no double-count)
    if (isWithinMediaTextSplit(container)) return;

    // TH-17: Apply classifier to ensure mutual exclusivity
    const carouselType = classifyCarouselContainer(container);
    if (carouselType !== "image") return;

    // Require >=2 images
    const images = container.querySelectorAll("img, picture img");
    if (images.length < 2) return;

    // Require >=1 nav/pagination control
    if (!hasCarouselControls(container)) return;

    // Reject single-image hero patterns (if only 1 unique image)
    const uniqueImages = new Set<string>();
    images.forEach((img) => {
      const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
      if (src) uniqueImages.add(src);
    });
    if (uniqueImages.size < 2) return;

    imageCarousels.push({ element: container, imageCount: images.length });
  });

  if (imageCarousels.length === 0) return null;

  const itemCounts = imageCarousels.map((c) => c.imageCount);
  const evidence = `image_carousel: ${imageCarousels.length} (deduped), items=[${itemCounts.join(",")}], controls=yes, type=image`;

  return {
    componentKey: "image_carousel",
    instanceCount: imageCarousels.length,
    confidence: "medium",
    evidence,
  };
}

/**
 * Helper: Check if element has horizontal scrolling carousel characteristics
 */
function isScrollableCarousel(element: Element): boolean {
  const computedStyle = element.getAttribute("style") || "";
  const className = element.className || "";

  // Check for overflow-x or scroll-snap
  if (
    computedStyle.includes("overflow-x") ||
    computedStyle.includes("scroll-snap") ||
    className.includes("scroll") ||
    className.includes("snap")
  ) {
    return true;
  }

  // Check for ARIA carousel role
  if (element.getAttribute("role") === "region") {
    const ariaDesc = element.getAttribute("aria-roledescription");
    if (ariaDesc && ariaDesc.toLowerCase().includes("carousel")) {
      return true;
    }
  }

  return false;
}

/**
 * Detects card carousel (repeated card items with navigation)
 * Hardened with robust nested deduplication and structural validation
 * Loosened card-like validation to reduce false negatives
 */
function detectCardCarousel(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  // Step 1: Collect raw candidates
  const rawCandidates: Element[] = [];
  const carouselKeywords = ["carousel", "slider", "swiper", "slick"];

  carouselKeywords.forEach((keyword) => {
    const elements = contentRoot.querySelectorAll(
      `[class*="${keyword}"], [id*="${keyword}"], [data-component*="${keyword}"]`,
    );

    elements.forEach((el) => {
      if (isInGlobalChrome(el)) return;
      if (isAEMLayoutWrapper(el)) return;
      if (!rawCandidates.includes(el)) {
        rawCandidates.push(el);
      }
    });
  });

  // Also look for containers with carousel controls
  const controlSelectors = [
    ".swiper-pagination",
    ".slick-dots",
    '[class*="pagination"]',
    '[class*="dots"]',
  ];

  controlSelectors.forEach((selector) => {
    const controls = contentRoot.querySelectorAll(selector);
    controls.forEach((control) => {
      const container = control.parentElement;
      if (!container) return;
      if (isInGlobalChrome(container)) return;
      if (isAEMLayoutWrapper(container)) return;
      if (!rawCandidates.includes(container)) {
        rawCandidates.push(container);
      }
    });
  });

  if (rawCandidates.length === 0) return null;

  // Step 2: Robust nested deduplication (outermost-only)
  const sortedCandidates = rawCandidates.sort(
    (a, b) => getDOMDepth(a) - getDOMDepth(b),
  );

  const deduped: Element[] = [];
  sortedCandidates.forEach((candidate) => {
    const isNested = deduped.some((accepted) => accepted.contains(candidate));
    if (!isNested) {
      deduped.push(candidate);
    }
  });

  // Step 3: Apply acceptance rules (loosened structural validation)
  const cardCarousels: Array<{
    element: Element;
    cardCount: number;
    hasControls: boolean;
    isScrollable: boolean;
  }> = [];

  deduped.forEach((container) => {
    // Skip if nested within media_text_split (no double-count)
    if (isWithinMediaTextSplit(container)) return;

    // TH-17: Apply classifier to ensure mutual exclusivity
    const carouselType = classifyCarouselContainer(container);
    if (carouselType !== "card") return;

    // Loosened card-like item validation:
    // Look for card-like items (direct children OR deeper descendants)
    // - Each item must have: link (a[href]) AND (heading h2-h6 OR media)

    // Try direct children first
    let cardLikeItems = Array.from(container.children).filter((child) => {
      const hasLink = child.querySelector("a[href]") !== null;
      if (!hasLink) return false;

      const hasHeading =
        child.querySelector("h2, h3, h4, h5, h6") !== null ||
        child.querySelector('[role="heading"]') !== null;

      const hasImage =
        child.querySelector("img, picture, svg") !== null ||
        child.querySelector('[role="img"]') !== null ||
        child.querySelector("[data-src]") !== null ||
        child.querySelector("[data-lazy]") !== null;

      return hasHeading || hasImage;
    });

    // Fallback: if direct children don't match, look for items with common carousel item classes
    if (cardLikeItems.length < 2) {
      const itemSelectors = [
        '[class*="card"]',
        '[class*="item"]',
        '[class*="slide"]',
        '[class*="tile"]',
      ];

      itemSelectors.forEach((selector) => {
        const items = Array.from(container.querySelectorAll(selector)).filter(
          (item) => {
            // Must be relatively direct (not too deeply nested)
            let parent = item.parentElement;
            let depth = 0;
            while (parent && parent !== container && depth < 5) {
              parent = parent.parentElement;
              depth++;
            }
            if (parent !== container) return false;

            const hasLink = item.querySelector("a[href]") !== null;
            if (!hasLink) return false;

            const hasHeading =
              item.querySelector("h2, h3, h4, h5, h6") !== null ||
              item.querySelector('[role="heading"]') !== null;

            const hasImage =
              item.querySelector("img, picture, svg") !== null ||
              item.querySelector('[role="img"]') !== null ||
              item.querySelector("[data-src]") !== null;

            return hasHeading || hasImage;
          },
        );

        if (items.length > cardLikeItems.length) {
          cardLikeItems = items;
        }
      });
    }

    if (cardLikeItems.length < 2) return;

    // Controls requirement with scrollable fallback
    const hasControls = hasCarouselControls(container);
    const isScrollable = isScrollableCarousel(container);

    if (!hasControls && !isScrollable) return;

    cardCarousels.push({
      element: container,
      cardCount: cardLikeItems.length,
      hasControls,
      isScrollable,
    });
  });

  if (cardCarousels.length === 0) return null;

  const itemCounts = cardCarousels.map((c) => c.cardCount);
  const controlTypes = cardCarousels
    .map((c) => (c.hasControls ? "controls" : "scrollable"))
    .join(",");

  const evidence = `card_carousel: ${cardCarousels.length} (deduped), items=[${itemCounts.join(",")}], ${controlTypes}, type=card`;

  return {
    componentKey: "card_carousel",
    instanceCount: cardCarousels.length,
    confidence: "medium",
    evidence,
  };
}

/**
 * Check if element is a card-like item (structural heuristic)
 * Must have: link + visual media + heading
 */
function isCardLikeItem(element: Element): boolean {
  // Check for non-trivial content (ignore empty/purely decorative)
  const textContent = element.textContent?.trim() || "";
  if (textContent.length < 5) return false; // arbitrary minimum

  // Card-like if it has: heading OR image OR CTA-like link/button
  const hasHeading =
    element.querySelector("h2, h3, h4, h5, h6") !== null ||
    element.querySelector('[role="heading"]') !== null;

  const hasImage =
    element.querySelector("img") !== null ||
    element.querySelector("picture") !== null ||
    element.querySelector("svg") !== null ||
    element.querySelector('[role="img"]') !== null;

  const hasCTA =
    element.querySelector("a[href]") !== null ||
    element.querySelector("button") !== null;

  // At least one of the above must be present
  return hasHeading || hasImage || hasCTA;
}

/**
 * Check if section contains product/offers-related card links (not support/teaser links)
 * Cards sections should focus on vehicle/product/offers content, not support/owners teasers.
 */
function sectionLooksLikeProductOrOffer(sectionEl: Element): boolean {
  // Collect all hrefs from card links within the section
  const links = Array.from(sectionEl.querySelectorAll("a[href]"));
  const hrefs = links
    .map((a) => {
      const href = a.getAttribute("href") || "";
      // Normalize: lowercase, handle both relative and absolute URLs
      return href.toLowerCase().trim();
    })
    .filter((h) => h.length > 1 && h !== "#"); // Filter out empty and anchor-only links

  if (hrefs.length === 0) return false;

  // Denylist: exclude support/owners/teaser-related paths
  const denylistPatterns = [
    "/owners",
    "/customer-service",
    "/roadside",
    "/breakdown",
    "/manual",
    "/support",
    "/contact",
    "/help",
  ];

  // Allowlist: include product/offers/vehicle-related paths
  const allowlistPatterns = [
    "/vehicles",
    "/offers",
    "/electric-vehicles",
    "/finance",
    "/business",
    "/fleet",
    // Common UK model pages
    "/qashqai",
    "/juke",
    "/ariya",
    "/leaf",
    "/x-trail",
    "/townstar",
    "/navara",
    "/gt-r",
    "/z",
    "/micra",
  ];

  let allowlistMatches = 0;
  let denylistMatches = 0;

  hrefs.forEach((href) => {
    // Check denylist
    if (denylistPatterns.some((pattern) => href.includes(pattern))) {
      denylistMatches++;
    }
    // Check allowlist
    if (allowlistPatterns.some((pattern) => href.includes(pattern))) {
      allowlistMatches++;
    }
  });

  // If any denylist match, exclude this section (support/owners teasers)
  if (denylistMatches > 0) return false;

  // Require at least 1 allowlist match (product/offers intent)
  return allowlistMatches >= 1;
}

/**
 * Detects cards/listing sections (content sections with multiple card-like items)
 * AEM uses "grid" for layout scaffolding, so we count card/listing sections instead.
 */
function detectCardsSection(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  const candidates: Element[] = [];

  // Search for potential container elements
  contentRoot
    .querySelectorAll("div, section, ul, ol, article")
    .forEach((container) => {
      if (isInGlobalChrome(container)) return;
      if (isAEMLayoutWrapper(container)) return; // Skip AEM wrappers as candidates

      // Hard rule: exclude footer containers
      if (container.closest('footer, [role="contentinfo"]')) return;

      // Count direct children that are card-like
      const cardLikeChildren = Array.from(container.children).filter((child) =>
        isCardLikeItem(child),
      );

      // Minimum 3 cards required
      if (cardLikeChildren.length >= 3) {
        candidates.push(container);
      }
    });

  if (candidates.length === 0) return null;

  // Deduplicate nested: keep only outermost
  const outermost = candidates.filter((candidate) => {
    const hasParent = candidates.some(
      (other) => other !== candidate && other.contains(candidate),
    );
    return !hasParent;
  });

  if (outermost.length === 0) return null;

  // Filter: keep only sections with product/offers intent (not support/teasers)
  const productOfferSections = outermost.filter((section) =>
    sectionLooksLikeProductOrOffer(section),
  );

  if (productOfferSections.length === 0) return null;

  // Gather items_per_section for evidence
  const itemsPerSection = productOfferSections.map((section) => {
    const cardLikeChildren = Array.from(section.children).filter((child) =>
      isCardLikeItem(child),
    );
    return cardLikeChildren.length;
  });

  const evidence = `cards_section: ${productOfferSections.length} sections, items_per_section=[${itemsPerSection.join(",")}]`;

  return {
    componentKey: "cards_section",
    instanceCount: productOfferSections.length,
    confidence: "medium",
    evidence,
  };
}

/**
 * Detects icon grid (repeated icon+text items)
 */
function detectIconGrid(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  const iconKeywords = ["icon", "feature", "benefit"];
  const possibleIconContainers: Element[] = [];

  iconKeywords.forEach((keyword) => {
    const elements = doc.querySelectorAll(`[class*="${keyword}"]`);
    elements.forEach((el) => {
      if (isInGlobalChrome(el)) return;
      if (!contentRoot.contains(el)) return;
      if (isAEMLayoutWrapper(el)) return;

      if (el.children.length >= 3 && !possibleIconContainers.includes(el)) {
        possibleIconContainers.push(el);
      }
    });
  });

  // Verify items have icon + text structure
  const iconGrids = possibleIconContainers.filter((container) => {
    const items = Array.from(container.children);
    const itemsWithIconAndText = items.filter((item) => {
      const hasIcon = item.querySelector('svg, img, [class*="icon"]');
      const hasText = (item.textContent?.trim().length || 0) >= 10;
      return hasIcon && hasText;
    });

    return itemsWithIconAndText.length >= 3;
  });

  if (iconGrids.length === 0) return null;

  return {
    componentKey: "icon_grid",
    instanceCount: iconGrids.length,
    confidence: "medium",
    evidence: `${iconGrids.length} icon grid(s) with icon+text items`,
  };
}

/**
 * Helper: Check if element has media content (image/video/carousel)
 * Returns media_type: 'carousel' | 'video' | 'image' | null
 */
function hasMediaContent(element: Element): string | null {
  // Check for carousel first (highest priority)
  const carouselIndicators = element.querySelectorAll(
    '[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="slick"], ' +
      '.swiper-pagination, .slick-dots, [class*="pagination"], [class*="dots"]',
  );
  if (carouselIndicators.length > 0) {
    return "carousel";
  }

  // Check for video
  const videoElement = element.querySelector("video");
  if (videoElement) {
    return "video";
  }

  // Check for video iframe (YouTube, Vimeo)
  const iframes = element.querySelectorAll("iframe");
  for (const iframe of Array.from(iframes)) {
    const src = iframe.getAttribute("src") || "";
    if (
      src.includes("youtube.com") ||
      src.includes("youtu.be") ||
      src.includes("vimeo.com") ||
      src.includes("player.vimeo.com")
    ) {
      return "video";
    }
  }

  // Check for image
  const imgElement = element.querySelector("img, picture");
  if (imgElement) {
    return "image";
  }

  // Check for background-image
  const style = (element as HTMLElement).style;
  if (style.backgroundImage && style.backgroundImage !== "none") {
    return "image";
  }

  // Check computed/inline background-image on media wrappers
  const mediaWrappers = element.querySelectorAll(
    '[class*="media"], [class*="image"], [class*="picture"], [class*="visual"]',
  );
  for (const wrapper of Array.from(mediaWrappers)) {
    const wrapperStyle = (wrapper as HTMLElement).style;
    if (
      wrapperStyle.backgroundImage &&
      wrapperStyle.backgroundImage !== "none"
    ) {
      return "image";
    }
  }

  return null;
}

/**
 * Detects media_text_split blocks (two-column layout: media + text)
 * Assigns media_type variant: image | video | carousel
 */
function detectMediaTextSplit(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  const splits: Array<{ element: Element; mediaType: string }> = [];

  // Find potential split containers
  // Look for sections, divs, articles with 2-column structure
  contentRoot.querySelectorAll("section, div, article").forEach((container) => {
    if (isInGlobalChrome(container)) return;
    if (isAEMLayoutWrapper(container)) return;

    // Get non-wrapper children
    const children = Array.from(container.children).filter(
      (child) => !isAEMLayoutWrapper(child as Element),
    );

    // Must have exactly 2 children for split layout
    if (children.length !== 2) return;

    const child1 = children[0] as Element;
    const child2 = children[1] as Element;

    // Check media content in each child
    const child1MediaType = hasMediaContent(child1);
    const child2MediaType = hasMediaContent(child2);

    // Get text content length
    const child1Text = child1.textContent?.trim().length || 0;
    const child2Text = child2.textContent?.trim().length || 0;

    // Pattern 1: child1 has media, child2 has text
    if (child1MediaType && child2Text >= 100) {
      splits.push({ element: container, mediaType: child1MediaType });
      return;
    }

    // Pattern 2: child2 has media, child1 has text
    if (child2MediaType && child1Text >= 100) {
      splits.push({ element: container, mediaType: child2MediaType });
      return;
    }
  });

  if (splits.length === 0) return null;

  // Count media_type variants
  const mediaTypes = splits.map((s) => s.mediaType);
  const mediaTypeList = mediaTypes.join(",");

  return {
    componentKey: "media_text_split",
    instanceCount: splits.length,
    confidence: "medium",
    evidence: `media_text_split: ${splits.length} blocks, media_types=[${mediaTypeList}]`,
  };
}

/**
 * Check if element is sticky or fixed positioned
 */
function isStickyOrFixed(element: Element): boolean {
  const style = element.getAttribute("style") || "";
  const className = element.className || "";

  // Check inline styles
  if (style.includes("position: sticky") || style.includes("position: fixed")) {
    return true;
  }

  // Check common class patterns
  if (className.includes("sticky") || className.includes("fixed")) {
    return true;
  }

  return false;
}

/**
 * Helper: Check if element is a hero-like block
 * Large container with heading + (image OR CTA)
 */
function isHeroLikeBlock(element: Element): boolean {
  // Must have a heading
  const hasHeading = element.querySelector("h1, h2, [role='heading']") !== null;
  if (!hasHeading) return false;

  // Must have either image OR CTA/button
  const hasImage = element.querySelector("img, picture, video") !== null;
  const hasCTA = element.querySelector("a, button") !== null;

  if (!hasImage && !hasCTA) return false;

  // Require substantial content (avoid small blocks)
  const textLength = element.textContent?.trim().length || 0;
  if (textLength < 30) return false;

  return true;
}

/**
 * Detects hero and promo_section blocks
 * Hero = first content block in normal flow
 * Promo = hero-like blocks that are NOT first
 */
function detectHeroAndPromo(dom: JSDOM): ComponentDetection[] {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);
  const results: ComponentDetection[] = [];

  // Get all elements in document order (not just contentRoot) for position checking
  const allDocElements = Array.from(doc.body.querySelectorAll("*"));

  // Find all hero-like candidates within contentRoot with their DOM positions
  const candidates: Array<{ element: Element; domIndex: number }> = [];

  contentRoot.querySelectorAll("section, div, article").forEach((container) => {
    if (isInGlobalChrome(container)) return;
    if (isAEMLayoutWrapper(container)) return;

    if (isHeroLikeBlock(container)) {
      const domIndex = allDocElements.indexOf(container);
      candidates.push({ element: container, domIndex });
    }
  });

  if (candidates.length === 0) return results;

  // Sort by DOM order
  candidates.sort((a, b) => a.domIndex - b.domIndex);

  // Check for blocking content before first candidate
  const firstCandidate = candidates[0];
  let hasBlockingContent = false;

  // Check all elements before the first candidate (in full document)
  for (let i = 0; i < firstCandidate.domIndex; i++) {
    const el = allDocElements[i];

    // Skip sticky/fixed elements (they don't block)
    if (isStickyOrFixed(el)) continue;

    // Skip AEM wrappers
    if (isAEMLayoutWrapper(el)) continue;

    // Check if this element has meaningful content
    const textLength = el.textContent?.trim().length || 0;
    const tagName = el.tagName.toLowerCase();

    // Special case: Check for anchor nav BEFORE global chrome check
    // Anchor nav blocks hero if not sticky, even if it's a <nav> element
    if (tagName === "nav" || tagName === "ul" || tagName === "ol") {
      const anchorLinks = el.querySelectorAll('a[href^="#"]');
      if (anchorLinks.length >= 3 && textLength >= 30) {
        // It's an anchor nav with content - blocks hero if not sticky
        hasBlockingContent = true;
        break;
      }
    }

    // Now skip global chrome (after anchor nav check)
    if (isInGlobalChrome(el)) continue;

    // Skip elements without meaningful content
    if (textLength < 30) continue;

    // Check for other content blocks (section, div, article, aside, alerts, banners)
    if (
      tagName === "section" ||
      tagName === "article" ||
      tagName === "aside" ||
      el.getAttribute("role") === "alert" ||
      el.getAttribute("role") === "banner"
    ) {
      // This is a content block that blocks hero
      hasBlockingContent = true;
      break;
    }

    // Check for div with substantial content
    if (tagName === "div" && textLength >= 50 && !isAEMLayoutWrapper(el)) {
      hasBlockingContent = true;
      break;
    }
  }

  // Classify candidates
  let heroFound = false;
  candidates.forEach((_candidate) => {
    if (!heroFound && !hasBlockingContent) {
      // First candidate with no blocking content = hero
      results.push({
        componentKey: "hero",
        instanceCount: 1,
        confidence: "medium",
        evidence: "hero: 1 (first content block)",
      });
      heroFound = true;
    } else {
      // All others or if blocked = promo_section
      results.push({
        componentKey: "promo_section",
        instanceCount: 1,
        confidence: "medium",
        evidence: "promo_section: 1 (not first content block)",
      });
    }
  });

  return results;
}

/**
 * Detects info_specs blocks (metric tiles only)
 * Nissan-style metric tiles: 3-12 tiles with metric values + labels
 */
function detectInfoSpecs(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  const infoSpecsBlocks: Array<{ container: Element; tiles: Element[] }> = [];

  // Find potential containers (sections, divs, articles, lists)
  contentRoot
    .querySelectorAll("section, div, article, ul, ol")
    .forEach((container) => {
      // Exclude global chrome
      if (isInGlobalChrome(container)) return;

      // Exclude footer explicitly
      if (container.closest('footer, [role="contentinfo"]')) return;

      // Exclude AEM layout wrappers
      if (isAEMLayoutWrapper(container)) return;

      // Get direct children (potential tiles)
      const children = Array.from(container.children).filter(
        (child) => !isAEMLayoutWrapper(child as Element),
      );

      // Must have 3-12 tiles
      if (children.length < 3 || children.length > 12) return;

      // Check if children qualify as metric tiles
      const metricTiles = children.filter((child) => {
        const element = child as Element;

        // Get all text content from element
        const textContent = element.textContent?.trim() || "";
        if (textContent.length === 0) return false;

        // Check for primary links/CTAs - exclude if present
        const primaryLinks = element.querySelectorAll("a[href], button");
        if (primaryLinks.length > 0) {
          // Allow if link is minimal (just wrapping, not prominent CTA)
          const linkText = Array.from(primaryLinks)
            .map((link) => link.textContent?.trim().length || 0)
            .reduce((sum, len) => sum + len, 0);
          const totalText = textContent.length;
          // If links are >50% of content, it's a CTA tile, not info_specs
          if (linkText > totalText * 0.5) return false;
        }

        // Look for metric-like value (digits or alphanumeric metric tokens)
        const hasMetricValue =
          /\d/.test(textContent) || // Contains digits
          /\b(2WD|4WD|AWD|FWD|RWD)\b/i.test(textContent) || // Drive types
          /\b\d+\s*(seats?)\b/i.test(textContent); // Seats pattern

        if (!hasMetricValue) return false;

        // Optional: boost confidence with unit signals (not required)
        const hasUnitSignal =
          /(miles?|mins?|minutes?|km|kW|kg|liters?|litres?|m3|Nm|g\/km|mpg|%|seats?|WD)\b/i.test(
            textContent,
          );

        // Look for label/description (text that's not just the value)
        // Split by newlines/breaks to find separate text segments
        const textSegments = textContent
          .split(/\n|<br>/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        // Metric tile should have at least 2 text segments (value + label)
        // OR have a unit signal with descriptive text
        const hasLabel = textSegments.length >= 2 || hasUnitSignal;

        // Avoid long paragraphs - metric tiles are concise
        const isNotLongParagraph = textContent.length < 200;

        return hasMetricValue && hasLabel && isNotLongParagraph;
      });

      // Must have at least 3 metric tiles
      if (metricTiles.length >= 3) {
        infoSpecsBlocks.push({
          container,
          tiles: metricTiles as Element[],
        });
      }
    });

  if (infoSpecsBlocks.length === 0) return null;

  // Generate evidence with sample values
  const firstBlock = infoSpecsBlocks[0];
  const sampleTiles = firstBlock.tiles.slice(0, 3);
  const sampleValues = sampleTiles
    .map((tile) => {
      const text = tile.textContent?.trim() || "";
      // Extract first line or first 30 chars
      const firstLine = text.split(/\n/)[0].trim();
      return firstLine.slice(0, 30);
    })
    .join("; ");

  const evidence = `info_specs: ${firstBlock.tiles.length} tiles, sample=[${sampleValues}]`;

  return {
    componentKey: "info_specs",
    instanceCount: infoSpecsBlocks.length,
    confidence: "medium",
    evidence,
  };
}

/**
 * Helper: Check if container is full-width section (outermost, not embedded)
 * "Full-width" means section-level block in content flow, not a small nested fragment
 */
function isFullWidthSection(element: Element, contentRoot: Element): boolean {
  // Must be inside content root
  if (!contentRoot.contains(element)) return false;

  // Reject if within a card item or list item (embedded context)
  if (element.closest('[class*="card"], li')) return false;

  // Check DOM depth - full-width sections should be relatively shallow
  // Count non-wrapper ancestors up to contentRoot
  let depth = 0;
  let current = element.parentElement;
  while (current && current !== contentRoot) {
    if (!isAEMLayoutWrapper(current)) {
      depth++;
    }
    current = current.parentElement;
  }

  // Full-width sections should be at most 3-4 meaningful containers deep
  if (depth > 4) return false;

  return true;
}

/**
 * Detects next_action_panel (full-width section with CTA actions)
 * Two variants:
 * A) Icon tiles (≥3 action items with icons)
 * B) Large CTA button row (1-4 prominent buttons)
 */
function detectNextActionPanel(dom: JSDOM): ComponentDetection | null {
  const doc = dom.window.document;
  const contentRoot = getContentRoot(doc);

  const nextActionPanels: Array<{
    container: Element;
    actionCount: number;
    variant: "tiles" | "buttons";
  }> = [];

  // Find potential containers (section-level blocks)
  contentRoot.querySelectorAll("section, div, article").forEach((container) => {
    // Exclude global chrome
    if (isInGlobalChrome(container)) return;

    // Exclude footer explicitly
    if (container.closest('footer, [role="contentinfo"]')) return;

    // Exclude AEM layout wrappers
    if (isAEMLayoutWrapper(container)) return;

    // Must be full-width section (outermost, not embedded)
    if (!isFullWidthSection(container, contentRoot)) return;

    // Get direct children (potential action items)
    const children = Array.from(container.children).filter(
      (child) => !isAEMLayoutWrapper(child as Element),
    );

    // Variant A: Icon tiles (3-8 items)
    if (children.length >= 3 && children.length <= 8) {
      const iconTiles = children.filter((child) => {
        const element = child as Element;

        // Must be primarily a link
        const primaryLink = element.querySelector("a[href]");
        if (!primaryLink) return false;

        // Short label (action tiles are concise)
        const labelText = element.textContent?.trim() || "";
        if (labelText.length < 3 || labelText.length > 100) return false;

        // Icon presence boosts confidence (not strictly required)
        const hasIcon =
          element.querySelector("svg, img, [class*='icon']") !== null;

        return hasIcon || labelText.length <= 50; // Short text acceptable without icon
      });

      if (iconTiles.length >= 3) {
        nextActionPanels.push({
          container,
          actionCount: iconTiles.length,
          variant: "tiles",
        });
        return; // Found as tiles variant, skip button check
      }
    }

    // Variant B: Large CTA button row (1-4 buttons)
    const buttonLikeElements = Array.from(
      container.querySelectorAll("button, a[href]"),
    ).filter((el) => {
      // Must be relatively direct descendant (not too nested)
      let parent = el.parentElement;
      let depth = 0;
      while (parent && parent !== container && depth < 3) {
        parent = parent.parentElement;
        depth++;
      }
      if (parent !== container) return false;

      // Check if button-like (not inline text link)
      const element = el as Element;
      const tagName = element.tagName.toLowerCase();

      // Buttons are always button-like
      if (tagName === "button") return true;

      // For <a>, check if styled as button (class patterns)
      const className = element.className || "";
      const isButtonStyled = /\b(btn|button|cta|primary|secondary)\b/i.test(
        className,
      );

      // Check label length (buttons have short text)
      const labelText = element.textContent?.trim() || "";
      const hasShortLabel = labelText.length >= 3 && labelText.length <= 40;

      return isButtonStyled && hasShortLabel;
    });

    // Count unique buttons (deduplicate if multiple in same wrapper)
    const uniqueButtons = new Set(buttonLikeElements);
    const buttonCount = uniqueButtons.size;

    if (buttonCount >= 1 && buttonCount <= 4) {
      // Additional check: avoid false positives from body text links
      // Require at least one <button> element OR explicit button styling
      const hasExplicitButton = Array.from(uniqueButtons).some((btn) => {
        return (
          btn.tagName.toLowerCase() === "button" ||
          /\b(btn|button|cta)\b/i.test(btn.className || "")
        );
      });

      if (hasExplicitButton) {
        // Avoid counting if container looks like cards_section
        // (next_action_panel buttons are standalone, not per-card CTAs)
        const looksLikeCards = children.some((child) =>
          isCardLikeItem(child as Element),
        );

        if (!looksLikeCards) {
          nextActionPanels.push({
            container,
            actionCount: buttonCount,
            variant: "buttons",
          });
        }
      }
    }
  });

  if (nextActionPanels.length === 0) return null;

  // Generate evidence
  const firstPanel = nextActionPanels[0];
  const evidence = `next_action_panel: ${firstPanel.actionCount} actions, variant=${firstPanel.variant}`;

  return {
    componentKey: "next_action_panel",
    instanceCount: nextActionPanels.length,
    confidence: "medium",
    evidence,
  };
}

/**
 * Main analysis function: runs all detectors
 */
export function analyzeComponents(html: string): ComponentDetection[] {
  const dom = new JSDOM(html);
  const detections: ComponentDetection[] = [];

  const detectors = [
    detectTabs,
    detectAccordion,
    detectAnchorNav,
    detectImageCarousel,
    detectCardCarousel,
    detectCardsSection, // Renamed from detectCardsGrid
    detectIconGrid,
    detectMediaTextSplit,
    detectInfoSpecs,
    detectNextActionPanel,
  ];

  detectors.forEach((detector) => {
    try {
      const result = detector(dom);
      if (result) {
        detections.push(result);
      }
    } catch (error) {
      console.error(`Detector ${detector.name} failed:`, error);
    }
  });

  // Run hero/promo detector (returns array)
  try {
    const heroPromoResults = detectHeroAndPromo(dom);
    detections.push(...heroPromoResults);
  } catch (error) {
    console.error(`Detector detectHeroAndPromo failed:`, error);
  }

  return detections;
}
