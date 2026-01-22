# cu-tool — Copilot / AI Agent Instructions

## Project context (source of truth)

This repo is the source of truth: **cu-tool** (pnpm monorepo).

Current focus: **Sprint 2 — Detector Hardening** (TH-14+).
Primary goal: build a **reliable component detection + visual proof + human QA** workflow for Nissan pages (starting with UK VLP + editorial).

Do not perform speculative usage analysis until detectors are hardened and QA gates pass.

## Hard constraints

- **No speculative analysis** (no rankings, no conclusions, no “insights” beyond verified evidence).
- **No creative refactors**. Make minimal, incremental changes only.
- **One task / one component at a time**.
- **No code changes unless explicitly requested** by the user (or by a task prompt).
- **Tracker must reflect reality**. Never mark tasks done unless verified by evidence.

## Repo structure (high level)

- `api/` — Express + TypeScript API (port 3002)
- `web/` — Next.js UI
- `docs/` — authoritative documentation (plan, methodology, decisions, tracker, visual-proof docs)
- `.github/response.md` — canonical operational log (authoritative)

## Data & safety rules (very important)

- Never commit local datasets/caches or secrets:
  - `api/data/*` (SQLite DB), `api/data/html/*` (HTML cache), `*.db`, `*.db-wal`, `*.db-shm`, `*.html.gz`, `.env*`, `logs/`
- Avoid adding temporary scripts or debug files.
  - If local debugging is necessary, use ephemeral commands only and do not create tracked files.
- Avoid `git add .` — always stage files explicitly.

## Key workflows (baseline validation gates)

When a task changes detectors or export/proof behavior, validation must include:

- `pnpm lint`
- `pnpm --filter @cu-tool/api build`
- `pnpm proof:export`
- `pnpm proof:run`

(If the task is docs-only, do not run build/proof unless requested.)

## Component detection conventions (critical)

- Do not assume semantic HTML (e.g., `<main>`, `<article>`) is reliable.
- Always exclude global chrome where relevant:
  - header/nav/meganav/footer/contentinfo/cookie/consent
  - modals/popups (`[role="dialog"]`, `[aria-modal="true"]`) are excluded by design in v1.
- Distinguish:
  - **Eligible URLs** vs **URLs with detections**
  - `david_component_usage` contains only detected rows.

## Output protocol (authoritative artifact)

**All AI agents MUST update `.github/response.md`** for tasks that change behavior or documentation.

### Required `response.md` format (lean, no roadmap)

For each task entry, include ONLY:

- **What changed** (bullet list, file paths)
- **Why** (1 short paragraph, objective rationale)
- **Evidence / Validation** (commands run + key outputs; keep it factual)
- **Notes** (optional; only if it clarifies expected behavior or constraints)

### Explicitly forbidden in `response.md` unless the user requests it

- “Risks / open questions”
- “Next recommended step”
- Roadmaps, future work suggestions, or speculative recommendations
- Debug diaries (step-by-step trial-and-error narratives)

If you add any forbidden content, the task will be considered incomplete until it is removed.

## Collaboration mode

- ChatGPT provides analysis and prompts.
- Claude/Copilot Agent performs code edits.
- If a requested change is ambiguous, ask a single clarifying question (do not proceed with assumptions).

## API endpoints (reference only)

- `GET /health`
- Inventory build/stats endpoints (see `api/src/index.ts`)
- Analysis endpoints (see `api/src/index.ts`; do not invent routes)

Important: Do not suggest manual `ALTER TABLE` commands. Schema changes must be implemented idempotently in code.

## Definition of done (for hardening tasks)

A detector hardening task is “done” only when:

- Changes are minimal and scoped
- Validation gates pass (lint/build/proof when applicable)
- `docs/tracker.md` reflects the correct state (only if requested by the user)
- `.github/response.md` is updated using the lean format above
