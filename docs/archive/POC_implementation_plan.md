# Tech Spike 2 — POC Implementation Plan

**Status**: Archived / Superseded

**Authoritative v1 tool-hardening docs**: [/docs/plan.md](../plan.md), [/docs/methodology.md](../methodology.md), [/docs/DECISIONS.md](../DECISIONS.md)

<!-- markdownlint-disable MD024 MD040 -->

---

## Purpose

This document describes **how** the Tech Spike 2 POC will be implemented, step by step.

It is intentionally pragmatic and constrained to:

- a **single snapshot**,
- **local execution** (developer machine),
- and **validation of feasibility**, not optimisation or scale.

The plan aligns directly with the **POC Definition of Done** and should be read together with it.

---

## High-level Architecture (POC)

```
Public market sites
        ↓
URL inventory (sitemap-first)
        ↓
HTML fetch layer (throttled, resumable)
        ↓
DOM parsing & block detection
        ↓
Component normalisation (taxonomy v0)
        ↓
Dataset (SQLite)
        ↓
Q&A interface (LLM → SQL → response)
```

Key principles:

- deterministic data pipeline
- no CMS integration
- no real-time processing

---

## Phase 1 — URL Inventory

### Objective

Build a **complete, auditable list of pages** per market.

### Steps

1. Retrieve sitemap / sitemap index for each market (UK / JP / US)
2. Extract all canonical URLs
3. Deduplicate and normalise URLs
4. Store inventory with initial status = `pending`

### Output

URL Inventory table with at least:

```
market
url
discovered_from (sitemap / crawl)
status (pending / fetched / failed / skipped)
```

### Notes

- Inventory completeness is more important than immediate fetch success
- This phase already enables basic coverage questions

---

## Phase 2 — Fetch Layer (HTML Snapshot)

### Objective

Fetch raw HTML for all URLs in the inventory in a **safe, resumable way**.

### Steps

1. Iterate over `pending` URLs
2. Fetch HTML with:
   - strict rate limiting
   - low concurrency
   - retry with backoff
3. Record HTTP status and fetch timestamp
4. Update URL status accordingly

### Output

- Raw HTML (stored or streamed)
- Updated inventory statuses

### Constraints (POC)

- HTML-only by default
- No JS execution unless explicitly added later

---

## Phase 3 — Parsing & Block Detection

### Objective

Convert raw HTML into **structural blocks** suitable for component analysis.

### Steps

1. Parse DOM
2. Identify repeated structural wrappers / sections
3. Segment page into block candidates
4. Discard non-content noise (nav, footer where appropriate)

### Output

Intermediate representation per page:

```
url
block_id
block_signature (structural hash / features)
```

### Notes

- Failures on individual pages must not stop the pipeline
- Parsing quality is more important than visual fidelity

---

## Phase 4 — Component Normalisation

### Objective

Map detected blocks to a **global, CMS-agnostic component taxonomy**.

### Steps

1. Define Component Taxonomy v0 (8–12 types)
2. For each block:
   - evaluate structural features
   - assign exactly one `component_type_normalised`
3. Count instances per component per page

### Output

Normalised component data:

```
market
url
component_type_normalised
instance_count
```

### Notes

- Taxonomy is expected to evolve slightly during POC
- Changes must be applied consistently across all markets

---

## Phase 5 — Dataset Assembly (Single Source of Truth)

### Objective

Create a **queryable, stable dataset** for analysis and Q&A.

### Steps

1. Create SQLite database
2. Insert snapshot metadata
3. Insert component usage data
4. Validate basic aggregations

### Output

SQLite dataset containing:

```
snapshot_id
market
url
component_type_normalised
instance_count
```

This dataset is the **only source of truth** for the POC.

---

## Phase 6 — Q&A Interface (LLM-powered)

### Objective

Enable **self-serve insight** without building a traditional dashboard.

### Behaviour

1. User asks a natural-language question
2. LLM translates question → deterministic SQL query
3. System executes query on SQLite dataset
4. LLM formats the response with:
   - numbers
   - comparisons
   - example URLs
   - snapshot context

### Mandatory rules

- LLM cannot answer without querying data
- All answers must reference the snapshot
- Missing data must be explicitly acknowledged

---

## Phase 7 — Validation & Demo Readiness

### Validation checklist

- All Golden Questions can be answered correctly
- Dataset aggregations match expectations
- Coverage and failures are transparent

### Demo readiness means

- one snapshot loaded
- Q&A interface stable
- example questions prepared

---

## Timeline (Indicative, POC)

- Days 1–2: URL inventory
- Days 3–4: Fetch layer
- Days 5–6: Parsing & normalisation
- Days 7–8: Dataset assembly
- Days 9–10: Q&A integration + validation

Total: **~2 weeks** (single developer, POC scope)

---

## Explicit Non-goals (POC)

- Performance optimisation
- Full JS rendering coverage
- Automated scheduling
- Hosting / deployment
- Visual dashboards

These are deferred until POC value is proven.

---

## Definition of Success (Implementation)

The implementation is successful when:

- data can be collected once,
- analysed deterministically,
- and queried naturally,

resulting in **shared, factual insight into component usage across markets**.
