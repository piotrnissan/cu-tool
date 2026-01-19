import fs from "fs";
import path from "path";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface HtmlCacheEntry {
  market: string;
  urlId: number;
  html: string;
  renderMode?: string;
}

/**
 * Gets the base directory for HTML cache
 */
function getHtmlCacheDir(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const projectRoot = isDev
    ? path.join(__dirname, "..")
    : path.join(__dirname, "../..");
  return path.join(projectRoot, "data", "html");
}

/**
 * Ensures directory exists recursively
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Writes HTML to gzip-compressed file cache
 * Returns the relative path from data/ directory
 */
export async function writeHtmlCache(entry: HtmlCacheEntry): Promise<string> {
  const { market, urlId, html } = entry;

  // Construct path: data/html/{market}/{urlId}.html.gz
  const baseDir = getHtmlCacheDir();
  const marketDir = path.join(baseDir, market);
  ensureDir(marketDir);

  const fileName = `${urlId}.html.gz`;
  const filePath = path.join(marketDir, fileName);

  // Compress and write
  const compressed = await gzipAsync(Buffer.from(html, "utf-8"));
  fs.writeFileSync(filePath, compressed);

  // Return relative path from data/ directory
  return `html/${market}/${fileName}`;
}

/**
 * Reads HTML from gzip-compressed file cache
 */
export async function readHtmlCache(relativePath: string): Promise<string> {
  const isDev = process.env.NODE_ENV !== "production";
  const projectRoot = isDev
    ? path.join(__dirname, "..")
    : path.join(__dirname, "../..");
  const fullPath = path.join(projectRoot, "data", relativePath);

  const compressed = fs.readFileSync(fullPath);
  const decompressed = await gunzipAsync(compressed);
  return decompressed.toString("utf-8");
}

/**
 * Checks if HTML cache file exists
 */
export function htmlCacheExists(relativePath: string): boolean {
  const isDev = process.env.NODE_ENV !== "production";
  const projectRoot = isDev
    ? path.join(__dirname, "..")
    : path.join(__dirname, "../..");
  const fullPath = path.join(projectRoot, "data", relativePath);
  return fs.existsSync(fullPath);
}
