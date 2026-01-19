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

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Runtime**: Node.js + TypeScript
- **API**: Express
- **Web**: Next.js (App Router)
- **Database**: SQLite (coming soon)
- **LLM**: Ollama (local, coming soon)
