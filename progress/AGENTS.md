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
- A durable local-PDF evidence excerpt should identify the source PDF and page.
- Prefer Observaire deep links such as `/papers/...?...page=12` only in generated UI/context. In source Markdown, keep local relative PDF paths portable.

## Evidence objects and typed relationships

Evidence can use one of two explicit provenance shapes.

For a local PDF passage, use `kind: pdf`, an existing local PDF path, and the positive page number:

```yaml
type: evidence
source:
  kind: pdf
  pdf: papers/smith-reranking-2026.pdf
  page: 12
```

Put the exact selected excerpt in a Markdown blockquote and keep interpretation outside the quote.

For a paper reviewed through Consensus, Observaire may create an external evidence object with `kind: consensus`:

```yaml
type: evidence
source:
  kind: consensus
  url: https://example.org/paper
  doi: 10.xxxx/verified-doi
  paper_id: returned-consensus-id
  query: retrieval evaluation systematic review
```

Rules for external evidence:

- Preserve only metadata actually returned by the scholarly provider or verified from the paper.
- At least one of `url`, `doi`, or `paper_id` must identify the external source.
- Remote source URLs must use HTTPS.
- A Consensus takeaway or abstract is discovery context, not a verified quotation from the full paper.
- Only text explicitly returned as eligible full-text content may be saved under an evidence-excerpt heading, and it must still be checked against the original source before supporting a strong claim.
- Saving a paper does not automatically create `supports`, `contradicts`, or other semantic relationships.

Use `relationships` when the research meaning is stronger than an ordinary hyperlink. Supported relationship types are configured in `research-observer.config.json`. Common meanings:

- `answers`: result/evidence answers a question.
- `investigates`: experiment investigates a question.
- `produces`: experiment produces a result.
- `supports` / `contradicts`: evidence bears on another research object.
- `based_on`: a decision is grounded in evidence/results.
- `builds_on`, `derived_from`, `uses`, `reproduces`, `supersedes`: research lineage.

Relationship targets must already exist. Never create a relationship to a planned/nonexistent object.

## Direct Edit from the website

Observaire's Direct Edit mode is allowed to update an existing ordered Markdown note, but it must preserve the same content rules as hand editing:

- Editing begins as a browser-local draft; previewing must not change the source file.
- A save must be preceded by a visible text diff and research-doctor validation.
- The reviewed patch must be rejected if the live note changed after the editor opened or after review.
- If post-save validation fails, the patch must be rolled back.
- Direct Edit does not stage or commit the user's live Git index. Git history remains under the researcher's control.
- Changing a stable `id` is a semantic identity change and should be intentional; routine edits should preserve it.

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

## Research project and version identity

- Notes may declare `research: <project-id>` to participate in a named portfolio project from `research-observer.config.json`.
- If `research` is omitted, the note belongs to `default`.
- Preserve one canonical note rather than copying the same evidence into multiple projects.
- Cross-project relationships are permitted when they express a real dependency or evidence relationship.
- Use `relationships: [{ type: supersedes, target: ... }]` only for meaningful research/idea versions that should remain independently reviewable.
- Ordinary edits to the same idea should remain edits to the same Markdown file and stable ID.
