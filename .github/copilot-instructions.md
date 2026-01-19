# cu-tool — Copilot / AI Agent Instructions

## Big picture (Tech Spike 2 POC)

A lightweight **component-usage** analyzer for Nissan market sites. Flow:
**sitemap URL inventory → resumable fetch (HTML-first, Playwright fallback) → store metadata in SQLite → later: component parsing + Q&A**.

## Hard constraints (POC)

- **Single snapshot**, no real-time monitoring, no dashboards.
- **CMS-agnostic**: do not rely on AEM/Storyblok internals; work from public HTML/DOM.
- Prefer deterministic, resumable jobs; transparency of coverage > perfection.

## Repo structure

- `api/` Express + TS API (port **3002**)
- `web/` Next.js UI
- Docs: `POC_DoD.md`, `POC_implementation_plan.md`, `POC_component_taxonomy_v_0.md`, `POC_technical_environment_rendering_strategy.md`

## Developer workflows

- Install: `pnpm install`
- Build: `pnpm -r build`
- Lint: `pnpm -r lint`
- Dev: `pnpm dev` (runs api+web)

## Data store (single source of truth)

SQLite DB: `api/data/cu-tool.db`.
Main table (current phase): `url_inventory` with key fields:

- `market`, `url`, `discovered_from`, `status` (`pending|fetched|failed|skipped`)
- `http_status`, `fetched_at`, `render_mode` (`html|headless`), `error_message`
- Dedup support: `final_url`, `canonical_url`, `content_hash`, `duplicate_of_id`

## Key API endpoints

- `GET /health` (API healthcheck)
- `GET /api/inventory/build?market=UK&base=https://www.nissan.co.uk` (sitemap → `url_inventory` as `pending`)
- `GET /api/inventory/stats`, `GET /api/inventory/render-stats`
- `POST /api/fetch/start` (resumable processing of `pending` URLs)
- `GET /api/fetch/status`

## Fetch/rendering rules (see `api/src/fetch-job.ts`, `api/src/rendering.ts`)

- Default: HTTP fetch + DOM heuristics.
- Fallback to Playwright when HTML appears to be a JS shell.
- Persist `final_url` after redirects, extract `<link rel="canonical">`, compute `content_hash`.
- Mark duplicates as `status='skipped'` with `duplicate_of_id` + `error_message`.

## Component taxonomy (future phase)

When parsing components, map blocks to **exactly one** of the 10 types in `POC_component_taxonomy_v_0.md`.

## Important

- **Do not propose manual `ALTER TABLE` commands** as a fix. Schema changes must be idempotent in code (detect columns/indexes and migrate once).

## Output protocol (authoritative artifact)

```
- **All AI agents MUST write their results to `.github/response.md`.**
- Treat `response.md` as the **single source of truth**; chat output is non-authoritative.
- Every task must append/update `response.md` with this structure:
  - **What was changed**
  - **Why** (concise rationale)
  - **Evidence** (numbers, SQL queries, URLs, samples)
  - **Risks / open questions**
  - **Next recommended step**
- If information is not written to `response.md`, consider the task **incomplete**.
- When preparing prompts for other agents (Claude/Copilot), **include this requirement explicitly**.
```
