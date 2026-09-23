---
name: create-research-note
description: Create or revise an ordered Observaire Markdown note in progress/. Use for questions, literature notes, hypotheses, experiments, results, decisions, datasets, methods, milestones, and evidence objects. Do not use for application source code.
---

1. Read the repository root `AGENTS.md`, `progress/AGENTS.md`, `docs/OBSERVAIRE_DATA_CONTRACT.md`, and `docs/observaire-research-frontmatter.schema.json` before writing research content.
2. Inspect `research-observer.config.json` for the current type/status/relationship/configured-project vocabularies; do not rely on remembered values when the repository declares them.
3. Treat the JSON Schema as the machine-readable core shape for new durable AI-authored objects; treat `research-observer.config.json` as authoritative for vocabularies that can evolve, while folder-backed projects are discovered from the `progress/` tree.
4. Determine the target project before choosing a filename. Prefer an existing top-level folder-backed project. A top-level folder containing ordered notes is itself a project; inspect `.observaire-project.json` there when present. Root-level notes remain a compatibility/default path.
5. Inspect existing ordered Markdown files **inside the target project** before selecting an order number. Separate projects may each use `00_*`, `01_*`, and so on without collision. Inspect existing stable IDs across the whole workspace before creating a new identity.
6. Preserve any existing stable `id`; for a new AI-authored note, create a descriptive lowercase kebab-case ID. Filename order is presentation, never identity.
7. Add only verified/known metadata. Omit unknown date, authors, DOI, measurements, source data, or status rather than guessing. Inside a folder-backed project, normally omit `research`; folder identity is authoritative. For a root-level legacy note, preserve or assign a valid configured `research` project when appropriate.
8. Structure the body for the research object instead of forcing a universal template. Clearly distinguish source evidence, measurement/result, interpretation, hypothesis, limitation, uncertainty, and planned work.
9. Use relative Markdown filename links for readable references in the body. Resolve them from the current project directory. Do not manufacture `/progress/...` application URLs and never link to a target that does not exist.
10. Use frontmatter `relationships` only for explicit research semantics such as `answers`, `investigates`, `produces`, `supports`, `contradicts`, `based_on`, `builds_on`, `uses`, `derived_from`, `reproduces`, or `supersedes`. Prefer stable IDs as targets. Targets must already exist.
11. Do not infer a strong relationship from proximity, wording, AI output, Consensus rank/takeaway, citation count, or a plain Markdown link. `supports`/`contradicts` require reviewed research meaning.
12. Use `supersedes` only when creating a meaningful semantic version that should remain independently reviewable; do not create versions for ordinary edits.
13. Keep local figures, data, recordings, and papers inside `progress/`; for folder-backed projects, keep project-specific assets inside that project folder when practical and reference them relatively.
14. For durable local-PDF excerpts, use `type: evidence` with `source.kind: pdf`, `source.pdf`, and `source.page`; keep the exact excerpt in a blockquote and interpretation outside the quote.
15. For reviewed external scholarly evidence, use the `source.kind: consensus` provenance shape from `docs/OBSERVAIRE_DATA_CONTRACT.md`; do not label abstract/takeaway text as verified full-text quotation.
16. Put structured facts in their canonical fields or project-folder metadata when they are meant to be indexed. Do not invent arbitrary frontmatter fields and expect Graph/Search/Insights to understand them.
17. Run `npm run doctor`.
18. If validation fails because of the new or edited note, repair the note rather than weakening the doctor or repository contract.
