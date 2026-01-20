import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Handle both dev (tsx) and production (compiled) paths
const isDev = process.env.NODE_ENV !== "production";
const projectRoot = isDev
  ? path.join(__dirname, "..")
  : path.join(__dirname, "../..");

const dataDir = path.join(projectRoot, "data");
const dbPath = path.join(dataDir, "cu-tool.db");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Create url_inventory table
db.exec(`
  CREATE TABLE IF NOT EXISTS url_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market TEXT NOT NULL,
    url TEXT NOT NULL,
    discovered_from TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    render_mode TEXT,
    http_status INTEGER,
    final_url TEXT,
    canonical_url TEXT,
    content_hash TEXT,
    duplicate_of_id INTEGER,
    error_message TEXT,
    fetched_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(market, url),
    FOREIGN KEY(duplicate_of_id) REFERENCES url_inventory(id)
  );

  CREATE INDEX IF NOT EXISTS idx_url_inventory_market_status 
    ON url_inventory(market, status);
  
  CREATE INDEX IF NOT EXISTS idx_url_inventory_url 
    ON url_inventory(url);
  
  CREATE INDEX IF NOT EXISTS idx_url_inventory_content_hash
    ON url_inventory(content_hash);
  
  CREATE INDEX IF NOT EXISTS idx_url_inventory_final_url
    ON url_inventory(final_url);
`);

// Idempotent column migration: ensure sitemap_lastmod exists
const columns = db.prepare("PRAGMA table_info(url_inventory)").all() as Array<{
  name: string;
}>;

const hasSitemapLastmod = columns.some((col) => col.name === "sitemap_lastmod");

if (!hasSitemapLastmod) {
  console.log("Adding sitemap_lastmod column to url_inventory...");
  db.exec(`ALTER TABLE url_inventory ADD COLUMN sitemap_lastmod TEXT;`);
}

// Idempotent column migration: ensure html_path exists
const hasHtmlPath = columns.some((col) => col.name === "html_path");

if (!hasHtmlPath) {
  console.log("Adding html_path column to url_inventory...");
  db.exec(`ALTER TABLE url_inventory ADD COLUMN html_path TEXT;`);
}

// Idempotent column migration: ensure html_fetched_at exists
const hasHtmlFetchedAt = columns.some((col) => col.name === "html_fetched_at");

if (!hasHtmlFetchedAt) {
  console.log("Adding html_fetched_at column to url_inventory...");
  db.exec(`ALTER TABLE url_inventory ADD COLUMN html_fetched_at TEXT;`);
}

// Create david_component_usage table for Phase 2
db.exec(`
  CREATE TABLE IF NOT EXISTS david_component_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_id INTEGER NOT NULL,
    component_key TEXT NOT NULL,
    instance_count INTEGER NOT NULL,
    confidence TEXT NOT NULL,
    evidence TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(url_id) REFERENCES url_inventory(id)
  );

  CREATE INDEX IF NOT EXISTS idx_david_component_usage_component_key
    ON david_component_usage(component_key);
  
  CREATE INDEX IF NOT EXISTS idx_david_component_usage_url_id
    ON david_component_usage(url_id);
`);

export default db;
