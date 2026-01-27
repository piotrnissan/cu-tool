import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ManifestInstance {
  bbox: BoundingBox;
  selector_used: string;
}

interface ManifestDetection {
  component_key: string;
  expected_instances: number;
  found_instances: number;
  selector_used: string;
  instances: ManifestInstance[];
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

interface QueueItem {
  detection_id: string;
  slug: string;
  page_url: string;
  component_key: string;
  bbox: BoundingBox;
}

export async function GET() {
  try {
    // Resolve repo root (same pattern as qa/append route)
    const cwd = process.cwd();
    const repoRoot =
      path.basename(cwd) === "web" ? path.resolve(cwd, "..") : cwd;
    const artifactsPath = path.join(
      repoRoot,
      "analysis",
      "artifacts",
      "visual-proof",
      "full",
    );

    // Check if artifacts directory exists
    try {
      await fs.access(artifactsPath);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: `Artifacts directory not found: ${artifactsPath}`,
        },
        { status: 500 },
      );
    }

    // Read all subdirectories (slugs)
    const entries = await fs.readdir(artifactsPath, { withFileTypes: true });
    const slugDirs = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort(); // Sort slugs alphabetically for deterministic order

    const queueItems: QueueItem[] = [];

    // Process each slug directory
    for (const slug of slugDirs) {
      const manifestPath = path.join(
        artifactsPath,
        slug,
        `${slug}.manifest.json`,
      );

      try {
        const manifestContent = await fs.readFile(manifestPath, "utf-8");
        const manifest: Manifest = JSON.parse(manifestContent);

        // Process each detection in the manifest
        for (const detection of manifest.detections) {
          // Process each instance within the detection
          detection.instances.forEach((instance, instanceIndex) => {
            queueItems.push({
              detection_id: `${slug}:${detection.component_key}:${instanceIndex}`,
              slug: slug,
              page_url: manifest.url,
              component_key: detection.component_key,
              bbox: instance.bbox,
            });
          });
        }
      } catch (error) {
        console.warn(
          `Warning: Could not read or parse manifest for ${slug}:`,
          error,
        );
        // Continue processing other manifests
      }
    }

    return NextResponse.json({
      ok: true,
      total: queueItems.length,
      items: queueItems,
    });
  } catch (error) {
    console.error("Error loading detections from manifests:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}
