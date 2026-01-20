import express, { Request, Response } from "express";
import cors from "cors";
import db from "./db";
import { discoverUrlsFromSitemap, deduplicateUrls } from "./inventory";
import { FetchJob } from "./fetch-job";
import { writeHtmlCache, readHtmlCache } from "./html-cache";
import { analyzeComponents } from "./david-components";
import PQueue from "p-queue";

const app = express();
const PORT = process.env.PORT || 3002;

// Track active fetch jobs
let activeFetchJob: FetchJob | null = null;
let activeBackfillJob: PQueue | null = null;
let activeAnalysisJob: {
  running: boolean;
  processed: number;
  total: number;
} | null = null;

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/snapshots", (_req: Request, res: Response) => {
  res.json({
    snapshots: [
      {
        id: "GLOBAL_POC_2026_01",
        timestamp: "2026-01-13T00:00:00Z",
        markets: ["UK", "JP", "US"],
      },
    ],
  });
});

app.get("/api/inventory/build", async (req: Request, res: Response) => {
  const { market, base } = req.query;

  if (!market || typeof market !== "string") {
    return res.status(400).json({ error: "market parameter is required" });
  }

  if (!base || typeof base !== "string") {
    return res.status(400).json({ error: "base URL parameter is required" });
  }

  try {
    console.log(`Starting URL discovery for ${market} at ${base}`);

    // Discover URLs from sitemap
    const discoveredUrls = await discoverUrlsFromSitemap(base);
    console.log(`Discovered ${discoveredUrls.length} URLs from sitemap`);

    // Deduplicate URLs
    const uniqueUrls = deduplicateUrls(discoveredUrls);
    console.log(`After deduplication: ${uniqueUrls.length} unique URLs`);

    // Insert into database with UPSERT to backfill sitemap_lastmod
    const insert = db.prepare(`
      INSERT INTO url_inventory (market, url, discovered_from, status, sitemap_lastmod, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
      ON CONFLICT(market, url) DO UPDATE SET
        sitemap_lastmod = COALESCE(excluded.sitemap_lastmod, url_inventory.sitemap_lastmod),
        updated_at = datetime('now')
    `);

    const insertMany = db.transaction((urls) => {
      for (const { url, discovered_from, lastmod } of urls) {
        insert.run(market, url, discovered_from, lastmod || null);
      }
    });

    insertMany(uniqueUrls);

    // Get stats
    const stats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'fetched' THEN 1 ELSE 0 END) as fetched,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
      FROM url_inventory
      WHERE market = ?
    `,
      )
      .get(market) as {
      total: number;
      pending: number;
      fetched: number;
      failed: number;
      skipped: number;
    };

    res.json({
      success: true,
      market,
      discovered: discoveredUrls.length,
      unique: uniqueUrls.length,
      inserted: uniqueUrls.length,
      inventory_stats: stats,
    });
  } catch (error) {
    console.error("Error building inventory:", error);
    res.status(500).json({
      error: "Failed to build inventory",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/inventory/stats", (_req: Request, res: Response) => {
  const stats = db
    .prepare(
      `
    SELECT 
      market,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'fetched' THEN 1 ELSE 0 END) as fetched,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
    FROM url_inventory
    GROUP BY market
  `,
    )
    .all();

  res.json({ stats });
});

app.post("/api/fetch/start", async (req: Request, res: Response) => {
  const { market, concurrency, batchSize } = req.body;

  if (!market || typeof market !== "string") {
    return res.status(400).json({ error: "market parameter is required" });
  }

  if (activeFetchJob) {
    return res.status(409).json({
      error: "Fetch job already running",
      message: "Wait for current job to complete or cancel it first",
    });
  }

  try {
    activeFetchJob = new FetchJob({
      market,
      concurrency: concurrency || 2,
      requestDelay: 1000,
      batchSize: batchSize || 100,
      maxRetries: 3,
    });

    // Run job in background
    const jobPromise = activeFetchJob.run();

    // Don't wait for completion, respond immediately
    res.json({
      success: true,
      message: "Fetch job started",
      config: {
        market,
        concurrency: concurrency || 2,
        batchSize: batchSize || 100,
      },
    });

    // Wait for job to complete in background
    const result = await jobPromise;
    activeFetchJob = null;

    console.log("Fetch job finished:", result);
  } catch (error) {
    activeFetchJob = null;
    console.error("Error in fetch job:", error);
  }
});

app.get("/api/fetch/status", (_req: Request, res: Response) => {
  if (!activeFetchJob) {
    return res.json({
      running: false,
      stats: null,
    });
  }

  res.json({
    running: true,
    stats: activeFetchJob.getStats(),
  });
});

app.get("/api/inventory/render-stats", (_req: Request, res: Response) => {
  const stats = db
    .prepare(
      `
    SELECT 
      market,
      render_mode,
      COUNT(*) as count
    FROM url_inventory
    WHERE render_mode IS NOT NULL
    GROUP BY market, render_mode
    ORDER BY market, render_mode
  `,
    )
    .all();

  res.json({ stats });
});

app.post("/api/html-cache/backfill", async (req: Request, res: Response) => {
  const { market, batchSize, concurrency, onlyUnique } = req.body;

  if (!market || typeof market !== "string") {
    return res.status(400).json({ error: "market parameter is required" });
  }

  if (activeBackfillJob) {
    return res.status(409).json({
      error: "Backfill job already running",
      message: "Wait for current job to complete",
    });
  }

  const batchSizeValue = batchSize || 200;
  const concurrencyValue = concurrency || 3;
  const onlyUniqueValue = onlyUnique !== false; // default true

  try {
    // Build query to select URLs needing HTML cache
    let query = `
      SELECT id, url, final_url
      FROM url_inventory
      WHERE market = ?
        AND status = 'fetched'
        AND (html_path IS NULL OR html_path = '')
    `;

    if (onlyUniqueValue) {
      query += ` AND duplicate_of_id IS NULL`;
    }

    query += ` LIMIT ?`;

    const urlsToCache = db.prepare(query).all(market, batchSizeValue) as Array<{
      id: number;
      url: string;
      final_url: string | null;
    }>;

    if (urlsToCache.length === 0) {
      return res.json({
        success: true,
        message: "No URLs need HTML caching",
        processed: 0,
      });
    }

    console.log(
      `Starting HTML cache backfill for ${market}: ${urlsToCache.length} URLs`,
    );

    // Create queue for controlled concurrency
    activeBackfillJob = new PQueue({
      concurrency: concurrencyValue,
      interval: 1000,
      intervalCap: 1,
    });

    const stats = {
      processed: 0,
      cached: 0,
      failed: 0,
    };

    // Respond immediately
    res.json({
      success: true,
      message: "Backfill job started",
      config: {
        market,
        batchSize: batchSizeValue,
        concurrency: concurrencyValue,
        onlyUnique: onlyUniqueValue,
        urls: urlsToCache.length,
      },
    });

    // Process URLs in background
    const processUrl = async (record: {
      id: number;
      url: string;
      final_url: string | null;
    }) => {
      const targetUrl = record.final_url || record.url;

      try {
        // Fetch HTML
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(targetUrl, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Write to cache
        const htmlPath = await writeHtmlCache({
          market,
          urlId: record.id,
          html,
        });

        // Update database
        db.prepare(
          `
          UPDATE url_inventory
          SET html_path = ?,
              html_fetched_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `,
        ).run(htmlPath, record.id);

        stats.cached++;
        console.log(`  ✓ Cached: ${targetUrl}`);
      } catch (error) {
        stats.failed++;
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`  ✗ Failed: ${targetUrl} - ${errorMsg}`);
      } finally {
        stats.processed++;
      }
    };

    // Add all URLs to queue
    const promises = urlsToCache.map((record) =>
      activeBackfillJob!.add(() => processUrl(record)),
    );

    // Wait for completion
    await Promise.all(promises);

    console.log("\nBackfill job completed:");
    console.log(`  Processed: ${stats.processed}`);
    console.log(`  Cached: ${stats.cached}`);
    console.log(`  Failed: ${stats.failed}`);

    activeBackfillJob = null;
  } catch (error) {
    activeBackfillJob = null;
    console.error("Error in backfill job:", error);
  }
});

app.get("/api/html-cache/status", (req: Request, res: Response) => {
  const { market } = req.query;

  if (!market || typeof market !== "string") {
    return res.status(400).json({ error: "market parameter is required" });
  }

  const stats = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total_fetched_unique,
      SUM(CASE WHEN html_path IS NOT NULL AND html_path != '' THEN 1 ELSE 0 END) as cached,
      SUM(CASE WHEN (html_path IS NULL OR html_path = '') THEN 1 ELSE 0 END) as remaining
    FROM url_inventory
    WHERE market = ?
      AND status = 'fetched'
      AND duplicate_of_id IS NULL
  `,
    )
    .get(market) as {
    total_fetched_unique: number;
    cached: number;
    remaining: number;
  };

  res.json({
    market,
    running: activeBackfillJob !== null,
    stats,
  });
});

// Phase 2: David component analysis
async function resetDavidAnalysisIfRequested(market: string, reset: boolean) {
  if (!reset) return;

  console.log("Resetting existing analysis data...");
  const urlIds = db
    .prepare(
      `SELECT id FROM url_inventory WHERE market = ? AND status = 'fetched' AND duplicate_of_id IS NULL`,
    )
    .all(market) as Array<{ id: number }>;

  const urlIdList = urlIds.map((r) => r.id);
  if (urlIdList.length === 0) return;

  const placeholders = urlIdList.map(() => "?").join(",");
  db.prepare(
    `DELETE FROM david_component_usage WHERE url_id IN (${placeholders})`,
  ).run(...urlIdList);

  console.log(`Deleted existing analysis data for ${urlIdList.length} URLs`);
}

async function analyzeEligibleUrlsBatch(params: {
  market: string;
  limit: number;
  offset: number;
}): Promise<{ count: number; processed: number }> {
  const { market, limit, offset } = params;

  const eligibleUrls = db
    .prepare(
      `
          SELECT id, url, html_path
          FROM url_inventory
          WHERE market = ?
            AND status = 'fetched'
            AND duplicate_of_id IS NULL
            AND html_path IS NOT NULL
            AND html_path NOT LIKE '\\_\\_%' ESCAPE '\\'
          ORDER BY id
          LIMIT ? OFFSET ?
        `,
    )
    .all(market, limit, offset) as Array<{
    id: number;
    url: string;
    html_path: string;
  }>;

  const insertStmt = db.prepare(`
        INSERT INTO david_component_usage (url_id, component_key, instance_count, confidence, evidence)
        VALUES (?, ?, ?, ?, ?)
      `);

  let processed = 0;

  for (const record of eligibleUrls) {
    try {
      const html = await readHtmlCache(record.html_path);
      const detections = analyzeComponents(html);

      for (const detection of detections) {
        insertStmt.run(
          record.id,
          detection.componentKey,
          detection.instanceCount,
          detection.confidence,
          detection.evidence,
        );
      }
    } catch (error) {
      console.error(`  Error analyzing ${record.url}:`, error);
    } finally {
      processed++;
    }
  }

  return { count: eligibleUrls.length, processed };
}
app.post(
  "/api/analysis/david-components/run",
  async (req: Request, res: Response) => {
    const { market = "UK", limit = 200, offset = 0, reset = false } = req.body;

    if (activeAnalysisJob?.running) {
      return res.status(409).json({ error: "Analysis job already running" });
    }

    // Start analysis job
    activeAnalysisJob = { running: true, processed: 0, total: 0 };

    res.json({
      success: true,
      message: "Analysis job started",
      config: { market, limit, offset, reset },
    });

    // Run analysis asynchronously
    setImmediate(async () => {
      try {
        console.log(`\nStarting David component analysis for ${market}...`);

        // Reset if requested
        if (reset) {
          console.log("Resetting existing analysis data...");
          const urlIds = db
            .prepare(
              `SELECT id FROM url_inventory WHERE market = ? AND status = 'fetched' AND duplicate_of_id IS NULL`,
            )
            .all(market) as Array<{ id: number }>;

          const urlIdList = urlIds.map((r) => r.id);
          if (urlIdList.length > 0) {
            const placeholders = urlIdList.map(() => "?").join(",");
            db.prepare(
              `DELETE FROM david_component_usage WHERE url_id IN (${placeholders})`,
            ).run(...urlIdList);
            console.log(
              `Deleted existing analysis data for ${urlIdList.length} URLs`,
            );
          }
        }

        // Get eligible URLs
        const eligibleUrls = db
          .prepare(
            `
          SELECT id, url, html_path
          FROM url_inventory
          WHERE market = ?
            AND status = 'fetched'
            AND duplicate_of_id IS NULL
            AND html_path IS NOT NULL
            AND html_path NOT LIKE '\\_\\_%' ESCAPE '\\'
          ORDER BY id
          LIMIT ? OFFSET ?
        `,
          )
          .all(market, limit, offset) as Array<{
          id: number;
          url: string;
          html_path: string;
        }>;

        console.log(`Found ${eligibleUrls.length} eligible URLs to analyze`);
        activeAnalysisJob!.total = eligibleUrls.length;

        const insertStmt = db.prepare(`
        INSERT INTO david_component_usage (url_id, component_key, instance_count, confidence, evidence)
        VALUES (?, ?, ?, ?, ?)
      `);

        // Process each URL
        for (const record of eligibleUrls) {
          try {
            // Read cached HTML
            const html = await readHtmlCache(record.html_path);

            // Analyze components
            const detections = analyzeComponents(html);

            // Insert detections
            for (const detection of detections) {
              insertStmt.run(
                record.id,
                detection.componentKey,
                detection.instanceCount,
                detection.confidence,
                detection.evidence,
              );
            }

            activeAnalysisJob!.processed++;
            if (activeAnalysisJob!.processed % 50 === 0) {
              console.log(
                `  Progress: ${activeAnalysisJob!.processed}/${activeAnalysisJob!.total}`,
              );
            }
          } catch (error) {
            console.error(`  Error analyzing ${record.url}:`, error);
          }
        }

        console.log(
          `\nAnalysis complete: ${activeAnalysisJob!.processed}/${activeAnalysisJob!.total} URLs analyzed`,
        );
        activeAnalysisJob = null;
      } catch (error) {
        console.error("Error in analysis job:", error);
        activeAnalysisJob = null;
      }
    });
  },
);

app.post(
  "/api/analysis/david-components/run-all",
  async (req: Request, res: Response) => {
    const {
      market = "UK",
      batchSize = 200,
      reset = false,
      startOffset = 0,
      maxBatches,
    } = req.body;

    if (activeAnalysisJob?.running) {
      return res.status(409).json({ error: "Analysis job already running" });
    }

    activeAnalysisJob = { running: true, processed: 0, total: 0 };

    res.json({
      success: true,
      message: "Analysis run-all job started",
      config: { market, batchSize, reset, startOffset, maxBatches },
    });

    setImmediate(async () => {
      try {
        console.log(
          `\nStarting David component analysis (run-all) for ${market}...`,
        );

        await resetDavidAnalysisIfRequested(market, !!reset);

        let offset = Number.isFinite(startOffset) ? startOffset : 0;
        const limit = Number.isFinite(batchSize) ? batchSize : 200;
        const max = Number.isFinite(maxBatches) ? maxBatches : undefined;

        let batchIndex = 0;

        while (true) {
          if (max !== undefined && batchIndex >= max) {
            console.log(`Reached maxBatches=${max}. Stopping.`);
            break;
          }

          console.log(
            `\nBatch ${batchIndex + 1}: limit=${limit}, offset=${offset}`,
          );

          const { count, processed } = await analyzeEligibleUrlsBatch({
            market,
            limit,
            offset,
          });

          activeAnalysisJob!.processed += processed;

          if (count === 0) {
            console.log("No more eligible URLs. Done.");
            break;
          }

          offset += count;
          batchIndex++;

          // Lightweight progress log
          console.log(`  Processed so far: ${activeAnalysisJob!.processed}`);

          // If last batch was smaller than requested, we are at the end
          if (count < limit) {
            console.log("Last batch smaller than batchSize. Done.");
            break;
          }
        }

        console.log(
          `\nRun-all complete: processed=${activeAnalysisJob!.processed}`,
        );
        activeAnalysisJob = null;
      } catch (error) {
        console.error("Error in run-all analysis job:", error);
        activeAnalysisJob = null;
      }
    });
  },
);

app.get(
  "/api/analysis/david-components/summary",
  (req: Request, res: Response) => {
    const { market = "UK" } = req.query;

    if (typeof market !== "string") {
      return res.status(400).json({ error: "market must be a string" });
    }

    const summary = db
      .prepare(
        `
      SELECT 
        dcu.component_key,
        COUNT(DISTINCT dcu.url_id) as pages_with_component,
        SUM(dcu.instance_count) as total_instances,
        dcu.confidence,
        GROUP_CONCAT(dcu.evidence, ' | ') as sample_evidence
      FROM david_component_usage dcu
      JOIN url_inventory ui ON dcu.url_id = ui.id
      WHERE ui.market = ?
      GROUP BY dcu.component_key, dcu.confidence
      ORDER BY pages_with_component DESC, dcu.component_key
    `,
      )
      .all(market) as Array<{
      component_key: string;
      pages_with_component: number;
      total_instances: number;
      confidence: string;
      sample_evidence: string;
    }>;

    // Aggregate by component_key (combining confidence levels)
    const aggregated = summary.reduce(
      (acc, row) => {
        const existing = acc.find((r) => r.component_key === row.component_key);
        if (existing) {
          existing.pages_with_component += row.pages_with_component;
          existing.total_instances += row.total_instances;
        } else {
          acc.push({
            component_key: row.component_key,
            pages_with_component: row.pages_with_component,
            total_instances: row.total_instances,
          });
        }
        return acc;
      },
      [] as Array<{
        component_key: string;
        pages_with_component: number;
        total_instances: number;
      }>,
    );

    res.json({
      market,
      running: activeAnalysisJob?.running || false,
      progress: activeAnalysisJob
        ? {
            processed: activeAnalysisJob.processed,
            total: activeAnalysisJob.total,
          }
        : null,
      summary: aggregated,
      details: summary,
    });
  },
);

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
