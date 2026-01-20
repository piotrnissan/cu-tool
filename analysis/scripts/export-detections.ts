#!/usr/bin/env tsx
/**
 * TH-01: Export component detections from SQLite to JSON
 * Reads proof pack URLs and exports their component detections to detections.json
 */
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

// --- Types ---

interface EvidenceParsed {
  [key: string]: unknown;
}

interface Detection {
  component_key: string;
  instance_count: number;
  confidence: string | null;
  evidence_raw: string | null;
  evidence_parsed: EvidenceParsed | null;
}

interface UrlResult {
  url: string;
  url_id: number | null;
  detections: Detection[];
}

interface Summary {
  total_urls_requested: number;
  total_urls_found_in_inventory: number;
  total_urls_with_detections: number;
  total_detection_rows: number;
}

interface ProofPack {
  vlp: string[];
  editorial: string[];
  homepage: string[];
}

interface Output {
  generated_at: string;
  market: string;
  proof_pack: ProofPack;
  summary: Summary;
  urls: UrlResult[];
}

// --- Configuration ---

const REPO_ROOT = path.resolve(__dirname, "../..");
const DB_PATH = path.join(REPO_ROOT, "api/data/cu-tool.db");
const OUTPUT_PATH = path.join(
  REPO_ROOT,
  "analysis/artifacts/visual-proof/detections.json",
);

const URL_FILES = {
  vlp: path.join(REPO_ROOT, "analysis/visual-proof/pages.vlp.txt"),
  editorial: path.join(REPO_ROOT, "analysis/visual-proof/pages.editorial.txt"),
  homepage: path.join(REPO_ROOT, "analysis/visual-proof/pages.homepage.txt"),
};

const MARKET = "UK";

// --- URL Loading ---

function loadUrlsFromFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const urls = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((url) => url.trim());

  return [...new Set(urls)]; // deduplicate
}

function loadProofPackUrls(): ProofPack {
  return {
    vlp: loadUrlsFromFile(URL_FILES.vlp),
    editorial: loadUrlsFromFile(URL_FILES.editorial),
    homepage: loadUrlsFromFile(URL_FILES.homepage),
  };
}

// --- Evidence Parsing (Best-Effort) ---

function parseEvidence(
  componentKey: string,
  evidenceRaw: string | null,
): EvidenceParsed | null {
  if (!evidenceRaw) return null;

  try {
    switch (componentKey) {
      case "image_carousel":
      case "card_carousel":
        return parseCarouselEvidence(evidenceRaw);

      case "cards_section":
        return parseCardsSectionEvidence(evidenceRaw);

      case "accordion":
        return parseAccordionEvidence(evidenceRaw);

      default:
        return null;
    }
  } catch (err) {
    // Best-effort: never throw
    return null;
  }
}

function parseCarouselEvidence(evidence: string): EvidenceParsed | null {
  // Pattern: "image_carousel: 2 (deduped), items=[3,4], controls=yes"
  // Pattern: "card_carousel: 1 (deduped), items=[6], controls"

  const result: EvidenceParsed = {};

  // Extract items array
  const itemsMatch = evidence.match(/items=\[([^\]]+)\]/);
  if (itemsMatch) {
    const items = itemsMatch[1].split(",").map((s) => parseInt(s.trim(), 10));
    result.items = items;
  }

  // Check for controls
  if (evidence.includes("controls=yes")) {
    result.controls = "yes";
  } else if (evidence.includes("controls=no")) {
    result.controls = "no";
  } else if (evidence.includes("controls")) {
    result.controls = "yes"; // implicit
  }

  // Check for scrollable
  if (evidence.includes("scrollable")) {
    result.scrollable = true;
  }

  // Check for deduped
  if (evidence.includes("deduped")) {
    result.deduped = true;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseCardsSectionEvidence(evidence: string): EvidenceParsed | null {
  // Pattern: "cards_section: 3 sections, items_per_section=[4,3,2]"

  const result: EvidenceParsed = {};

  // Extract sections count
  const sectionsMatch = evidence.match(/(\d+)\s+sections/);
  if (sectionsMatch) {
    result.sections = parseInt(sectionsMatch[1], 10);
  }

  // Extract items_per_section array
  const itemsMatch = evidence.match(/items_per_section=\[([^\]]+)\]/);
  if (itemsMatch) {
    const items = itemsMatch[1].split(",").map((s) => parseInt(s.trim(), 10));
    result.items_per_section = items;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseAccordionEvidence(evidence: string): EvidenceParsed | null {
  // Pattern: "accordion: 1, items=5, source=details"

  const result: EvidenceParsed = {};

  // Extract item count
  const itemsMatch = evidence.match(/items=(\d+)/);
  if (itemsMatch) {
    result.items = parseInt(itemsMatch[1], 10);
  }

  // Extract source
  const sourceMatch = evidence.match(/source=([\w-]+)/);
  if (sourceMatch) {
    result.source = sourceMatch[1];
  }

  return Object.keys(result).length > 0 ? result : null;
}

// --- Database Queries ---

function fetchDetectionsForUrl(
  db: Database.Database,
  url: string,
  market: string,
): { urlId: number | null; detections: Detection[] } {
  // Step 1: Find url_id
  const urlRow = db
    .prepare("SELECT id FROM url_inventory WHERE market = ? AND url = ?")
    .get(market, url) as { id: number } | undefined;

  if (!urlRow) {
    console.warn(`[WARN] URL not in url_inventory (${market}): ${url}`);
    return { urlId: null, detections: [] };
  }

  const urlId = urlRow.id;

  // Step 2: Fetch detections
  const rows = db
    .prepare(
      `SELECT component_key, instance_count, confidence, evidence 
       FROM david_component_usage 
       WHERE url_id = ?`,
    )
    .all(urlId) as Array<{
    component_key: string;
    instance_count: number;
    confidence: string | null;
    evidence: string | null;
  }>;

  if (rows.length === 0) {
    console.warn(
      `[WARN] URL has 0 detections in david_component_usage (not analyzed yet?): ${url}`,
    );
  }

  const detections: Detection[] = rows.map((row) => ({
    component_key: row.component_key,
    instance_count: row.instance_count,
    confidence: row.confidence,
    evidence_raw: row.evidence,
    evidence_parsed: parseEvidence(row.component_key, row.evidence),
  }));

  return { urlId, detections };
}

// --- Main Export Logic ---

function exportDetections(): void {
  console.log("=== TH-01: Export Component Detections ===\n");

  // Step 1: Load proof pack URLs
  console.log("Loading proof pack URLs...");
  const proofPack = loadProofPackUrls();

  const allUrls = [
    ...proofPack.vlp,
    ...proofPack.editorial,
    ...proofPack.homepage,
  ];
  const uniqueUrls = [...new Set(allUrls)];

  console.log(`  VLP:       ${proofPack.vlp.length} URLs`);
  console.log(`  Editorial: ${proofPack.editorial.length} URLs`);
  console.log(`  Homepage:  ${proofPack.homepage.length} URLs`);
  console.log(`  Total:     ${uniqueUrls.length} unique URLs\n`);

  if (uniqueUrls.length !== 5) {
    console.warn(
      `[WARN] Expected 5 URLs, but got ${uniqueUrls.length}. Continuing with what exists.\n`,
    );
  }

  // Step 2: Connect to database
  console.log(`Connecting to database: ${DB_PATH}`);
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERROR] Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  console.log("Database connected.\n");

  // Step 3: Query detections for each URL
  console.log("Querying detections...");
  const results: UrlResult[] = [];
  let foundInInventoryCount = 0;
  let hasDetectionsCount = 0;
  let totalDetectionRows = 0;

  for (const url of uniqueUrls) {
    const { urlId, detections } = fetchDetectionsForUrl(db, url, MARKET);

    if (urlId !== null) {
      foundInInventoryCount++;
    }

    if (detections.length > 0) {
      hasDetectionsCount++;
      totalDetectionRows += detections.length;
    }

    results.push({
      url,
      url_id: urlId,
      detections,
    });
  }

  db.close();
  console.log("Database closed.\n");

  // Step 4: Build output
  const summary: Summary = {
    total_urls_requested: uniqueUrls.length,
    total_urls_found_in_inventory: foundInInventoryCount,
    total_urls_with_detections: hasDetectionsCount,
    total_detection_rows: totalDetectionRows,
  };

  const output: Output = {
    generated_at: new Date().toISOString(),
    market: MARKET,
    proof_pack: proofPack,
    summary,
    urls: results,
  };

  // Step 5: Write output file
  console.log("Writing output...");
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Output written to: ${OUTPUT_PATH}\n`);

  // Step 6: Print summary
  console.log("=== Summary ===");
  console.log(`Total URLs requested:       ${summary.total_urls_requested}`);
  console.log(
    `URLs found in inventory:    ${summary.total_urls_found_in_inventory}`,
  );
  console.log(
    `URLs with detections:       ${summary.total_urls_with_detections}`,
  );
  console.log(`Total detection rows:       ${summary.total_detection_rows}`);
  console.log("\n✅ Export complete!");
}

// --- Entry Point ---

exportDetections();
