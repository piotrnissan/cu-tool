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
      throw new Error("Could not find cu-tool repo root");
    }
    currentDir = parentDir;
  }
}

const REPO_ROOT = findRepoRoot();
const REGRESSION_REPORT_PATH = path.join(
  REPO_ROOT,
  "analysis/artifacts/regression/regression-report.json",
);
const GATES_CONFIG_PATH = path.join(
  REPO_ROOT,
  "analysis/config/quality-gates.v1.json",
);
const OUTPUT_JSON_PATH = path.join(
  REPO_ROOT,
  "analysis/artifacts/regression/gate-report.json",
);
const OUTPUT_MD_PATH = path.join(
  REPO_ROOT,
  "analysis/artifacts/regression/gate-report.md",
);

interface RegressionComponent {
  total_labels: number;
  scored: number;
  correct: number;
  wrong_type: number;
  false_positive: number;
  unclear: number;
  missing: number;
  precision: number | null;
  status: string;
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
  components: Record<string, RegressionComponent>;
}

interface GatesConfig {
  version: string;
  min_sample_scored: number;
  precision_denominator: string[];
  excluded_from_precision: string[];
  classes: Record<string, { min_precision: number; components: string[] }>;
  status_if_insufficient: string;
}

interface ComponentResult {
  class: string;
  threshold: number;
  scored: number;
  precision: number | null;
  status: "pass" | "fail" | "insufficient_sample";
}

interface ClassSummary {
  status: "pass" | "fail" | "insufficient_sample";
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
    overall_status: "pass" | "fail" | "insufficient_sample";
    min_sample_scored: number;
    classes: Record<string, ClassSummary>;
  };
  components: Record<string, ComponentResult>;
}

function main(): void {
  // Read inputs
  if (!fs.existsSync(REGRESSION_REPORT_PATH)) {
    console.error(
      `Error: Regression report not found at ${REGRESSION_REPORT_PATH}`,
    );
    process.exit(1);
  }
  if (!fs.existsSync(GATES_CONFIG_PATH)) {
    console.error(`Error: Gates config not found at ${GATES_CONFIG_PATH}`);
    process.exit(1);
  }

  const regressionReport: RegressionReport = JSON.parse(
    fs.readFileSync(REGRESSION_REPORT_PATH, "utf-8"),
  );
  const gatesConfig: GatesConfig = JSON.parse(
    fs.readFileSync(GATES_CONFIG_PATH, "utf-8"),
  );

  const minSampleScored = gatesConfig.min_sample_scored;
  const componentResults: Record<string, ComponentResult> = {};
  const classSummaries: Record<string, ClassSummary> = {};

  // Process each class
  for (const [className, classConfig] of Object.entries(gatesConfig.classes)) {
    const summary: ClassSummary = {
      status: "pass",
      pass: 0,
      fail: 0,
      insufficient_sample: 0,
    };

    for (const componentKey of classConfig.components) {
      const metrics = regressionReport.components[componentKey];

      let status: "pass" | "fail" | "insufficient_sample";
      let precision: number | null;
      let scored: number;

      if (!metrics) {
        // Component not in regression report - treat as no labels
        scored = 0;
        precision = null;
        status = "insufficient_sample";
      } else {
        scored = metrics.scored;

        if (scored < minSampleScored) {
          status = "insufficient_sample";
          precision = null;
        } else {
          // Sufficient sample - check precision
          if (metrics.precision === null) {
            console.error(
              `Error: Component "${componentKey}" has scored=${scored} >= min_sample_scored=${minSampleScored}, but precision is null (data inconsistency)`,
            );
            process.exit(1);
          }
          precision = metrics.precision;
          status = precision >= classConfig.min_precision ? "pass" : "fail";
        }
      }

      componentResults[componentKey] = {
        class: className,
        threshold: classConfig.min_precision,
        scored,
        precision,
        status,
      };

      // Update class summary counts
      if (status === "pass") {
        summary.pass++;
      } else if (status === "fail") {
        summary.fail++;
      } else {
        summary.insufficient_sample++;
      }
    }

    // Determine class status
    if (summary.fail > 0) {
      summary.status = "fail";
    } else if (summary.insufficient_sample > 0) {
      summary.status = "insufficient_sample";
    } else {
      summary.status = "pass";
    }

    classSummaries[className] = summary;
  }

  // Determine overall status
  let overallStatus: "pass" | "fail" | "insufficient_sample" = "pass";
  for (const summary of Object.values(classSummaries)) {
    if (summary.status === "fail") {
      overallStatus = "fail";
      break;
    } else if (summary.status === "insufficient_sample") {
      overallStatus = "insufficient_sample";
    }
  }

  // Build report
  const report: GateReport = {
    generated_at: new Date().toISOString(),
    inputs: {
      regression_report: path.relative(process.cwd(), REGRESSION_REPORT_PATH),
      gates_config: path.relative(process.cwd(), GATES_CONFIG_PATH),
    },
    summary: {
      overall_status: overallStatus,
      min_sample_scored: minSampleScored,
      classes: classSummaries,
    },
    components: componentResults,
  };

  // Write JSON
  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2));

  // Write Markdown
  const mdLines: string[] = [];
  mdLines.push(`# Quality Gate Report`);
  mdLines.push(``);
  mdLines.push(`**Generated:** ${report.generated_at}`);
  mdLines.push(
    `**Overall Status:** ${report.summary.overall_status.toUpperCase()}`,
  );
  mdLines.push(`**Min Sample Scored:** ${report.summary.min_sample_scored}`);
  mdLines.push(``);

  for (const className of ["A", "B", "C"]) {
    const summary = classSummaries[className];
    if (!summary) continue;

    mdLines.push(`## Class ${className}`);
    mdLines.push(``);
    mdLines.push(`**Status:** ${summary.status.toUpperCase()}`);
    mdLines.push(
      `**Pass:** ${summary.pass} | **Fail:** ${summary.fail} | **Insufficient:** ${summary.insufficient_sample}`,
    );
    mdLines.push(``);
    mdLines.push(`|Component|Threshold|Scored|Precision|Status|`);
    mdLines.push(`|---|---|---|---|---|`);

    const classComponents = gatesConfig.classes[className].components;
    for (const componentKey of classComponents) {
      const result = componentResults[componentKey];
      const precisionStr =
        result.precision === null ? "N/A" : result.precision.toFixed(2);
      mdLines.push(
        `|${componentKey}|${result.threshold}|${result.scored}|${precisionStr}|${result.status}|`,
      );
    }
    mdLines.push(``);
  }

  fs.writeFileSync(OUTPUT_MD_PATH, mdLines.join("\n"));

  // Print summary to stdout
  console.log(`Quality Gate Report Generated`);
  console.log(`==============================`);
  console.log(`Overall Status: ${overallStatus.toUpperCase()}`);
  console.log(`Min Sample Scored: ${minSampleScored}`);
  console.log(``);

  const totalComponents = Object.keys(componentResults).length;
  const passCount = Object.values(componentResults).filter(
    (r) => r.status === "pass",
  ).length;
  const failCount = Object.values(componentResults).filter(
    (r) => r.status === "fail",
  ).length;
  const insufficientCount = Object.values(componentResults).filter(
    (r) => r.status === "insufficient_sample",
  ).length;

  console.log(`Total Components: ${totalComponents}`);
  console.log(`Pass: ${passCount}`);
  console.log(`Fail: ${failCount}`);
  console.log(`Insufficient Sample: ${insufficientCount}`);
  console.log(``);

  console.log(`Per-Class Summary:`);
  for (const [className, summary] of Object.entries(classSummaries)) {
    console.log(
      `  Class ${className}: ${summary.status.toUpperCase()} (pass=${summary.pass}, fail=${summary.fail}, insufficient=${summary.insufficient_sample})`,
    );
  }
  console.log(``);
  console.log(`Outputs:`);
  console.log(`  ${path.relative(process.cwd(), OUTPUT_JSON_PATH)}`);
  console.log(`  ${path.relative(process.cwd(), OUTPUT_MD_PATH)}`);
}

main();
