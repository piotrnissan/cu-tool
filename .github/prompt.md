You are acting as a Senior Architect / Lead Developer on the project:
https://github.com/piotrnissan/cu-tool

Your task is DOCUMENTATION ONLY.
Do NOT implement code.
Do NOT refactor existing files.
Do NOT change any logic.

Goal
We are planning a new sprint that introduces a lightweight Visual QA UI
for validating component detection results produced by the Visual Proof Runner.

This UI is intended for a SINGLE USER (project owner),
with minimal interaction cost and no separate QA team.

The purpose is:

- visually review detected components on real pages
- confirm / reject detections quickly
- collect corrections in a machine-readable way
- support iterative improvement of detectors later

Scope of this task
Create clear, complete documentation for the upcoming sprint.
This documentation will live in the repository and be used later
to guide implementation.

Where to write
Create a new folder:

docs/visual-qa/

Inside it, create the following Markdown files:

1. docs/visual-qa/README.md
2. docs/visual-qa/scope.md
3. docs/visual-qa/architecture.md
4. docs/visual-qa/user-flow.md
5. docs/visual-qa/data-contracts.md
6. docs/visual-qa/sprint-plan.md
7. docs/visual-qa/risks.md

Also update (append, do not rewrite):

- README.md → add a short section linking to Visual QA documentation

---

CONTENT REQUIREMENTS

1. README.md
   High-level overview:

- What the Visual QA UI is
- Why it exists
- What problem it solves
- What it explicitly does NOT solve

2. scope.md
   Define:

- In-scope functionality (v1)
- Out-of-scope items (explicitly list things NOT planned)
- Non-goals (e.g. no ML training, no automation yet)

3. architecture.md
   Describe:

- High-level architecture (no code)
- Relationship to:
  - Visual Proof Runner
  - existing analysis artifacts (screenshots + JSON)
- Why this is a separate mini-app (not part of core API)
- Why no database is used (file-based only)

4. user-flow.md
   Describe the EXACT user experience:

- Page list selection
- Viewing screenshot with overlays
- Reviewing detected components one by one
- Actions available:
  - Confirm
  - Mark as incorrect → choose correct label
  - Skip
- Keyboard-first interaction
- Automatic persistence (no Save button)

Be very concrete and concise.

5. data-contracts.md
   Define file formats (JSON / JSONL) for:

- Input:
  - detection manifest (from Visual Proof Runner)
- Output:
  - user labels (append-only)

Include example JSON snippets.
Explain why JSONL is used.

6. sprint-plan.md
   Split work into clear phases:

- Sprint goal
- Tasks (numbered)
- Each task must have:
  - description
  - difficulty (S / M / L)
  - dependencies
  - acceptance criteria

This sprint is ONLY about the Visual QA UI (no detector changes).

7. risks.md
   Identify:

- Technical risks
- UX risks (single-user fatigue, mis-clicks)
- Scope creep risks
- What we deliberately postpone

---

IMPORTANT CONSTRAINTS

- Assume ONLY ONE USER (no auth, no roles)
- Assume limited time and no QA team
- Prefer simplicity over completeness
- No ML, no training loops in this sprint
- This sprint does NOT change analysis results yet

---

OUTPUT RULES

- Write clean, professional Markdown
- No code blocks unless showing data formats
- No speculative future promises
- No implementation details
- Everything must be consistent with the current project state

At the end, add a short section:

"Open Questions / Confirmation Needed"
with 3–5 concrete questions to confirm before implementation.

Begin now.
