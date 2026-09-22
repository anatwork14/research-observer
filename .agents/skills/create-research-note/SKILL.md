---
name: create-research-note
description: Create or revise an ordered Observaire Markdown note in progress/. Use for questions, literature notes, hypotheses, experiments, results, decisions, datasets, methods, milestones, and evidence objects. Do not use for application source code.
---

1. Read the repository root `AGENTS.md` and `progress/AGENTS.md`.
2. Inspect existing `progress/XX_*.md` files before selecting an order number.
3. Preserve any existing stable `id`; for a new AI-authored note, create a descriptive lowercase kebab-case ID.
4. Add only verified/known metadata. Omit unknown date, authors, DOI, measurements, or status rather than guessing. Preserve or assign the declared `research` project when the surrounding work clearly belongs to one.
5. Structure the body for the research object instead of forcing a universal template.
6. Link existing notes by relative Markdown filename.
7. Keep local figures, data, and papers inside `progress/` and reference them relatively.
8. Use `relationships` only for explicit research semantics such as `answers`, `produces`, `supports`, `contradicts`, `based_on`, `builds_on`, `uses`, `derived_from`, `reproduces`, or `supersedes`. Targets must already exist.
9. Use `supersedes` only when creating a meaningful semantic version that should remain independently reviewable; do not create versions for ordinary edits.
10. For durable PDF excerpts, use `type: evidence` with `source.pdf` and `source.page`; keep the exact excerpt in a blockquote and interpretation outside the quote.
11. Clearly separate evidence, interpretation, limitations, and next steps when those distinctions matter.
12. Run `npm run doctor`.
13. If validation fails because of the new note, repair the note rather than weakening the doctor.
