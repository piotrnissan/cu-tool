# Human QA UI

## Purpose

The QA UI provides human-in-the-loop verification of component detections. It enables reviewers to validate or correct detector outputs, building an audit trail for precision measurement and regression gates. Each decision is captured in JSONL format for downstream quality gate validation.

## Where it lives

- **Route**: `/qa`
- **Source file**: `web/app/qa/page.tsx`

## Keyboard-first workflow

The UI is designed for rapid keyboard-driven annotation:

- **1–5**: Select decision
  - 1 = `correct`
  - 2 = `wrong_type`
  - 3 = `false_positive`
  - 4 = `missing`
  - 5 = `unclear`
- **Cmd/Ctrl+Enter**: Save decision
- **Auto-advance**: After successful save, the UI automatically advances to the next detection and resets the form

## Data captured on Save (JSONL)

Each decision is appended to:

- **Output file**: `analysis/qa-results/v1-uk/labels.jsonl`
- **API route**: `/api/qa/append`

### Fields

**Always included**:

- `timestamp` (ISO 8601)
- `detection_id` (detection instance identifier)
- `page_url` (full URL of the page)
- `component_key` (selected component type)
- `decision` (one of: correct, wrong_type, false_positive, missing, unclear)

**Conditionally included**:

- `corrected_component_key` (only when `decision=wrong_type`)
- `media_type` (only for `media_text_split` components: image, video, carousel, unknown)
- `card_type` (only for `cards_section` or `card_carousel` components: product, offer, editorial, unknown)
- `note` (optional free-text field, included only if provided)

## UI layout (2-column)

- **Left column**: Fixed-width QA form (440px), no vertical scroll
  - Detection banner (id, page, detected component)
  - Component type dropdown (preselected from detection)
  - Variant dropdowns (media_type, card_type, when applicable)
  - Corrected component dropdown (shown when decision=wrong_type)
  - Note textarea
  - Current state display
- **Right column**: Preview panel (placeholder until TH-33)
  - Reserved space for future screenshot rendering with bbox overlay
- **Dark mode**: Follows system `prefers-color-scheme` (automatic)

## QA "review unit"

One detection instance = one decision. The UI cycles through detections sequentially. The current implementation uses typed mock detections (5 sample entries from UK pages) for workflow testing until integration with real proof pack artifacts in TH-33.

## Notes / Limitations (v1)

- **Preview panel is placeholder only**: Screenshot loading, bbox overlay, and cropping are implemented in TH-33
- **Detection list is mock data**: The current detection list is a typed array used for workflow validation; real detections will be loaded from proof pack manifests
- **No batch mode**: Decisions are made one at a time
- **No navigation list**: No ability to jump to arbitrary detection index
- **No index persistence**: Detection progress is session-only (browser state is not persisted)
