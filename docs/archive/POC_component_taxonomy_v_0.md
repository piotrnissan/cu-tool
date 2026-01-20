# Tech Spike 2 — Component Taxonomy v0

**Status**: Archived / Superseded

**Authoritative v1 tool-hardening docs**: [/docs/plan.md](../plan.md), [/docs/methodology.md](../methodology.md), [/docs/DECISIONS.md](../DECISIONS.md)

---

## Purpose

This document defines the **initial (v0) global component taxonomy** used in **Tech Spike 2**.

The taxonomy exists to:

- enable **consistent counting of components** across markets,
- support **usage-based analysis**, not design critique,
- remain **CMS-agnostic** and stable across PACE variations.

This is a **POC taxonomy**:

- deliberately small,
- deliberately opinionated,
- expected to evolve **only after** data proves it insufficient.

---

## Core Principles

1. **Structural, not semantic**  
   Components are identified by layout and structure, not by meaning or copy.

2. **One instance → one type**  
   Every detected block must map to exactly one taxonomy type.

3. **Global by default**  
   The same taxonomy applies to UK, JP, US and future markets.

4. **Usage-first**  
   The taxonomy exists to answer:
   > “Component Y is used X times”

---

## Taxonomy Overview (v0)

The v0 taxonomy contains **10 component types**.

These types have been validated across:

- UK (Global)
- Japan (Japan market)
- USA (NNA)

---

## Component Types

### 1. Full-width Hero

**Description**  
Large, full-bleed section at the top of a page, typically above the fold.

#### Structural characteristics: Full-width Hero

- Full viewport or full container width
- Primary visual (image or video)
- Headline and at least one CTA

#### Common usage: Full-width Hero

- Page entry point
- Model or campaign introduction

---

### 2. Media + Text Split

**Description**  
Two-column section combining media and text content.

#### Structural characteristics: Media + Text Split

- Horizontal split (50/50 or similar)
- Media on one side, text on the other
- Layout may alternate left/right

#### Common usage: Media + Text Split

- Feature explanation
- Product storytelling

---

### 3. Feature Highlight

**Description**  
Compact content block highlighting a single feature or concept.

#### Structural characteristics: Feature Highlight

- Headline + short description
- Optional small visual or icon
- Less dominant than hero or split sections

#### Common usage: Feature Highlight

- Capability explanations
- Micro-storytelling

---

### 4. Listing / Grid

**Description**  
A repeated set of items displayed in a grid or list layout.

#### Structural characteristics: Listing / Grid

- Multiple cards or rows
- Consistent internal structure
- Often responsive columns

#### Common usage: Listing / Grid

- Vehicle listings
- Offers
- Content hubs

---

### 5. Carousel / Gallery

**Description**  
Horizontally scrollable collection of media or cards.

#### Structural characteristics: Carousel / Gallery

- Slider behaviour
- Navigation controls (dots, arrows)
- Repeated item structure

#### Common usage: Carousel / Gallery

- Image galleries
- Feature browsing

---

### 6. CTA Band

**Description**  
Highly prominent call-to-action section.

#### Structural characteristics: CTA Band

- Distinct background or visual separation
- One or more primary CTAs
- Minimal supporting content

#### Common usage: CTA Band

- Conversion moments
- Build & Price / Find a Dealer

---

### 7. Specs / Key Facts

**Description**  
Structured presentation of key numeric or factual data.

#### Structural characteristics: Specs / Key Facts

- Numbers with labels
- Often icon-supported
- Compact, scannable layout

#### Common usage: Specs / Key Facts

- Vehicle highlights
- Performance or range summaries

---

### 8. Legal / Info Block

**Description**  
Informational or legal content with low visual priority.

#### Structural characteristics: Legal / Info Block

- Small text size
- Dense copy
- Often placed near CTAs or page end

#### Common usage: Legal / Info Block

- Disclaimers
- Regulatory information

---

### 9. Navigation / Utility Block

**Description**  
Structural navigation or utility-related sections within page content.

#### Structural characteristics: Navigation / Utility Block

- Anchor links
- In-page navigation
- Utility controls

#### Common usage: Navigation / Utility Block

- Long-form pages
- Content-heavy journeys

---

### 10. Rich Interactive Block

**Description**  
Large, custom or highly interactive content blocks.

#### Structural characteristics: Rich Interactive Block

- Non-standard DOM structure
- Heavy JS interaction
- Often application-like

#### Common usage: Rich Interactive Block

- Configurators
- Advanced shopping tools

#### Notes: Rich Interactive Block

- This type is intentionally broad
- Used sparingly and flagged for deeper analysis

---

## Explicit Exclusions

The following are **not** separate component types in v0:

- Header / global navigation
- Footer
- Modal dialogs
- Cookie banners
- A/B testing wrappers

These are excluded to avoid noise in usage analysis.

---

## Handling Ambiguity

If a block appears to match multiple types:

1. Choose the **more dominant structural pattern**
2. Prefer **simpler types** over complex ones
3. Document the ambiguity for potential taxonomy evolution

---

## Evolution Rules

The taxonomy may evolve **only if**:

- data shows repeated misclassification, or
- a structurally distinct pattern appears across multiple markets.

Taxonomy changes must:

- be versioned (v1, v2…)
- be applied retroactively to existing snapshots where possible

---

## Summary

This v0 taxonomy provides:

- a shared language for component usage,
- a stable basis for cross-market comparison,
- and a practical foundation for Tech Spike 2 POC analysis.

It intentionally favours **clarity and consistency over completeness**.
