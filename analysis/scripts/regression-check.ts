#!/usr/bin/env node
/**
 * TH-33 — Regression harness to compute per-component precision metrics from Human QA labels.
 *
 * Reads analysis/qa-results/v1-uk/labels.jsonl and computes:
 * - For each component_key (detected-as), count decision types
 * - Calculate precision = correct / (correct + wrong_type + false_positive)
 * - Require minimum 10 scored labels for meaningful precision
 *
 * Outputs:
 * - analysis/artifacts/regression/regression-report.json
 * - analysis/artifacts/regression/regression-report.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface QALabel {
  timestamp: string;
  detection_id: string;
  page_url: string;
  component_key: string;
  decision: "correct" | "wrong_type" | "false_positive" | "missing" | "unclear";
  corrected_component_key?: string;
  media_type?: string;
  card_type?: string;
  note?: string;
}

interface ComponentMetrics {
  total_labels: number;
  scored: number;
  correct: number;
  wrong_type: number;
  false_positive: number;
  unclear: number;
  missing: number;
  precision: number | null;
  status: "computed" | "insufficient_sample";
}

interface RegressionReport {
  generated_at: string;
  source: string;
  totals: {
    rows: number;
    parsed: number;
    parse_errors: number;
    invalid_rows: number;
  };
  components: Record<string, ComponentMetrics>;
}

const LABELS_PATH = path.join(__dirname, "../qa-results/v1-uk/labels.jsonl");
const OUTPUT_DIR = path.join(__dirname, "../artifacts/regression");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "regression-report.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "regression-report.md");
const MIN_SAMPLE_SIZE = 10;

function main(): void {
  console.log(
    "TH-33 Regression Check — Computing precision metrics from QA labels\n",
  );

  // Check if input file exists
  if (!fs.existsSync(LABELS_PATH)) {
    console.error(`ERROR: Labels file not found: ${LABELS_PATH}`);
    process.exit(1);
  }

  // Read and process labels
  const content = fs.readFileSync(LABELS_PATH, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  const totals = {
    rows: lines.length,
    parsed: 0,
    parse_errors: 0,
    invalid_rows: 0,
  };

  const componentCounts: Record<
    string,
    {
      correct: number;
      wrong_type: number;
      false_positive: number;
      unclear: number;
      missing: number;
    }
  > = {};

  // Process each line
  for (const line of lines) {
    let label: QALabel;

    try {
      label = JSON.parse(line);
    } catch (err) {
      totals.parse_errors++;
      continue;
    }

    // Validate required fields
    if (!label.component_key || !label.decision) {
      totals.invalid_rows++;
      continue;
    }

    totals.parsed++;

    // Initialize component counts if needed
    if (!componentCounts[label.component_key]) {
      componentCounts[label.component_key] = {
        correct: 0,
        wrong_type: 0,
        false_positive: 0,
        unclear: 0,
        missing: 0,
      };
    }

    // Increment decision count
    const counts = componentCounts[label.component_key];
    switch (label.decision) {
      case "correct":
        counts.correct++;
        break;
      case "wrong_type":
        counts.wrong_type++;
        break;
      case "false_positive":
        counts.false_positive++;
        break;
      case "unclear":
        counts.unclear++;
        break;
      case "missing":
        counts.missing++;
        break;
    }
  }

  // Compute metrics for each component
  const components: Record<string, ComponentMetrics> = {};

  for (const [componentKey, counts] of Object.entries(componentCounts)) {
    const scored = counts.correct + counts.wrong_type + counts.false_positive;
    const incorrect = counts.wrong_type + counts.false_positive;
    const total_labels = scored + counts.unclear + counts.missing;

    let precision: number | null = null;
    let status: "computed" | "insufficient_sample" = "insufficient_sample";

    if (scored >= MIN_SAMPLE_SIZE) {
      precision =
        scored > 0 ? counts.correct / (counts.correct + incorrect) : 0;
      status = "computed";
    }

    components[componentKey] = {
      total_labels,
      scored,
      correct: counts.correct,
      wrong_type: counts.wrong_type,
      false_positive: counts.false_positive,
      unclear: counts.unclear,
      missing: counts.missing,
      precision,
      status,
    };
  }

  // Create report
  const report: RegressionReport = {
    generated_at: new Date().toISOString(),
    source: "analysis/qa-results/v1-uk/labels.jsonl",
    totals,
    components,
  };

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write JSON report
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2));
  console.log(
    `✓ JSON report written to: ${path.relative(process.cwd(), JSON_OUTPUT)}`,
  );

  // Write Markdown report
  const mdContent = generateMarkdownReport(report);
  fs.writeFileSync(MD_OUTPUT, mdContent);
  console.log(
    `✓ Markdown report written to: ${path.relative(process.cwd(), MD_OUTPUT)}`,
  );

  // Print summary
  printSummary(report);
}

function generateMarkdownReport(report: RegressionReport): string {
  let md = `# Regression Check — Precision Metrics\n\n`;
  md += `**Generated:** ${report.generated_at}\n\n`;
  md += `**Source:** ${report.source}\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total rows:** ${report.totals.rows}\n`;
  md += `- **Parsed:** ${report.totals.parsed}\n`;
  md += `- **Parse errors:** ${report.totals.parse_errors}\n`;
  md += `- **Invalid rows:** ${report.totals.invalid_rows}\n`;
  md += `- **Components:** ${Object.keys(report.components).length}\n\n`;

  md += `## Per-Component Metrics\n\n`;
  md += `| Component | Precision | Correct | Wrong type | False pos | Unclear | Missing | Scored | Status |\n`;
  md += `|-----------|-----------|---------|------------|-----------|---------|---------|--------|--------|\n`;

  // Sort by component key
  const sortedComponents = Object.entries(report.components).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [componentKey, metrics] of sortedComponents) {
    const precisionStr =
      metrics.precision !== null
        ? (metrics.precision * 100).toFixed(1) + "%"
        : "n/a";

    md += `| ${componentKey} | ${precisionStr} | ${metrics.correct} | ${metrics.wrong_type} | ${metrics.false_positive} | ${metrics.unclear} | ${metrics.missing} | ${metrics.scored} | ${metrics.status} |\n`;
  }

  return md;
}

function printSummary(report: RegressionReport): void {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");

  const componentCount = Object.keys(report.components).length;
  const totalScored = Object.values(report.components).reduce(
    (sum, m) => sum + m.scored,
    0,
  );
  const insufficientSamples = Object.values(report.components).filter(
    (m) => m.status === "insufficient_sample",
  ).length;

  console.log(`Components analyzed: ${componentCount}`);
  console.log(`Total scored labels: ${totalScored}`);
  console.log(
    `Insufficient sample (< ${MIN_SAMPLE_SIZE}): ${insufficientSamples}`,
  );

  if (report.totals.parse_errors > 0) {
    console.log(`⚠ Parse errors: ${report.totals.parse_errors}`);
  }
  if (report.totals.invalid_rows > 0) {
    console.log(`⚠ Invalid rows: ${report.totals.invalid_rows}`);
  }

  console.log("\nPer-component precision (only computed status):");
  const computed = Object.entries(report.components)
    .filter(([_, m]) => m.status === "computed")
    .sort(([_, a], [__, b]) => (b.precision ?? 0) - (a.precision ?? 0));

  if (computed.length === 0) {
    console.log("  (none — all components have insufficient samples)");
  } else {
    for (const [key, metrics] of computed) {
      const precisionPct = ((metrics.precision ?? 0) * 100).toFixed(1);
      console.log(
        `  ${key}: ${precisionPct}% (${metrics.correct}/${metrics.scored} scored)`,
      );
    }
  }

  console.log("═══════════════════════════════════════════════════════════\n");
}

main();
