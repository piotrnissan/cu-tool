# Tech Spike 2 — Technical Environment & Rendering Strategy

## Purpose

This document describes the **technical environment**, tooling choices, and the **rendering strategy** used for Tech Spike 2.

Its goal is to clearly explain:
- why specific technologies were chosen,
- how different market stacks (AEM, Storyblok, custom) are handled safely,
- and how we avoid assumptions about SSR vs CSR rendering.

This document complements:
- *POC Definition of Done*
- *POC Implementation Plan*
- *Component Taxonomy v0*

---

## Market Technology Reality

The markets included in the POC use **different and partially unknown stacks**:

- **UK** — mixed implementation (AEM + Storyblok)
- **USA (NNA)** — primarily AEM
- **Japan** — mixed AEM and custom platform(s)

As a result:
- rendering behaviour is **not uniform**,
- SSR vs CSR cannot be assumed upfront,
- CMS knowledge cannot be relied upon.

The pipeline must therefore be **rendering-agnostic**.

---

## Runtime Environment (POC)

### Local execution

POC is executed locally on a developer machine:

- **Runtime:** Node.js (TypeScript)
- **Package manager:** pnpm
- **Database:** SQLite
- **LLM runtime:** Ollama (local)

This setup is sufficient for:
- one-time snapshot processing,
- cross-market analysis,
- and Q&A-based insight delivery.

---

## Data Acquisition Strategy

### HTML-first by default

All pages are initially processed using **HTML-only fetching**:

- raw HTML is fetched via HTTP
- DOM is parsed without executing JavaScript
- structural blocks are detected directly from markup

This approach is:
- fast
- resource-efficient
- sufficient for many AEM and SSR-based Storyblok pages

---

### Headless rendering as fallback

Some pages may deliver only a minimal HTML shell and rely on JavaScript for rendering.

For these cases, a **headless browser fallback** is used:

- **Tool:** Playwright (Chromium)
- Triggered **only when required**
- Never used as the default mode

---

## Render Mode Detection

Each URL is evaluated to determine whether HTML-only rendering is sufficient.

### Signals indicating HTML sufficiency (SSR / SSG)
- Presence of semantic content blocks (`section`, `article`, `h1–h3`)
- Meaningful text nodes in the body
- Repeated structural patterns suitable for block detection

### Signals indicating headless requirement (CSR / heavy hydration)
- Page body contains mostly a single root element (e.g. `#__next`, `#root`)
- Very low semantic content density
- Structure appears only after JavaScript execution

Each URL is tagged with:
```
render_mode: html | headless
```

This metadata is stored alongside fetch status in the URL inventory.

---

## Why This Strategy Works for Tech Spike 2

- No assumptions about CMS or framework
- Safe handling of mixed market implementations
- Resource usage stays controlled on local hardware
- Clear visibility into how many pages actually require headless rendering

This directly supports informed decisions about:
- future hosting needs
- scaling strategy
- automation vs manual snapshot execution

---

## Relationship to Q&A Interface

The Q&A layer (Ollama):
- does **not** care how a page was rendered
- operates only on the final dataset
- can transparently report coverage, e.g.:

> “UK snapshot: 82% HTML-rendered, 18% headless-rendered pages”

This improves trust and explainability of insights.

---

## Scope Boundaries (POC)

This strategy intentionally excludes:
- real-time rendering
- continuous monitoring
- framework-specific optimisation

These are deferred until POC value is proven.

---

## Summary

Tech Spike 2 uses a **rendering-agnostic, HTML-first pipeline with selective headless fallback**.

This allows reliable component usage analysis across markets with:
- minimal assumptions,
- controlled cost,
- and maximum transparency.

