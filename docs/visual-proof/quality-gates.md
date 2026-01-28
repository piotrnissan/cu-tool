# Quality Gates

Quality gates validate component detector precision before proceeding with broader analysis. This document describes the current regression harness implementation.

## Purpose

Quality gates exist to:

- Measure detector precision using human-labeled QA data
- Block analysis when detectors produce unreliable results
- Provide clear pass/fail/insufficient-sample signals for decision-making

Gates do NOT:

- Judge business value or component importance
- Auto-tune detectors
- Block work when sample size is insufficient

## Component Classes

Components are organized into three classes based on precision requirements:

**Class A** (90% threshold)

- Components with highest impact on analysis accuracy

**Class B** (85% threshold)

- High-visibility components with some classification subjectivity

**Class C** (80% threshold)

- Lower-volume components or those with robust detection rules

Class membership for each component is defined in `analysis/config/quality-gates.v1.json`.

## Precision Thresholds

Each class has a minimum precision threshold:

- **Class A**: 90%
- **Class B**: 85%
- **Class C**: 80%

Precision is calculated as:

```text
precision = correct / (correct + wrong_type + false_positive)
```

Where:

- `correct`: Detection correctly identified
- `wrong_type`: Detection is wrong component type
- `false_positive`: Detection is not a component at all
- `unclear` and `missing` labels are excluded from precision calculation

## Minimum Sample Rule

Components must have **at least 10 scored labels** (`min_sample_scored = 10`) to be evaluated against thresholds.

Scored labels include: `correct`, `wrong_type`, `false_positive`
Excluded labels: `unclear`, `missing`

If a component has fewer than 10 scored labels:

- Status: `insufficient_sample`
- Precision: `null`
- **This is NOT a failure**

Components without enough labels do not block progress. They are simply not evaluated.

## Gate Statuses

Each component receives one of three statuses:

**`pass`**

- Component has ≥10 scored labels
- Precision meets or exceeds class threshold
- No action required

**`fail`**

- Component has ≥10 scored labels
- Precision is below class threshold
- Detector corrections required before proceeding

**`insufficient_sample`**

- Component has <10 scored labels
- Precision cannot be reliably calculated
- Does NOT block progress

Class-level status:

- `fail` if any component in class fails
- `insufficient_sample` if no failures but at least one component has insufficient sample
- `pass` if all components with sufficient samples pass

Overall status:

- `fail` if any class fails
- `insufficient_sample` if no failures but at least one class has insufficient sample
- `pass` if all classes pass

## End-to-End Workflow

### 1. Human QA Labels

Operator reviews detections in web UI (`/qa`) and labels each:

- `correct` / `wrong_type` / `false_positive` / `unclear` / `missing`

Labels written to: `analysis/qa-results/v1-uk/labels.jsonl`

### 2. Regression Check (`regression-check.ts`)

Reads labels.jsonl and computes per-component metrics:

- Total labels
- Scored count
- Label breakdowns (correct, wrong_type, false_positive, unclear, missing)
- Precision (if scored ≥ 10)
- Status (pass/fail/insufficient_sample)

Outputs:

- `analysis/artifacts/regression/regression-report.json`
- Console summary

### 3. Gate Report (`gate-report.ts`)

Reads regression-report.json and quality-gates.v1.json, then:

- Computes gate status for each component
- Handles missing components (treats as scored=0, insufficient_sample)
- Computes per-class and overall status

Outputs:

- `analysis/artifacts/regression/gate-report.json`
- `analysis/artifacts/regression/gate-report.md`
- Console summary

### 4. Gate Validation (`gate-validate.ts`)

Reads gate-report.json and exits with status code:

- **Exit 0**: Overall status = `pass`
- **Exit 1**: Overall status = `fail`
- **Exit 2**: Overall status = `insufficient_sample`

Used in CI or decision pipelines.

## How to Interpret Results

### All Pass

All components with sufficient samples meet their thresholds. Proceed with confidence.

### Some Fail

One or more components do not meet precision requirements:

1. Review failed component labels in labels.jsonl
2. Identify patterns (common false positives, wrong classifications)
3. Update detector logic in `api/src/david-components.ts`
4. Re-run detector, re-export detections, re-run QA
5. Repeat until gates pass

Do NOT proceed with full analysis until failures are resolved.

### Some/All Insufficient Sample

Not enough labels to evaluate precision. This does NOT block work:

- If overall status is `insufficient_sample` (no failures), you can proceed
- Components with insufficient samples are not evaluated
- Consider adding more QA pages or spot-checking components manually

Exit code 2 signals "not enough data" rather than "blocked."

## Explicit Non-Goals

**Gates do NOT judge business value**
A high-precision detector is not necessarily more important. Gates only measure technical accuracy.

**Gates do NOT auto-tune detectors**
Human review and manual detector updates are required. Gates provide measurement, not automation.

**Gates do NOT block work when sample size is insufficient**
Exit code 2 indicates "not enough data" and is distinct from "fail." Insufficient sample is informational, not blocking.

## Configuration Reference

**File**: `analysis/config/quality-gates.v1.json`

```json
{
  "version": "v1",
  "min_sample_scored": 10,
  "precision_denominator": ["correct", "wrong_type", "false_positive"],
  "excluded_from_precision": ["unclear", "missing"],
  "classes": {
    "A": {
      "min_precision": 0.9,
      "components": ["accordion", "cards_section"]
    },
    "B": {
      "min_precision": 0.85,
      "components": ["image_carousel", "card_carousel"]
    },
    "C": {
      "min_precision": 0.8,
      "components": [
        "hero",
        "media_text_split",
        "promo_section",
        "info_specs",
        "next_action_panel",
        "tabs",
        "anchor_nav"
      ]
    }
  }
}
```

## Related Documentation

- [Data Contracts](data-contracts.md) — Labels JSONL schema
- [QA UI Documentation](qa-ui.md) — How labels are created
- [Overview](overview.md) — Full workflow
