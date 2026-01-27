import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Extract slug from query parameters
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    // Validate slug
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { ok: false, error: "Invalid slug" },
        { status: 400 },
      );
    }

    // Resolve repo root (same pattern as other QA routes)
    const cwd = process.cwd();
    const repoRoot =
      path.basename(cwd) === "web" ? path.resolve(cwd, "..") : cwd;

    // Build screenshot path
    const screenshotPath = path.join(
      repoRoot,
      "analysis",
      "artifacts",
      "visual-proof",
      "full",
      slug,
      `${slug}.annotated.png`,
    );

    // Check if file exists
    try {
      await fs.access(screenshotPath);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 },
      );
    }

    // Read file as buffer
    const buffer = await fs.readFile(screenshotPath);

    // Return PNG response with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error serving screenshot:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}
