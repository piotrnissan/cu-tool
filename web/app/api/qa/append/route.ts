import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Validate required fields
    if (!payload.timestamp || !payload.component_key || !payload.decision) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Build the JSONL record
    const record: Record<string, unknown> = {
      timestamp: payload.timestamp,
      page_url: payload.page_url || "unknown",
      component_key: payload.component_key,
      decision: payload.decision,
    };

    // Add optional fields
    if (payload.corrected_component_key) {
      record.corrected_component_key = payload.corrected_component_key;
    }
    if (payload.media_type) {
      record.media_type = payload.media_type;
    }
    if (payload.card_type) {
      record.card_type = payload.card_type;
    }
    if (payload.note) {
      record.note = payload.note;
    }

    // Construct path to JSONL file (relative to project root)
    // cwd differs depending on how Next is started (repo root vs web/)
    const cwd = process.cwd();
    const projectRoot =
      path.basename(cwd) === "web" ? path.resolve(cwd, "..") : cwd;
    const jsonlPath = path.join(
      projectRoot,
      "analysis",
      "qa-results",
      "v1-uk",
      "labels.jsonl",
    );

    // Ensure directory exists
    const dir = path.dirname(jsonlPath);
    await fs.mkdir(dir, { recursive: true });

    // Append the record as a single line
    const line = JSON.stringify(record) + "\n";
    await fs.appendFile(jsonlPath, line, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error appending to JSONL:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}
