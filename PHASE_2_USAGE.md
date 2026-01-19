# Phase 2: David Component Analysis - Usage Guide

## Overview

Phase 2 analyzes cached HTML files to detect David component usage across UK market pages. The system reads from the HTML cache (no refetch) and stores results in `david_component_usage` table.

## Prerequisites

- Server running: `http://localhost:3002`
- HTML cache populated (Phase 1.6 complete)
- Eligible UK URLs: **8,468** pages with cached HTML

## Components Detected

The analysis identifies 7 component types:

1. **tabs** - `role="tablist"` + `role="tab"` patterns (high confidence)
2. **accordion** - `<details>/<summary>` or `aria-expanded` patterns (high/medium)
3. **anchor_nav** - In-page navigation with `href="#..."` (high/medium)
4. **image_carousel** - Slider containers with images + controls (medium)
5. **card_carousel** - Slider containers with card items + controls (medium)
6. **cards_grid** - Grid layouts with repeated card items (medium)
7. **icon_grid** - Repeated icon+text items (medium)

## API Endpoints

### 1. Run Analysis

**Endpoint:** `POST /api/analysis/david-components/run`

**Body Parameters:**

- `market` (string, default: "UK") - Market to analyze
- `limit` (number, default: 200) - Number of URLs to process per batch
- `offset` (number, default: 0) - Starting offset for pagination
- `reset` (boolean, default: false) - Delete existing data before running

**Test with 50 URLs:**

```bash
curl -X POST http://localhost:3002/api/analysis/david-components/run \
  -H "Content-Type: application/json" \
  -d '{"market":"UK","limit":50,"reset":true}' | jq .
```

**Response:**

```json
{
  "success": true,
  "message": "Analysis job started",
  "config": {
    "market": "UK",
    "limit": 50,
    "offset": 0,
    "reset": true
  }
}
```

**Run Full Analysis (all 8,468 URLs):**

```bash
curl -X POST http://localhost:3002/api/analysis/david-components/run \
  -H "Content-Type: application/json" \
  -d '{"market":"UK","limit":8500,"reset":true}' | jq .
```

**Run in Batches (resumable):**

```bash
# First batch (0-500)
curl -X POST http://localhost:3002/api/analysis/david-components/run \
  -H "Content-Type: application/json" \
  -d '{"market":"UK","limit":500,"offset":0,"reset":true}' | jq .

# Second batch (500-1000)
curl -X POST http://localhost:3002/api/analysis/david-components/run \
  -H "Content-Type: application/json" \
  -d '{"market":"UK","limit":500,"offset":500,"reset":false}' | jq .

# Third batch (1000-1500)
curl -X POST http://localhost:3002/api/analysis/david-components/run \
  -H "Content-Type: application/json" \
  -d '{"market":"UK","limit":500,"offset":1000,"reset":false}' | jq .
```

### 2. Get Summary

**Endpoint:** `GET /api/analysis/david-components/summary?market=UK`

**Query Parameters:**

- `market` (string, default: "UK") - Market to summarize

**Command:**

```bash
curl -s "http://localhost:3002/api/analysis/david-components/summary?market=UK" | jq .
```

**Response Structure:**

```json
{
  "market": "UK",
  "running": false,
  "progress": null,
  "summary": [
    {
      "component_key": "tabs",
      "pages_with_component": 46,
      "total_instances": 56
    }
  ],
  "details": [
    {
      "component_key": "tabs",
      "pages_with_component": 46,
      "total_instances": 56,
      "confidence": "high",
      "sample_evidence": "[role=\"tablist\"] with 5 tabs | ..."
    }
  ]
}
```

**Summary Fields:**

- `pages_with_component` - Number of unique pages containing this component
- `total_instances` - Total count across all pages

## Database Queries

### View all detections

```bash
sqlite3 /Users/piotr/Projects/cu-tool/api/data/cu-tool.db \
  "SELECT * FROM david_component_usage LIMIT 10;"
```

### Count by component

```bash
sqlite3 /Users/piotr/Projects/cu-tool/api/data/cu-tool.db \
  "SELECT component_key, COUNT(*) as detections
   FROM david_component_usage
   GROUP BY component_key
   ORDER BY detections DESC;"
```

### Top pages by component count

```bash
sqlite3 /Users/piotr/Projects/cu-tool/api/data/cu-tool.db \
  "SELECT ui.url, COUNT(DISTINCT dcu.component_key) as component_count
   FROM david_component_usage dcu
   JOIN url_inventory ui ON dcu.url_id = ui.id
   GROUP BY dcu.url_id
   ORDER BY component_count DESC
   LIMIT 10;"
```

### Pages with specific component

```bash
sqlite3 /Users/piotr/Projects/cu-tool/api/data/cu-tool.db \
  "SELECT ui.url, dcu.instance_count, dcu.confidence, dcu.evidence
   FROM david_component_usage dcu
   JOIN url_inventory ui ON dcu.url_id = ui.id
   WHERE dcu.component_key = 'tabs'
   LIMIT 10;"
```

## Test Results (50 URLs)

From initial test run:

| Component      | Pages | Instances | Confidence |
| -------------- | ----- | --------- | ---------- |
| tabs           | 46    | 56        | high       |
| cards_grid     | 14    | 51        | medium     |
| anchor_nav     | 8     | 14        | high       |
| card_carousel  | 4     | 32        | medium     |
| image_carousel | 4     | 45        | medium     |

## Performance

- Analysis speed: ~1-2 URLs/second (depends on HTML size/complexity)
- 50 URLs: ~30-60 seconds
- 8,468 URLs: ~2-3 hours (estimated)
- Consider running in batches for better monitoring

## Resumability

The system is designed to be resumable:

- Set `reset: false` to append to existing analysis
- Use `offset` parameter to process in batches
- Check progress with summary endpoint
- No modification to `url_inventory` table

## Notes

- Only analyzes pages with `html_path` populated (from Phase 1.6)
- Skips duplicate URLs (`duplicate_of_id IS NULL`)
- Conservative detectors to avoid false positives
- Evidence field provides selector-based notes for verification
