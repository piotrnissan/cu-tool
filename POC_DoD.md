# Tech Spike 2 — POC Definition of Done

## Context

This document defines what **DONE** means for the **Tech Spike 2 POC/MVP**.

The goal of this spike is **not** to build a production system, dashboard, or monitoring platform. The goal is to prove that we can:

- reliably **collect data** from live market sites,
- **normalise component usage** across markets,
- and provide **self-serve, factual insights** via a lightweight Q&A interface (instead of a heavy dashboard).

This POC is intentionally:

- snapshot-based,
- CMS-agnostic,
- and focused on visibility rather than decision automation.

---

## 1. Snapshot & Coverage

### DONE when:

- A **single global snapshot** exists (POC scope)
- Snapshot includes **UK / JP / US** markets
- Snapshot is based on **live, public URLs**
- Snapshot has a clear identifier and timestamp

Example:

```
snapshot_id: GLOBAL_POC_2026_01
```

### URL Inventory — DONE when:

- Full list of URLs per market is collected
  - primary source: sitemap (or sitemap index)
- Every URL has a recorded status:
  - `pending`
  - `fetched`
  - `failed`
  - `skipped`
- Inventory is stored in a durable format (SQLite or CSV)

Must be able to answer:

> “How many pages are included in the UK snapshot?”

Not required:

- 100% fetch success
- perfect sitemap coverage

Transparency of coverage is sufficient.

---

## 2. Fetch & Parsing

### Fetch layer — DONE when:

- HTML is fetched for the majority of URLs (target: **80–90%**)
- Fetch process includes:
  - throttling / rate limiting
  - retry logic
  - ability to resume after interruption
- HTTP status codes are recorded

### Parsing — DONE when:

- Pages are parsed into **structural sections / blocks**
- Parsing does **not** depend on:
  - CMS access
  - AEM component names
  - repository knowledge
- Individual page failures do not crash the pipeline

Accepted POC limitation:

- Pages requiring heavy JS rendering may be:
  - flagged
  - skipped
  - or handled later

---

## 3. Component Normalisation (Core of the Spike)

### Component Taxonomy v0 — DONE when:

- A **global list of 8–12 normalised component types** exists
- Every detected component instance maps to **exactly one** normalised type
- The taxonomy works **across all markets** (UK / JP / US)
- Component names are:
  - structural
  - pattern-based
  - CMS-agnostic

Explicitly not used:

- AEM component names
- repository identifiers
- team-specific naming

Example (illustrative only):

- Full-width Hero
- Media + Text Split
- Feature Highlight
- Listing / Grid
- Carousel / Gallery
- CTA Band
- Specs / Key Facts
- Legal / Info

---

## 4. Dataset (Single Source of Truth)

### Dataset v1 — DONE when:

- Data is stored in **one authoritative dataset** (SQLite recommended)
- Dataset supports aggregation and filtering

### Minimum required fields:

```
snapshot_id
market
url
component_type_normalised
instance_count
```

Dataset must allow:

- counting component usage
- comparing markets
- listing example URLs

---

## 5. Q&A Interface (LLM-powered, e.g. Ollama)

### Q&A layer — DONE when:

- User can ask questions in **natural language**
- System performs:
  1. question → deterministic query (e.g. SQL)
  2. query execution against dataset
  3. response formatting with numbers and evidence

### Mandatory behaviour:

- Every answer includes snapshot context, e.g.:
  > “Based on snapshot: GLOBAL\_POC\_2026\_01”

### LLM explicitly does NOT:

- infer missing data
- calculate numbers itself
- answer without querying the dataset

---

## 6. Golden Questions (Mandatory for Demo)

The POC is considered **successful** only if the system can correctly answer all of the following:

1. Which component types are used in each market?
2. How many times is component **X** used in the UK snapshot?
3. Which components are common across UK, JP and US?
4. Which components appear only in a single market?
5. Compare component density per page between UK, JP and US
6. Show pages with the highest usage of component **X**
7. How many pages are included in the UK snapshot?
8. Which pages failed to fetch or parse?

---

## 7. Transparency of Limitations

### DONE when:

- POC is explicitly communicated as:
  - single snapshot
  - HTML-first
  - structural insight only
- No promises are made regarding:
  - real-time monitoring
  - trend analysis
  - CMS-level truth

Clear limitations are considered a strength, not a weakness.

---

## 8. Final Exit Criteria

**Tech Spike 2 POC is complete when:**

> A single snapshot provides a factual, queryable view of component usage across all pages of UK, JP and US sites, without CMS integration, and enables self-serve insight through a Q&A interface instead of a traditional dashboard.

---

## Out of Scope (Intentionally)

- Hosting / scaling
- Automated recurring snapshots
- Production-grade UI
- Governance or consolidation decisions

These are future considerations, not POC requirements.

