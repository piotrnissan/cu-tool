#!/usr/bin/env tsx
import fs from "fs";
import path from "path";

function findRepoRoot(): string {
  let currentDir = process.cwd();
  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      if (packageJson.name === "cu-tool") {
        return currentDir;
      }
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      console.error("Error: Could not find cu-tool repo root");
      process.exit(1);
    }
    currentDir = parentDir;
  }
}

const REPO_ROOT = findRepoRoot();
const GATE_REPORT_PATH = path.join(
  REPO_ROOT,
  "analysis/artifacts/regression/gate-report.json",
);

interface ClassSummary {
  status: string;
  pass: number;
  fail: number;
  insufficient_sample: number;
}

interface GateReport {
  generated_at: string;
  inputs: {
    regression_report: string;
    gates_config: string;
  };
  summary: {
    overall_status: string;
    min_sample_scored: number;
    classes: Record<string, ClassSummary>;
  };
  components: Record<string, unknown>;
}

function main(): void {
  // Read gate report
  if (!fs.existsSync(GATE_REPORT_PATH)) {
    console.error(`Error: Gate report not found at ${GATE_REPORT_PATH}`);
    process.exit(1);
  }

  let gateReport: GateReport;
  try {
    gateReport = JSON.parse(fs.readFileSync(GATE_REPORT_PATH, "utf-8"));
  } catch (err) {
    console.error(`Error: Failed to parse gate report: ${err}`);
    process.exit(1);
  }

  // Validate structure
  if (!gateReport.summary) {
    console.error("Error: Gate report missing 'summary' field");
    process.exit(1);
  }
  if (!gateReport.summary.overall_status) {
    console.error("Error: Gate report missing 'summary.overall_status' field");
    process.exit(1);
  }
  if (gateReport.summary.min_sample_scored === undefined) {
    console.error(
      "Error: Gate report missing 'summary.min_sample_scored' field",
    );
    process.exit(1);
  }
  if (!gateReport.summary.classes) {
    console.error("Error: Gate report missing 'summary.classes' field");
    process.exit(1);
  }

  const overallStatus = gateReport.summary.overall_status;
  const minSampleScored = gateReport.summary.min_sample_scored;
  const classes = gateReport.summary.classes;

  // Print status
  console.log(`Quality Gate Validation`);
  console.log(`=======================`);
  console.log(`Overall Status: ${overallStatus.toUpperCase()}`);
  console.log(`Min Sample Scored: ${minSampleScored}`);
  console.log(``);

  console.log(`Per-Class Summary:`);
  for (const [className, summary] of Object.entries(classes)) {
    console.log(
      `  Class ${className}: ${summary.status.toUpperCase()} (pass=${summary.pass}, fail=${summary.fail}, insufficient=${summary.insufficient_sample})`,
    );
  }

  // Determine exit code
  let exitCode: number;
  if (overallStatus === "pass") {
    exitCode = 0;
  } else if (overallStatus === "insufficient_sample") {
    exitCode = 2;
  } else if (overallStatus === "fail") {
    exitCode = 1;
  } else {
    console.error(`Error: Unknown overall_status: ${overallStatus}`);
    exitCode = 1;
  }

  process.exit(exitCode);
}

main();
