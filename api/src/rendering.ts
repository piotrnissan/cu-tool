import { JSDOM } from "jsdom";
import { chromium, Browser } from "playwright";
import crypto from "crypto";

export interface DOMSignature {
  hasSemanticBlocks: boolean;
  hasContent: boolean;
  hasSingleRoot: boolean;
  textLength: number;
  blockElements: number;
}

export interface ContentAnalysis {
  canonicalUrl: string | null;
  contentHash: string;
}

/**
 * Extracts canonical URL from HTML
 */
export function extractCanonicalUrl(html: string): string | null {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical?.getAttribute("href") || null;
  } catch {
    return null;
  }
}

/**
 * Computes a content hash for deduplication
 * Uses normalized body text to detect near-duplicates
 */
export function computeContentHash(html: string): string {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract and normalize text content
    const bodyText = document.body?.textContent || "";
    const normalized = bodyText
      .trim()
      .replace(/\s+/g, " ") // Normalize whitespace
      .toLowerCase()
      .substring(0, 10000); // Limit to first 10k chars for consistency

    // Compute SHA-256 hash
    return crypto.createHash("sha256").update(normalized).digest("hex");
  } catch {
    // Fallback: hash the raw HTML
    return crypto.createHash("sha256").update(html).digest("hex");
  }
}

/**
 * Analyzes content for deduplication and canonical info
 */
export function analyzeContent(html: string): ContentAnalysis {
  return {
    canonicalUrl: extractCanonicalUrl(html),
    contentHash: computeContentHash(html),
  };
}

/**
 * Analyzes HTML to determine if it's server-rendered or a JS shell
 */
export function analyzeDOMSignature(html: string): DOMSignature {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Check for semantic content blocks
  const semanticBlocks = document.querySelectorAll(
    "section, article, main, aside, header:not(head), nav"
  );
  const hasSemanticBlocks = semanticBlocks.length > 0;

  // Check for single root elements typical of SPA frameworks
  const singleRootIds = ["root", "__next", "app", "__nuxt"];
  const hasSingleRoot = singleRootIds.some((id) => {
    const elem = document.getElementById(id);
    return elem && elem.children.length === 0;
  });

  // Analyze text content density
  const bodyText = document.body?.textContent?.trim() || "";
  const textLength = bodyText.length;

  // Count block-level elements
  const blockElements = document.querySelectorAll(
    "div, section, article, p, ul, ol, table"
  ).length;

  const hasContent = textLength > 500 && blockElements > 10;

  return {
    hasSemanticBlocks,
    hasContent,
    hasSingleRoot,
    textLength,
    blockElements,
  };
}

/**
 * Determines if page needs headless rendering based on DOM signature
 */
export function needsHeadlessRendering(signature: DOMSignature): boolean {
  // If it has semantic blocks and meaningful content, HTML is sufficient
  if (signature.hasSemanticBlocks && signature.hasContent) {
    return false;
  }

  // If it's a single root with no content, needs headless
  if (signature.hasSingleRoot && signature.textLength < 200) {
    return true;
  }

  // If low content density and no semantic structure, needs headless
  if (signature.textLength < 300 && signature.blockElements < 5) {
    return true;
  }

  // Default to HTML rendering
  return false;
}

let browser: Browser | null = null;

/**
 * Gets or initializes the Playwright browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

/**
 * Fetches page content using Playwright for JS-heavy pages
 */
export async function fetchWithPlaywright(
  url: string,
  timeout = 30000
): Promise<{ html: string; status: number }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout,
    });

    const status = response?.status() || 0;
    const html = await page.content();

    await context.close();

    return { html, status };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * Closes the Playwright browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
