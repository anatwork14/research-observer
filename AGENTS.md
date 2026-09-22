# AI Authoring Instructions for Research Observer

This file is the authoritative authoring contract for AI agents that create or edit files in `progress/`.

## Core rule

Research Observer uses plain Markdown as the source of truth. Do not create a separate database, JavaScript registry, or generated metadata file by hand.

A research note must be stored directly in `progress/` and its filename must begin with a numeric order:

```text
00_start_here.md
01_research_question.md
02_first_experiment.md
10_final_evaluation.md
```

The numeric prefix controls sequence only. It is not the stable identity of the research object.

## Required behavior for AI-generated notes

AI-generated notes SHOULD include frontmatter with a stable `id`. Never change an existing `id` merely because a file is renamed or reordered.

Use lowercase kebab-case IDs:

```yaml
id: retrieval-experiment-v2
```

Good IDs:

- `retrieval-question-main`
- `reranking-experiment-v2`
- `dataset-msmarco`
- `decision-use-cross-encoder`

Bad IDs:

- `Experiment 4`
- `03_experiment`
- `final!!!`

## Recommended frontmatter

Use only fields that are known. Do not invent dates, sources, results, measurements, authors, or status.

```yaml
---
id: reranking-experiment-v2
title: Reranking experiment v2
summary: Tests whether reranking improves recall under a fixed latency budget.
type: experiment
status: validating
date: 2026-09-22
tags:
  - retrieval
  - reranking
aliases:
  - reranking-v2
---
```

### Field rules

- `id`: stable lowercase kebab-case identifier. Strongly recommended for AI-generated notes.
- `title`: concise human-readable title.
- `summary`: one factual sentence describing the purpose or finding.
- `type`: use a value from `research-observer.config.json`.
- `status`: use a value from `research-observer.config.json`.
- `date`: ISO date only: `YYYY-MM-DD`. Omit it if unknown.
- `tags`: YAML list of short lowercase labels.
- `aliases`: optional old IDs/slugs that should continue resolving after a rename.
- `pdf`: optional local PDF companion path relative to the note, normally `papers/paper-name.pdf`.
- `authors`: optional YAML list of verified author names for a literature note.
- `year`: optional four-digit publication year.
- `doi`: optional verified DOI. Never infer or fabricate one.

For a literature note with a local paper, prefer:

```yaml
type: literature
pdf: papers/smith-2026.pdf
authors:
  - Jane Smith
  - Wei Chen
year: 2026
doi: 10.xxxx/verified-doi
```

Do not add arbitrary frontmatter keys unless the repository rules are intentionally being extended.

## Markdown body rules

Start the body with one H1 matching the note topic:

```md
# Reranking experiment v2
```

Use H2/H3 headings to organize substantial sections. Do not skip heading levels merely for visual styling.

Prefer a research structure appropriate to the note. An experiment often uses:

```md
## Question
## Setup
## Method
## Results
## Interpretation
## Limitations
## Next steps
```

A literature note may instead use:

```md
## Research question
## Source
## Key claims
## Evidence
## Limitations
## Relevance
```

Do not force every note into the same template.

## Linking research notes

Link to another note by its Markdown filename, using a relative Markdown link:

```md
See [the baseline experiment](02_baseline_experiment.md).
```

Do not manually construct `/progress/...` URLs inside research Markdown. Research Observer resolves note identities and aliases.

When linking to a section:

```md
See [failure analysis](05_evaluation.md#failure-analysis).
```

Never create a Markdown link to a note that does not exist. The local doctor treats unresolved internal links as errors. If future work is only planned, mention the planned note as plain text or inline code until the target file exists.

## Figures and research media

Store local research assets inside `progress/`, normally under `progress/figures/`, `progress/data/`, or another descriptive subfolder.

Reference them with relative paths:

```md
![Recall by latency budget](figures/recall-by-latency.svg)
```

Captions/alt text must describe the information in the figure, not merely say "figure" or "image".

For PDF/video/audio research media, use the same Markdown image syntax because Research Observer upgrades supported extensions into the appropriate viewer:

```md
![System diagram](figures/system-diagram.pdf)
![Experiment recording](media/demo.mp4)
![Interview audio](media/interview-01.wav)
```

Do not use absolute local filesystem paths such as `/Users/name/...`, `C:\\...`, or `file://...`.

Remote research media should use `https://` only.

## Math

KaTeX math is supported:

```md
Inline: $E = mc^2$

$$
\operatorname{score}(x) = \frac{1}{1 + e^{-x}}
$$
```

## Sources and citations

Never fabricate citations, DOIs, URLs, quotations, measurements, or experimental outcomes.

Use ordinary Markdown links for sources when citation tooling is not otherwise specified:

```md
[Paper title](https://doi.org/...)
```

When evidence is uncertain, state the uncertainty in the note.

## Raw HTML and executable content

Do not add raw HTML, embedded scripts, `javascript:` links, iframe embeds, or executable browser code to research Markdown.

Use Markdown and supported media formats instead.

## Ordering and filenames

Before creating a new note, inspect existing files and choose the intended sequence number.

Use descriptive filenames:

```text
06_latency_ablation.md
```

rather than:

```text
06_new.md
06_stuff.md
```

Renaming/reordering a note must preserve its existing stable `id`.

## Before considering a note complete

Run:

```bash
npm run doctor
```

For repository changes, run:

```bash
npm run check
```

For a release/deployment candidate, run:

```bash
npm run check:full
```

GitHub Actions are intentionally not assumed by this project. These checks are designed to run locally or in whatever deployment environment is available.

## Minimal compliant AI-generated note

```md
---
id: retrieval-question-main
title: Retrieval quality under a latency constraint
summary: Defines the primary research question for retrieval quality under a fixed serving budget.
type: question
status: investigating
date: 2026-09-22
tags:
  - retrieval
  - latency
---

# Retrieval quality under a latency constraint

## Question

How much recall can be gained without exceeding the serving latency budget?

## Current evidence

No result is claimed yet.

## Next steps

Run the [baseline experiment](02_baseline_experiment.md) and record both retrieval quality and end-to-end latency.
```

If a requested note cannot comply with these rules because required facts or target files are unknown, omit uncertain metadata and explicitly mark unresolved facts instead of inventing them.


## Verification delegation for coding agents

When an agent has normal package-registry access, a local browser, or a deployment sandbox, it SHOULD help close verification gaps rather than merely report that another agent could do so.

For full application verification, follow the repository skill:

```text
.agents/skills/verify-research-observer/SKILL.md
```

Key rules:

- GitHub Actions are **not** part of the verification plan.
- Verify the exact branch/commit requested; report the commit SHA before running tests.
- Do not weaken TypeScript, ESLint, compiler diagnostics, security guards, or tests to obtain a passing result.
- Do not replace pinned dependencies with older versions merely to make installation easier.
- A failing check is evidence to diagnose and fix, not something to bypass.
- Keep verification-generated state uncommitted unless the task explicitly requires a lockfile or a real source fix.
- For Codex Act testing, never use valuable uncommitted research content as a disposable fixture.
- Report exact commands, Node/npm versions, exit codes, relevant error output, routes tested, browser-console errors, and any files changed.
- If verification discovers a source bug, fix it on the current feature branch, rerun the failed gate, and clearly distinguish the original failure from the post-fix result.
