import db from "./db";
import {
  analyzeDOMSignature,
  needsHeadlessRendering,
  fetchWithPlaywright,
  closeBrowser,
  analyzeContent,
} from "./rendering";
import PQueue from "p-queue";

export interface FetchResult {
  success: boolean;
  status: "fetched" | "failed" | "skipped";
  httpStatus?: number;
  renderMode?: "html" | "headless";
  error?: string;
  isDuplicate?: boolean;
}

export interface FetchJobConfig {
  market?: string;
  concurrency?: number;
  requestDelay?: number;
  batchSize?: number;
  maxRetries?: number;
}

export class FetchJob {
  private queue: PQueue;
  private config: Required<FetchJobConfig>;
  private stats = {
    processed: 0,
    fetched: 0,
    failed: 0,
    skipped: 0,
    html: 0,
    headless: 0,
  };

  constructor(config: FetchJobConfig = {}) {
    this.config = {
      market: config.market || "UK",
      concurrency: config.concurrency || 2,
      requestDelay: config.requestDelay || 1000,
      batchSize: config.batchSize || 100,
      maxRetries: config.maxRetries || 3,
    };

    this.queue = new PQueue({
      concurrency: this.config.concurrency,
      interval: this.config.requestDelay,
      intervalCap: 1,
    });
  }

  /**
   * Fetches HTML with retry logic and exponential backoff
   * Returns final URL after redirects
   */
  private async fetchWithRetry(
    url: string,
    retries = 0
  ): Promise<{ html: string; status: number; finalUrl: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml",
        },
      });

      clearTimeout(timeoutId);

      const html = await response.text();
      const finalUrl = response.url; // Captures final URL after redirects

      return { html, status: response.status, finalUrl };
    } catch (error) {
      if (retries < this.config.maxRetries) {
        const backoff = Math.pow(2, retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Checks if content is a duplicate based on hash
   * Returns the ID of the original if duplicate found
   */
  private checkDuplicate(
    contentHash: string,
    currentId: number
  ): number | null {
    const existing = db
      .prepare(
        `
      SELECT id FROM url_inventory
      WHERE content_hash = ? AND id != ? AND status = 'fetched'
      ORDER BY id ASC
      LIMIT 1
    `
      )
      .get(contentHash, currentId) as { id: number } | undefined;

    return existing?.id || null;
  }

  /**
   * Processes a single URL from the inventory
   */
  private async processUrl(record: {
    id: number;
    url: string;
    market: string;
  }): Promise<FetchResult> {
    const { id, url } = record;

    try {
      // Try HTML fetch first
      const {
        html: htmlContent,
        status: htmlStatus,
        finalUrl,
      } = await this.fetchWithRetry(url);

      // Analyze DOM signature
      const signature = analyzeDOMSignature(htmlContent);
      const needsHeadless = needsHeadlessRendering(signature);

      let finalHtml = htmlContent;
      let finalStatus = htmlStatus;
      let renderMode: "html" | "headless" = "html";
      let actualFinalUrl = finalUrl;

      // If needs headless, fetch again with Playwright
      if (needsHeadless) {
        console.log(`  → Retrying with Playwright: ${url}`);
        const playwrightResult = await fetchWithPlaywright(url);
        finalHtml = playwrightResult.html;
        finalStatus = playwrightResult.status;
        renderMode = "headless";
        actualFinalUrl = url; // Playwright doesn't track redirects easily
        this.stats.headless++;
      } else {
        this.stats.html++;
      }

      // Analyze content for deduplication
      const { canonicalUrl, contentHash } = analyzeContent(finalHtml);

      // Check for duplicates
      const duplicateOfId = this.checkDuplicate(contentHash, id);

      if (duplicateOfId) {
        // Mark as skipped duplicate
        db.prepare(
          `
          UPDATE url_inventory
          SET status = 'skipped',
              http_status = ?,
              final_url = ?,
              canonical_url = ?,
              content_hash = ?,
              duplicate_of_id = ?,
              render_mode = ?,
              error_message = ?,
              fetched_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `
        ).run(
          finalStatus,
          actualFinalUrl,
          canonicalUrl,
          contentHash,
          duplicateOfId,
          renderMode,
          `Duplicate content (original: ID ${duplicateOfId})`,
          id
        );

        this.stats.processed++;
        this.stats.skipped++;

        console.log(`  ⊘ Skipped duplicate: ${url} → ID ${duplicateOfId}`);

        return {
          success: true,
          status: "skipped",
          httpStatus: finalStatus,
          renderMode,
          isDuplicate: true,
        };
      }

      // Update database with fetched content
      db.prepare(
        `
        UPDATE url_inventory
        SET status = 'fetched',
            http_status = ?,
            final_url = ?,
            canonical_url = ?,
            content_hash = ?,
            render_mode = ?,
            fetched_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(
        finalStatus,
        actualFinalUrl,
        canonicalUrl,
        contentHash,
        renderMode,
        id
      );

      this.stats.processed++;
      this.stats.fetched++;

      return {
        success: true,
        status: "fetched",
        httpStatus: finalStatus,
        renderMode,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update database with failure
      db.prepare(
        `
        UPDATE url_inventory
        SET status = 'failed',
            error_message = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(errorMessage, id);

      this.stats.processed++;
      this.stats.failed++;

      console.error(`  ✗ Failed: ${url} - ${errorMessage}`);

      return {
        success: false,
        status: "failed",
        error: errorMessage,
      };
    }
  }

  /**
   * Runs the fetch job for pending URLs
   */
  async run(): Promise<{
    completed: boolean;
    stats: {
      processed: number;
      fetched: number;
      failed: number;
      skipped: number;
      html: number;
      headless: number;
    };
  }> {
    console.log(
      `Starting fetch job for market: ${this.config.market} (batch: ${this.config.batchSize})`
    );

    // Get pending URLs
    const pendingUrls = db
      .prepare(
        `
      SELECT id, url, market
      FROM url_inventory
      WHERE market = ? AND status = 'pending'
      LIMIT ?
    `
      )
      .all(this.config.market, this.config.batchSize) as Array<{
      id: number;
      url: string;
      market: string;
    }>;

    if (pendingUrls.length === 0) {
      console.log("No pending URLs to process");
      return { completed: true, stats: this.stats };
    }

    console.log(`Processing ${pendingUrls.length} URLs...`);

    // Add all URLs to the queue
    const promises = pendingUrls.map((record) =>
      this.queue.add(() => this.processUrl(record))
    );

    // Wait for all to complete
    await Promise.all(promises);

    console.log("\nFetch job completed:");
    console.log(`  Processed: ${this.stats.processed}`);
    console.log(`  Fetched: ${this.stats.fetched}`);
    console.log(`  Skipped (duplicates): ${this.stats.skipped}`);
    console.log(`  Failed: ${this.stats.failed}`);
    console.log(`  HTML mode: ${this.stats.html}`);
    console.log(`  Headless mode: ${this.stats.headless}`);

    // Clean up Playwright browser if it was used
    if (this.stats.headless > 0) {
      await closeBrowser();
    }

    return {
      completed: pendingUrls.length < this.config.batchSize,
      stats: this.stats,
    };
  }

  /**
   * Gets current job statistics
   */
  getStats() {
    return { ...this.stats };
  }
}
