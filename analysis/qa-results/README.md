# QA Results

This directory contains human QA labels produced by the QA UI at `/web/app/qa`.

## Structure

- `v1-uk/labels.jsonl` — Human-validated labels for UK proof pack pages (v1 component types)

## Format

Each line in `labels.jsonl` is a JSON object with the following fields:

**Required:**

- `timestamp` — ISO timestamp
- `page_url` — Page URL or identifier
- `component_key` — Detected component type
- `decision` — QA decision (correct | wrong_type | false_positive | missing | unclear)

**Optional:**

- `corrected_component_key` — Corrected type (only for wrong_type decisions)
- `media_type` — Media variant (only for media_text_split)
- `card_type` — Card variant (only for cards_section / card_carousel)
- `note` — Free-text note
