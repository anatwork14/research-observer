---
name: create-research-note
description: Create or revise an ordered Research Observer Markdown note in progress/. Use for questions, literature notes, hypotheses, experiments, results, decisions, datasets, methods, and milestones. Do not use for application source code.
---

1. Read the repository root `AGENTS.md` and `progress/AGENTS.md`.
2. Inspect existing `progress/XX_*.md` files before selecting an order number.
3. Preserve any existing stable `id`; for a new AI-authored note, create a descriptive lowercase kebab-case ID.
4. Add only verified/known metadata. Omit unknown date, authors, DOI, measurements, or status rather than guessing.
5. Structure the body for the research object instead of forcing a universal template.
6. Link existing notes by relative Markdown filename.
7. Keep local figures, data, and papers inside `progress/` and reference them relatively.
8. Clearly separate evidence, interpretation, limitations, and next steps when those distinctions matter.
9. Run `npm run doctor`.
10. If validation fails because of the new note, repair the note rather than weakening the doctor.
