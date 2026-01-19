import { setTimeout as delay } from "node:timers/promises";

export interface DiscoveredUrl {
  url: string;
  discovered_from: string;
  lastmod?: string | null;
}

function normalizeUrl(url: string): string {
  // Keep existing behaviour: lowercase + remove trailing slash
  return url.toLowerCase().replace(/\/$/, "");
}

function extractAll(xml: string, tag: string): string[] {
  // Very small, dependency-free extractor for sitemap XML.
  const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

function extractUrlBlocks(xml: string): string[] {
  return xml.match(/<url>[\s\S]*?<\/url>/gi) ?? [];
}

function extractSitemapBlocks(xml: string): string[] {
  return xml.match(/<sitemap>[\s\S]*?<\/sitemap>/gi) ?? [];
}

function looksLikeSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function looksLikeUrlset(xml: string): boolean {
  return /<urlset[\s>]/i.test(xml);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "cu-tool/0.1 (Tech Spike 2 POC)",
      accept: "application/xml,text/xml,*/*",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.text();
}

async function discoverSitemapUrlsFromRobots(
  baseUrl: string
): Promise<string[]> {
  const robotsUrl = `${baseUrl.replace(/\/$/, "")}/robots.txt`;
  try {
    const txt = await fetchText(robotsUrl);
    const lines = txt.split(/\r?\n/);
    const sitemaps = lines
      .map((l) => l.trim())
      .filter((l) => /^sitemap:\s*/i.test(l))
      .map((l) => l.replace(/^sitemap:\s*/i, "").trim())
      .filter(Boolean);

    // Some robots.txt files list duplicates; normalise.
    return Array.from(new Set(sitemaps));
  } catch {
    // Robots may be blocked or missing; fallback handled by caller.
    return [];
  }
}

async function crawlSitemap(
  sitemapUrl: string,
  visited: Set<string>,
  out: DiscoveredUrl[],
  depth: number
): Promise<void> {
  const norm = sitemapUrl.trim();
  if (!norm || visited.has(norm)) return;
  visited.add(norm);

  // Small politeness delay to avoid hammering sitemap indexes.
  if (depth > 0) await delay(50);

  const xml = await fetchText(norm);

  if (looksLikeSitemapIndex(xml)) {
    for (const block of extractSitemapBlocks(xml)) {
      const loc = extractAll(block, "loc")[0];
      if (loc) await crawlSitemap(loc, visited, out, depth + 1);
    }
    return;
  }

  if (looksLikeUrlset(xml)) {
    for (const block of extractUrlBlocks(xml)) {
      const loc = extractAll(block, "loc")[0];
      if (!loc) continue;
      const lastmod = extractAll(block, "lastmod")[0] ?? null;
      out.push({ url: loc, discovered_from: norm, lastmod });
    }
    return;
  }

  // If the XML doesn't match expected sitemap shapes, do nothing.
}

/**
 * Discovers URLs (and lastmod when present) from a website's sitemap(s).
 * - Reads robots.txt Sitemap: entries when available
 * - Falls back to `${baseUrl}/sitemap.xml`
 * - Recursively follows sitemap indexes
 */
export async function discoverUrlsFromSitemap(
  baseUrl: string
): Promise<DiscoveredUrl[]> {
  const base = baseUrl.replace(/\/$/, "");
  const robotsSitemaps = await discoverSitemapUrlsFromRobots(base);
  const seeds =
    robotsSitemaps.length > 0 ? robotsSitemaps : [`${base}/sitemap.xml`];

  const visited = new Set<string>();
  const found: DiscoveredUrl[] = [];

  for (const seed of seeds) {
    try {
      await crawlSitemap(seed, visited, found, 0);
    } catch (error) {
      // Continue with other seeds; caller can still work with partial coverage.
      console.error(`Failed to crawl sitemap ${seed}:`, error);
    }
  }

  return deduplicateUrls(found);
}

/**
 * Deduplicates URLs and normalizes them.
 * Keeps the most recent lastmod (when available) for the normalized URL.
 */
export function deduplicateUrls(urls: DiscoveredUrl[]): DiscoveredUrl[] {
  const map = new Map<string, DiscoveredUrl>();

  for (const item of urls) {
    const normalized = normalizeUrl(item.url);
    const existing = map.get(normalized);

    if (!existing) {
      map.set(normalized, { ...item, url: normalized });
      continue;
    }

    // Preserve earliest discovered_from, but keep newest lastmod.
    const newLastmod = item.lastmod ?? null;
    const oldLastmod = existing.lastmod ?? null;

    let chosenLastmod = oldLastmod;
    if (newLastmod && (!oldLastmod || newLastmod > oldLastmod)) {
      chosenLastmod = newLastmod;
    }

    map.set(normalized, {
      url: normalized,
      discovered_from: existing.discovered_from,
      lastmod: chosenLastmod,
    });
  }

  return Array.from(map.values());
}
