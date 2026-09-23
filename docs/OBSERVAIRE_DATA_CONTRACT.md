# Observaire research data contract

Contract version: **2**

This document defines the stable data shape that humans, ChatGPT, Codex, and other agents should produce when creating or editing Observaire research content. It exists so search, graph, Insights, evidence, relationships, version lineage, project auto-indexing, and future indexing all read the same semantics from Markdown instead of inferring meaning from prose.

## 1. Source-of-truth rule

Research content lives under `progress/`. The preferred multi-project layout is one top-level folder per research project, containing ordered Markdown notes and any local assets that belong with them:

```text
progress/
├── Protein Folding/
│   ├── 00_question.md
│   ├── 01_literature.md
│   ├── 02_experiment.md
│   ├── papers/
│   │   └── smith-2026.pdf
│   └── figures/
│       └── result.svg
└── Evaluation Study/
    ├── 00_question.md
    └── 01_method.md
```

A top-level folder is auto-registered as a research project when it contains at least one Markdown file whose basename matches the ordered-note convention (`00_*.md`, `01_*.md`, and so on). Asset-only folders do not become projects.

Legacy root-level ordered notes remain supported:

```text
progress/00_start_here.md
progress/01_research_question.md
```

The numeric filename prefix controls display order **inside one project** only. It is **not identity**, and the same number may appear in different project folders.

A stable frontmatter `id` is the canonical research-object identity. Keep it unchanged through ordinary edits, filename changes, and reordering.

### Folder-local project identity

By default, Observaire derives a lowercase kebab-case project ID from the project folder name. For example:

```text
progress/My Retrieval Study/
```

becomes project ID:

```text
my-retrieval-study
```

For a stable ID/label that should survive a folder rename, place `.observaire-project.json` inside the project folder:

```json
{
  "schemaVersion": 1,
  "id": "retrieval-study",
  "label": "Retrieval Study",
  "description": "Retrieval experiments and supporting evidence."
}
```

This manifest is project metadata, not a research object or asset.

## 2. Canonical frontmatter

Use only facts that are known or verified. Omit unknown optional values instead of filling them with guesses.

```yaml
---
id: retrieval-hypothesis-v1
title: Retrieval augmentation reduces unsupported claims
summary: Tests whether retrieval augmentation reduces unsupported claims under a fixed evaluation protocol.
type: hypothesis
status: investigating
date: 2026-09-23
tags:
  - retrieval
  - evaluation
aliases:
  - old-retrieval-hypothesis
relationships:
  - type: derived_from
    target: retrieval-question-main
    note: Derived from the primary research question.
---
```

Inside an auto-indexed project folder, `research` normally SHOULD be omitted because folder membership is the project source of truth. If `research` is present and disagrees with the folder project, Observaire uses the folder project and emits a diagnostic.

Root-level legacy notes may still use an explicit `research` value:

```yaml
research: retrieval-study
```

### Stable/indexable fields

| Field | Shape | Meaning |
| --- | --- | --- |
| `id` | lowercase kebab-case string | Canonical identity. Strongly recommended for every durable object. |
| `title` | string | Human-readable title. |
| `summary` | string | One factual sentence describing purpose/finding. |
| `type` | configured vocabulary | Research-object kind. |
| `status` | configured vocabulary | Workflow state, not quality score. |
| `research` | project ID | Project scope for root-level/legacy notes. Folder membership takes precedence for folder-backed projects. |
| `date` | `YYYY-MM-DD` | Date known for the object/event. Omit if unknown. |
| `tags` | list of strings | Cross-cutting labels. |
| `aliases` | list of strings | Previous stable IDs/slugs that should still resolve. |
| `authors` | list of strings | Verified authors, mainly for literature. |
| `year` | four-digit year | Verified publication year. |
| `doi` | string | Verified DOI. Never infer it. |
| `pdf` | relative path | Local literature PDF under `progress/`. |
| `relationships` | list of objects | Explicit semantic graph edges. |
| `source` | object | Evidence provenance. |

Current `type` vocabulary is defined in `research-observer.config.json` and presently includes:

`note`, `question`, `hypothesis`, `literature`, `method`, `dataset`, `experiment`, `result`, `decision`, `milestone`, `evidence`.

Current `status` vocabulary is:

`idea`, `investigating`, `experimenting`, `validating`, `complete`, `blocked`, `archived`.

Agents MUST inspect `research-observer.config.json` rather than assuming these vocabularies are permanent.

## 3. Identity, filename, and aliases

Identity precedence:

1. `id` — canonical stable identity.
2. `aliases` — old identities that should continue resolving.
3. filename-derived slug — compatibility/routing identity.
4. numeric filename prefix — sequence only.

For a nested project note without `id`, Observaire scopes its filename fallback by project to reduce collisions, but durable notes should still define a stable `id`.

Do not create a new semantic version merely because wording changed. Preserve the same `id` for normal edits.

Create a new object + `supersedes` only when preserving both intellectual versions is useful.

## 4. Linking contract

Observaire deliberately separates **readable document links** from **semantic graph relationships**.

### Body Markdown links = readable references

Use relative Markdown filenames when mentioning another note in prose:

```md
See the [baseline experiment](04_baseline_experiment.md).
```

Inside project folders, nested relative paths are supported:

```md
See the [source paper](papers/smith-2026.pdf).
See the [other project note](../Evaluation Study/01_method.md).
```

Section links are allowed:

```md
See [failure analysis](05_evaluation.md#failure-analysis).
```

Never manufacture `/progress/...` application URLs in research Markdown.

Never link to a nonexistent planned file. Mention planned work as plain text until the target exists.

### `relationships` = explicit research semantics

Use frontmatter relationships when the connection has research meaning that should be indexed and rendered in Graph/Insights:

```yaml
relationships:
  - type: investigates
    target: retrieval-question-main
  - type: produces
    target: retrieval-result-v1
```

Targets should use the target object's stable `id` whenever possible. The target MUST already exist.

Current relationship vocabulary is defined in `research-observer.config.json` and presently includes:

- `supports` — evidence/result increases support for a claim/object.
- `contradicts` — evidence/result conflicts with a claim/object.
- `answers` — result/evidence addresses a question.
- `investigates` — experiment/method examines a question or hypothesis.
- `builds_on` — later work extends earlier work.
- `produces` — experiment/method yields a result/artifact.
- `uses` — object depends on a method/dataset/source.
- `based_on` — decision is grounded in evidence/results.
- `derived_from` — object was derived from an earlier object.
- `reproduces` — work attempts/reports a reproduction.
- `supersedes` — meaningful semantic replacement/version.
- `references` — explicit weak reference when needed.

Do not create `supports`, `contradicts`, `answers`, or other strong semantic relationships merely because an AI model, search ranking, abstract, or Consensus takeaway suggests one. These require human-reviewed research meaning.

### Edge direction matters

Write the relationship on the source object and point `target` at the object it relates to.

Examples:

- experiment `investigates` hypothesis
- experiment `produces` result
- evidence `supports` hypothesis
- evidence `contradicts` hypothesis
- decision `based_on` result
- hypothesis-v2 `supersedes` hypothesis-v1

## 5. Project contract

Observaire supports two compatible project mechanisms.

### Preferred: folder-backed projects

Any top-level folder under `progress/` containing at least one ordered Markdown note is automatically a project. Its folder name derives the project ID unless `.observaire-project.json` supplies a stable ID and label.

Within a folder-backed project:

- folder membership defines `research` scope;
- note order starts independently at `00`/`01` for that project;
- assets may live beside the notes or in nested asset folders;
- `research:` frontmatter is optional and normally omitted;
- if `research:` disagrees with folder identity, folder identity wins and a diagnostic is emitted.

### Compatibility/advanced: configured projects

`researchProjects` in `research-observer.config.json` remains supported for root-level notes, legacy workspaces, predeclared empty projects, and explicit metadata. A root-level object may use:

```yaml
research: retrieval-study
```

If a root-level note omits `research`, it belongs to `default`.

Do not duplicate the same evidence or note into multiple projects. Keep one canonical object and use typed relationships when cross-project meaning exists.

Project folders should not be used merely as generic asset buckets. A folder becomes a project only when it contains an ordered Markdown note.

## 6. Evidence provenance

Evidence must keep machine-readable provenance under `source`.

### Local PDF evidence

```yaml
---
id: evidence-smith-p12-main-result
title: Evidence: Smith p. 12
summary: Verified excerpt from Smith, page 12.
type: evidence
status: complete
source:
  kind: pdf
  pdf: papers/smith-2026.pdf
  page: 12
relationships:
  - type: supports
    target: retrieval-hypothesis-v1
---
```

The exact excerpt should be a Markdown blockquote. Interpretation belongs outside the quotation.

For a note inside a project folder, local PDF paths remain relative to that note's location.

### Consensus/external paper evidence

```yaml
source:
  kind: consensus
  url: https://example.org/paper
  doi: 10.xxxx/verified-doi
  paper_id: returned-provider-id
  query: retrieval augmentation unsupported claims
```

At least one of `url`, `doi`, or `paper_id` must identify the source. Remote URLs must use HTTPS.

Consensus abstract/takeaway text is discovery context, not automatically a full-paper quotation. Full-text excerpts should only be presented as such when the provider explicitly returned eligible full text, and researchers should still verify against the original paper before relying on the quote.

## 7. Body structure

Frontmatter carries machine-readable identity/provenance. The Markdown body carries human-readable reasoning.

Start with one H1 matching the object topic, then use H2/H3 sections appropriate to the object.

Recommended patterns are examples, not mandatory templates.

### Question

```md
# Research question

## Question
## Why it matters
## Current evidence
## Unknowns
## Next steps
```

### Hypothesis

```md
# Hypothesis

## Statement
## Rationale
## Falsification criterion
## Evidence for
## Evidence against
## Assumptions
## Next test
```

### Experiment

```md
# Experiment

## Question
## Setup
## Method
## Variables
## Controls
## Metrics
## Results
## Interpretation
## Limitations
## Next steps
```

### Result

```md
# Result

## Observation
## Measurements
## Interpretation
## Limitations
## Consequences
```

### Literature

```md
# Paper / literature note

## Research question
## Source
## Method
## Key claims
## Evidence
## Limitations
## Relevance
```

### Evidence

```md
# Evidence

## Evidence excerpt
> Exact source text when a verified quotation exists.

## Research note
Interpretation kept separate from the quote.
```

## 8. Facts vs interpretation

Agents MUST distinguish:

- direct source evidence,
- measured result,
- researcher interpretation,
- AI suggestion,
- unresolved question,
- planned next step.

Do not turn a hypothesis into a result. Do not turn an abstract into verified evidence. Do not turn a ranking signal into a scientific conclusion.

If a value is unknown, write the uncertainty in prose or omit the metadata field.

## 9. Indexing semantics

Observaire's compiler derives searchable/indexable data from folder structure, frontmatter, and Markdown.

Agents should assume these are intended index dimensions:

- project folder identity / optional `.observaire-project.json`,
- canonical object identity (`id` / aliases / slug),
- numeric sequence within each project,
- title and summary,
- object type and status,
- project (`research`),
- date,
- tags,
- authors/year/DOI/PDF metadata,
- evidence provenance (`source`),
- typed outgoing/incoming relationships,
- headings,
- body text,
- body Markdown links/backlinks,
- referenced local assets.

Do not hide critical identity, source, project, or relationship information only in prose if there is a canonical field or folder convention for it.

Do not create arbitrary frontmatter fields and expect them to be indexed. Extend the compiler/config/contract intentionally when a new structured concept is needed.

## 10. What agents should receive before editing an existing workspace

When possible, provide an agent with:

1. this contract,
2. root `AGENTS.md`,
3. `progress/AGENTS.md`,
4. `research-observer.config.json`,
5. the project-folder index including `.observaire-project.json` metadata when present,
6. the existing note index: filename + stable `id` + title + type + resolved research project,
7. the specific notes/evidence relevant to the task.

This is enough for an agent to avoid duplicate identities, broken relationship targets, wrong project IDs, and filename/order collisions.

If an external ChatGPT session cannot inspect the repository, it must not invent relationships to unknown existing targets. It may create relationships among files that it creates in the same output bundle because those identities are known.

## 11. Storage and import semantics

The source files under `progress/` are the durable record. Generated indexes under `public/_research/` are rebuildable and are not the source of truth.

When running Observaire with the repository `compose.yaml`, the host research directory is bind-mounted to `/app/progress`. Browser project imports therefore write through to the host directory rather than container-only storage.

The default host source directory is `./progress`. It can be changed with `OBSERVAIRE_RESEARCH_DIR` when starting Docker Compose.

A browser folder import is transactional:

1. files are staged under a temporary ignored directory;
2. path/type/size rules are checked;
3. the folder is promoted into `progress/` only as one project directory;
4. the compiler validates/indexes it;
5. compiler errors roll the imported folder back rather than leaving a half-registered project.

Existing project folders are never silently overwritten by browser import.

## 12. Minimum quality gate

Before considering research-content changes complete:

```bash
npm run doctor
```

For application/code changes:

```bash
npm run check
```

For release/deployment candidates:

```bash
npm run check:full
```

Fix invalid research content rather than weakening validation.
