# Research Content Instructions

These instructions apply to files under `progress/` and refine the repository-root `AGENTS.md`.

## Research integrity

- Treat Markdown and local research assets as evidence-bearing source material, not disposable generated output.
- Never fabricate citations, authors, DOI values, dates, measurements, quotes, page numbers, statistical claims, experiment results, or conclusions.
- Distinguish direct evidence from interpretation. If the source is uncertain or incomplete, say so.
- Preserve an existing note's stable `id` when renaming, reordering, or editing it.
- Do not silently rewrite historical results to match a later conclusion. Add a correction, superseding note, or explicit revision instead.

## Note creation

- Research notes live directly in `progress/` and use `XX_descriptive_name.md`.
- Inspect existing numeric prefixes before choosing a new order.
- AI-generated notes should include a stable lowercase kebab-case `id`.
- Use only metadata supported by the root `AGENTS.md` and `research-observer.config.json`.
- Keep metadata optional when a fact is genuinely unknown.

## Literature notes and PDFs

A literature note may declare a local paper companion:

```yaml
---
id: smith-reranking-2026
title: Efficient reranking under latency constraints
type: literature
pdf: papers/smith-reranking-2026.pdf
authors:
  - Jane Smith
  - Wei Chen
year: 2026
doi: 10.xxxx/verified-doi
---
```

Rules:

- `pdf` must point to an existing local PDF under `progress/`; normally use `papers/`.
- Do not invent author names, publication years, or DOIs from filenames.
- When quoting or paraphrasing a PDF, record the page number when known.
- A durable evidence excerpt should identify the source PDF and page.
- Prefer Research Observer deep links such as `/papers/...?...page=12` only in generated UI/context. In source Markdown, keep local relative PDF paths portable.

## Linking

- Link research notes by relative Markdown filename.
- Never create a broken Markdown link for planned future work.
- Keep figures/data/PDF references relative to the note and inside `progress/`.
- Use HTTPS for remote sources.

## Before finishing research edits

Run:

```bash
npm run doctor
```

If code or repository configuration also changed, run:

```bash
npm run check
```

Do not assume GitHub Actions exist; validation is local-first.
