# Research Content Instructions

These instructions apply to files under `progress/` and refine the repository-root `AGENTS.md`.

## Canonical data contract

Before creating, restructuring, or semantically linking research notes, read `docs/OBSERVAIRE_DATA_CONTRACT.md`.

That contract is authoritative for indexing semantics: stable identity, folder-based project scope, supported metadata, evidence provenance, body links, typed relationships, edge direction, and the distinction between filename order and canonical IDs.

When instructions conflict, follow the stricter research-integrity rule and do not invent missing facts or targets.

For reliable indexing:

- put canonical object identity in `id`, not in prose;
- use a top-level project folder as the preferred project boundary;
- use `.observaire-project.json` only when stable folder-local project metadata is needed;
- use `research` on root-level/legacy notes when a configured non-default project scope is required;
- do not put a conflicting `research` value inside a folder-backed project;
- put evidence provenance in `source`;
- put strong semantic graph meaning in `relationships`;
- use body Markdown links for readable references;
- prefer stable IDs as relationship targets;
- never hide a required relationship/source only in prose and expect Graph/Insights to infer it;
- do not add arbitrary frontmatter fields and assume they will be indexed.

## Research integrity

- Treat Markdown and local research assets as evidence-bearing source material, not disposable generated output.
- Never fabricate citations, authors, DOI values, dates, measurements, quotes, page numbers, statistical claims, experiment results, or conclusions.
- Distinguish direct evidence from interpretation. If the source is uncertain or incomplete, say so.
- Preserve an existing note's stable `id` when renaming, reordering, or editing it.
- Do not silently rewrite historical results to match a later conclusion. Add a correction, superseding note, or explicit revision instead.

## Project folders and note creation

Preferred layout:

```text
progress/
├── Project Alpha/
│   ├── 00_question.md
│   ├── 01_literature.md
│   ├── 02_experiment.md
│   └── figures/
│       └── result.svg
└── Project Beta/
    ├── 00_question.md
    └── 01_method.md
```

Rules:

- A top-level folder containing at least one `XX_descriptive_name.md` file is auto-indexed as a research project.
- Numbering is independent per project. Separate projects may each start at `00_`.
- The folder name derives the project ID unless `.observaire-project.json` supplies a stable valid `id` and label.
- Asset-only folders are not projects.
- Legacy ordered notes directly in `progress/` remain supported.
- Inspect existing prefixes **inside the target project** before choosing a new order.
- AI-generated notes should include a stable lowercase kebab-case `id`.
- Inside a folder-backed project, normally omit `research`; folder identity is authoritative.
- For a root-level legacy note, `research` may name a project declared in `research-observer.config.json`; omission means `default`.
- Use only metadata supported by `docs/OBSERVAIRE_DATA_CONTRACT.md`, the root `AGENTS.md`, and `research-observer.config.json`.
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

- `pdf` must point to an existing local PDF under `progress/`; inside a folder project it is normally relative to the note, such as `papers/...`.
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

Relationship targets must already exist. Prefer their stable `id`. Never create a relationship to a planned/nonexistent object.

## Direct Edit from the website

Observaire's Direct Edit mode is allowed to update an existing ordered Markdown note, including a note inside a project folder, but it must preserve the same content rules as hand editing:

- Editing begins as a browser-local draft; previewing must not change the source file.
- A save must be preceded by a visible text diff and research-doctor validation.
- The reviewed patch must be rejected if the live note changed after the editor opened or after review.
- If post-save validation fails, the patch must be rolled back.
- Direct Edit does not stage or commit the user's live Git index. Git history remains under the researcher's control.
- Changing a stable `id` is a semantic identity change and should be intentional; routine edits should preserve it.

## Linking

Use two complementary mechanisms rather than treating them as interchangeable:

- Use relative Markdown filename links for readable prose references and section navigation.
- Relative links resolve from the current nested project directory, so `01_method.md`, `papers/source.pdf`, and intentional `../Other Project/00_question.md` links remain portable.
- Use frontmatter `relationships` for semantic connections that should appear as typed graph edges and feed Insights.
- A Markdown reference does not automatically mean `supports`, `contradicts`, or any other strong research relation.
- Prefer stable IDs for `relationships.target`; use filenames only for body Markdown links.
- Never create a broken Markdown link for planned future work.
- Keep figures/data/PDF references relative to the note and inside `progress/`.
- Use HTTPS for remote sources.

## Browser import and durable storage

The **Projects** page may import one research folder through the browser. The server stages and validates the selected folder before promoting it into `progress/`; an invalid import must be rolled back rather than partially registered.

Browser import must never silently overwrite an existing project folder.

When Observaire is run with the repository `compose.yaml`, `progress/` is a bind-mounted host directory. A project imported through the website therefore becomes a real host folder and survives container recreation. Do not treat container-only temporary state as the durable research source.

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

- Folder-backed projects are the preferred ordinary project mechanism.
- `.observaire-project.json` may stabilize a folder project's `id`, `label`, and optional description independently of its directory name.
- Root-level notes may declare `research: <project-id>` to participate in a configured portfolio project from `research-observer.config.json`.
- Root-level notes without `research` belong to `default`.
- Inside a folder-backed project, folder identity takes precedence over a conflicting `research` field and the compiler emits a diagnostic.
- Preserve one canonical note rather than copying the same evidence into multiple projects.
- Cross-project relationships are permitted when they express a real dependency or evidence relationship.
- Use `relationships: [{ type: supersedes, target: ... }]` only for meaningful research/idea versions that should remain independently reviewable.
- Ordinary edits to the same idea should remain edits to the same Markdown file and stable ID.

## Evaluation plans, experiments, and runs

Use `type: evaluation` for a structured evaluation plan. Define metrics with stable canonical IDs, labels, roles, direction, units, aggregation, display, aliases, and known thresholds/descriptions. Define comparisons, baselines, ablations, and success criteria. Metric labels are presentation text and never identity.

Structured `type: experiment` notes use `experimentSpec` to reference one existing evaluation note by stable ID and describe the experiment kind, factors, controlled variables, and optional datasets. Before creating metrics, search the project’s existing plans and reuse their IDs/aliases when appropriate. Agents must specify the evaluation objective, measurement population/dataset, primary/secondary/guardrail metrics, directions, units, aggregation, baseline, comparison plan, ablation factors, controls, success criteria, and regression/failure criteria. Omit facts that are unknown and state the uncertainty; do not invent them.

Store run manifests and raw files under `experiments/<experiment-id>/runs/<run-id>/`. Preserve original imported files and attach provenance to every derived metric; manual measurements must say they are manual. Candidate metrics found in Markdown are advisory until a person reviews/adopts them. Measurements do not imply scientific conclusions or typed `supports`/`contradicts` relationships.
