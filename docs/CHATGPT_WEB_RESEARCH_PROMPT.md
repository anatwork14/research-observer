# ChatGPT Web prompt for Observaire

Replace only the value inside `{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}`, then paste the whole prompt into ChatGPT on the web.

---

You are preparing a research starter pack for **Observaire**, a Markdown-first research workspace.

My topic / idea / hypothesis is:

**{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}**

Your job is to turn that input into a rigorous, falsifiable, source-aware research structure that can be imported into Observaire with minimal cleanup.

## Non-negotiable research rules

1. Never fabricate citations, authors, DOI values, URLs, dates, page numbers, datasets, sample sizes, measurements, quotes, statistical results, or experimental outcomes.
2. Clearly separate:
   - known evidence,
   - interpretation,
   - hypothesis,
   - uncertainty,
   - planned work.
3. If web browsing is available, use reliable primary/peer-reviewed sources where appropriate and preserve exact source metadata. If browsing is not available or a fact cannot be verified, write `Needs verification` in prose and omit unverifiable metadata fields.
4. A search result, abstract, takeaway, popularity metric, semantic score, or citation count is not by itself proof of a claim.
5. Do not create strong semantic relationships such as `supports` or `contradicts` unless the relevant evidence has actually been reviewed and the relationship is justified.
6. Design hypotheses to be falsifiable. Design experiments to test or falsify them rather than to confirm a desired conclusion.

## Observaire data contract

Return research notes as complete Markdown files with YAML frontmatter.

Each durable research object should have a stable lowercase kebab-case `id`.

Supported object types:

`note`, `question`, `hypothesis`, `literature`, `method`, `dataset`, `experiment`, `result`, `decision`, `milestone`, `evidence`

Supported statuses:

`idea`, `investigating`, `experimenting`, `validating`, `complete`, `blocked`, `archived`

Use only known fields. Canonical frontmatter fields are:

```yaml
---
id: stable-kebab-case-id
title: Human readable title
summary: One factual sentence.
type: question
status: investigating
research: default
date: YYYY-MM-DD
tags:
  - short-tag
aliases: []
authors: []
year: 2026
doi: verified-doi-only
pdf: papers/local-file.pdf
relationships:
  - type: investigates
    target: another-stable-id
    note: Optional short explanation.
source:
  kind: pdf
  pdf: papers/local-file.pdf
  page: 12
---
```

Omit optional fields when unknown. Do not output empty placeholder metadata merely to fill the schema.

### Identity

- `id` is canonical identity and should survive filename/order changes.
- filenames are ordered presentation only.
- use descriptive filenames such as `01_primary_question.md`.
- because you cannot inspect my existing repository, choose a self-contained temporary sequence beginning at `80_` for this generated bundle. I can renumber filenames later without changing IDs.

### Linking

There are two kinds of links:

**Readable Markdown references** use relative filenames:

```md
See the [primary question](80_primary_question.md).
```

**Semantic graph relationships** use frontmatter:

```yaml
relationships:
  - type: investigates
    target: primary-question-id
```

Allowed relationship types:

`supports`, `contradicts`, `answers`, `investigates`, `builds_on`, `produces`, `uses`, `based_on`, `derived_from`, `reproduces`, `supersedes`, `references`

Relationships may point to files you create in this same response because their IDs are known. Do not invent links to unknown existing repository objects.

Edge direction matters. Examples:

- experiment `investigates` hypothesis/question
- experiment `produces` result
- evidence `supports` or `contradicts` hypothesis only after evidence review
- decision `based_on` result/evidence
- hypothesis-v2 `supersedes` hypothesis-v1

### Evidence

For verified local-PDF evidence, use:

```yaml
source:
  kind: pdf
  pdf: papers/example.pdf
  page: 12
```

For an externally verified scholarly paper, use:

```yaml
source:
  kind: consensus
  url: https://verified-source.example/paper
  doi: verified-doi
  paper_id: provider-id
  query: search query that found it
```

Do not claim an abstract/takeaway is a full-text quotation.

## What to produce

Create a compact but useful starter bundle. Do not generate unnecessary files just to make the output look large.

At minimum, produce:

1. **Primary research question** — `type: question`
2. **Main falsifiable hypothesis** — `type: hypothesis`
3. **Research method / evidence plan** — `type: method`
4. **First experiment or evaluation plan** — `type: experiment`
5. **Research map** — `type: note`, summarizing the structure and linking the generated files

Add literature/evidence/dataset notes only when you actually have verified information for them.

For each hypothesis include:

- statement,
- rationale,
- falsification criterion,
- assumptions,
- evidence needed,
- evidence that would weaken it.

For each experiment include:

- question/hypothesis tested,
- setup,
- independent variables,
- dependent variables,
- controls,
- metrics,
- confounders,
- stopping criteria,
- interpretation rules for positive/negative/mixed results.

## Output format

First provide a short **Research architecture** table:

| Filename | Stable ID | Type | Purpose |
| --- | --- | --- | --- |

Then output every file separately in this exact form:

```text
FILE: progress/80_example.md
```

followed immediately by one fenced Markdown block containing the complete file contents.

Do not put commentary inside the Markdown file blocks unless it belongs in the research note itself.

After all files, provide:

### Import checklist

- list all generated stable IDs,
- list all generated relationships as `source --type--> target`,
- identify anything that still needs verification,
- identify any filenames that may need renumbering after insertion into an existing Observaire repository,
- state explicitly whether you used live web research.

Before finishing, internally check that:

- every relationship target exists in the generated bundle,
- every relative Markdown note link points to a generated filename,
- IDs are unique,
- no result is presented as if an experiment already happened,
- no citation/source field was invented,
- every hypothesis is falsifiable,
- evidence and interpretation are clearly separated.

Now build the Observaire starter research bundle for the topic / idea / hypothesis above.
