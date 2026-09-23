---
name: create-research-note
description: Create or revise an ordered Observaire Markdown note in progress/. Use for questions, literature notes, hypotheses, experiments, results, decisions, datasets, methods, milestones, and evidence objects. Do not use for application source code.
---

1. Read the repository root `AGENTS.md`, `progress/AGENTS.md`, and `docs/OBSERVAIRE_DATA_CONTRACT.md` before writing research content.
2. Inspect `research-observer.config.json` for the current type/status/relationship/project vocabularies; do not rely on remembered values when the repository declares them.
3. Inspect existing `progress/XX_*.md` files before selecting an order number and inspect existing stable IDs before creating a new identity.
4. Preserve any existing stable `id`; for a new AI-authored note, create a descriptive lowercase kebab-case ID. Filename order is presentation, never identity.
5. Add only verified/known metadata. Omit unknown date, authors, DOI, measurements, source data, or status rather than guessing. Preserve or assign the declared `research` project when the surrounding work clearly belongs to one.
6. Structure the body for the research object instead of forcing a universal template. Clearly distinguish source evidence, measurement/result, interpretation, hypothesis, limitation, uncertainty, and planned work.
7. Use relative Markdown filename links for readable references in the body. Do not manufacture `/progress/...` application URLs and never link to a target that does not exist.
8. Use frontmatter `relationships` only for explicit research semantics such as `answers`, `investigates`, `produces`, `supports`, `contradicts`, `based_on`, `builds_on`, `uses`, `derived_from`, `reproduces`, or `supersedes`. Prefer stable IDs as targets. Targets must already exist.
9. Do not infer a strong relationship from proximity, wording, AI output, Consensus rank/takeaway, citation count, or a plain Markdown link. `supports`/`contradicts` require reviewed research meaning.
10. Use `supersedes` only when creating a meaningful semantic version that should remain independently reviewable; do not create versions for ordinary edits.
11. Keep local figures, data, recordings, and papers inside `progress/` and reference them relatively.
12. For durable local-PDF excerpts, use `type: evidence` with `source.kind: pdf`, `source.pdf`, and `source.page`; keep the exact excerpt in a blockquote and interpretation outside the quote.
13. For reviewed external scholarly evidence, use the `source.kind: consensus` provenance shape from `docs/OBSERVAIRE_DATA_CONTRACT.md`; do not label abstract/takeaway text as verified full-text quotation.
14. Put structured facts in their canonical fields when they are meant to be indexed. Do not invent arbitrary frontmatter fields and expect Graph/Search/Insights to understand them.
15. Run `npm run doctor`.
16. If validation fails because of the new or edited note, repair the note rather than weakening the doctor or repository contract.
