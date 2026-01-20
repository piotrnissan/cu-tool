# Component Usage Tool

Tech Spike 2 POC - Cross-market automotive website component usage analyzer.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run both apps in dev mode
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint
```

## Apps

- **API** (`/api`) - Express + TypeScript server on port 3002
- **Web** (`/web`) - Next.js UI on port 3000

## Architecture

Sitemap → HTML fetch → DOM parsing → Component normalization → SQLite → Q&A

See [POC documentation](./POC_DoD.md) for details.

## Documentation

### Tool Hardening + Visual Proof + Human QA

- **Implementation Plan**: [docs/plan.md](docs/plan.md) — 7-phase workstream (v1 component model: 11 types)
- **Architectural Decisions**: [docs/DECISIONS.md](docs/DECISIONS.md) — Confirmed decisions (v1 model, modal exclusion, variant fields)
- **Task Tracker**: [docs/tracker.md](docs/tracker.md) — 42 tasks across 3 sprints + 3 quality gate classes
- **Methodology**: [docs/methodology.md](docs/methodology.md) — Component analysis definitions and rules

### Visual Proof Pack

- **Overview**: [docs/visual-proof/overview.md](docs/visual-proof/overview.md) — What the proof pack is, workflow, inputs/outputs
- **Data Contracts**: [docs/visual-proof/data-contracts.md](docs/visual-proof/data-contracts.md) — JSON schemas (v1 model with variant fields)
- **Proof Runner**: [docs/visual-proof/runner.md](docs/visual-proof/runner.md) — Locator strategy, modal exclusion policy
- **QA UI**: [docs/visual-proof/qa-ui.md](docs/visual-proof/qa-ui.md) — Labeling workflow with variant fields (media_type, card_type)
- **Quality Gates**: [docs/visual-proof/quality-gates.md](docs/visual-proof/quality-gates.md) — Impact-class thresholds, minimum sample size

### Analysis

- **Visual Proof Demo**: [analysis/visual-proof/README.md](analysis/visual-proof/README.md) — Demo runner (heuristic detection for validation)
- **Analysis Results**: [.github/response.md](.github/response.md) — Operational log (analysis frozen until quality gates pass)

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Runtime**: Node.js + TypeScript
- **API**: Express
- **Web**: Next.js (App Router)
- **Database**: SQLite (coming soon)
- **LLM**: Ollama (local, coming soon)
