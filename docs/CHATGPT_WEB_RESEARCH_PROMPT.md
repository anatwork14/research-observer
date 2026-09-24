# ChatGPT Web prompt for Observaire

Replace only the value inside `{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}`, then paste the whole prompt into ChatGPT on the web. When copied from Observaire's Instruction page, `{{WORKSPACE_CONFIG}}` is filled automatically from the current repository.

---

You are preparing a **directly importable research project folder** for **Observaire**, a Markdown-first research workspace.

My topic / idea / hypothesis is:

**{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}**

Your job is to turn that input into a rigorous, falsifiable, source-aware folder that I can recreate on disk and then drag into **Observaire → Projects** without editing a central project registry.

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
7. Do **not** create a `type: result` file unless an experiment/result actually happened and outcome data was supplied or independently verified.

## Observaire project-folder contract

Create exactly one new top-level research project folder.

Choose:

- a concise human-readable folder name derived from my topic;
- a stable lowercase kebab-case project ID;
- a concise project description that describes the research scope without claiming unverified findings.

The folder must contain a project manifest:

```json
{
  "schemaVersion": 1,
  "id": "stable-project-id",
  "label": "Human readable project label",
  "description": "Short research scope description"
}
```

Save that as:

```text
<Project Folder>/.observaire-project.json
```

Inside a folder-backed project, **do not add `research:` to note frontmatter**. Folder membership is the project scope.

Number the Markdown notes from `00_` upward inside this folder. Ordering is local to this project, so use a clean compact sequence such as:

```text
00_primary_question.md
01_main_hypothesis.md
02_research_method.md
03_first_experiment.md
04_research_map.md
```

The numeric filename prefix controls display order only. Each durable object still needs its own stable lowercase kebab-case `id`.

## Current workspace configuration

When this prompt is copied from Observaire, the following block is injected directly from `research-observer.config.json`. Treat it as authoritative for object/status/relationship/media vocabularies. Do not modify the configuration itself in this response.

```json
{{WORKSPACE_CONFIG}}
```

If that block still literally contains `{{WORKSPACE_CONFIG}}`, use the built-in vocabularies documented below and do not invent additional structured values.

When configuration is present:

- use only configured object types;
- use only configured statuses;
- use only configured relationship types;
- follow configured media rules when proposing local assets;
- do not require the new folder-backed project ID to already exist in `researchProjects`; the folder manifest registers it automatically.

## Canonical note frontmatter

Return research notes as complete Markdown files with YAML frontmatter.

Each durable research object should have a stable lowercase kebab-case `id`.

Built-in object types are:

`note`, `question`, `hypothesis`, `literature`, `method`, `dataset`, `evaluation`, `experiment`, `result`, `decision`, `milestone`, `evidence`

Built-in statuses are:

`idea`, `investigating`, `experimenting`, `validating`, `complete`, `blocked`, `archived`

Use only known fields. Canonical frontmatter fields are:

```yaml
---
id: stable-kebab-case-id
title: Human readable title
summary: One factual sentence.
type: question
status: investigating
date: YYYY-MM-DD
tags:
  - short-tag
relationships:
  - type: investigates
    target: another-stable-id
    note: Optional short explanation.
---
```

Optional fields include `aliases`, `authors`, `year`, `doi`, `pdf`, and `source`. `research` is intentionally omitted for this folder-backed project. Omit fields when they are unknown or do not apply. Do not output empty placeholder arrays/values merely to fill a schema.

### Identity

- project ID comes from `.observaire-project.json`;
- note `id` is canonical research-object identity and should survive filename/order changes;
- filenames are ordered presentation only;
- note IDs must be unique inside the generated bundle;
- do not encode temporary words such as `final`, `new`, or today's date into IDs unless they have real semantic meaning.

### Linking

There are two kinds of links.

**Readable Markdown references** use relative filenames inside the project folder:

```md
See the [main hypothesis](01_main_hypothesis.md).
```

**Semantic graph relationships** use stable IDs in frontmatter:

```yaml
relationships:
  - type: investigates
    target: main-hypothesis-id
```

Use only relationship types declared in the supplied workspace configuration. If no configuration was supplied, the built-in vocabulary is:

`supports`, `contradicts`, `answers`, `investigates`, `builds_on`, `produces`, `uses`, `based_on`, `derived_from`, `reproduces`, `supersedes`, `references`

Relationships may point to files you create in this same output bundle because their IDs are known. Do not invent relationships to unknown existing repository objects.

Edge direction matters. Examples:

- experiment `investigates` hypothesis/question;
- experiment may later `produce` a result, but do not create a nonexistent result target now;
- evidence `supports` or `contradicts` a hypothesis only after evidence review;
- decision `based_on` result/evidence;
- hypothesis-v2 `supersedes` hypothesis-v1 when both meaningful versions are intentionally preserved.

### Evidence

For verified local-PDF evidence, use a path relative to the note/project folder:

```yaml
source:
  kind: pdf
  pdf: papers/example.pdf
  page: 12
```

Only use that shape when the exact PDF and page are actually known and will be included in the project folder.

For an externally verified scholarly paper discovered through Consensus/another scholarly provider, use:

```yaml
source:
  kind: consensus
  url: https://verified-source.example/paper
  doi: verified-doi
  paper_id: provider-id
  query: search query that found it
```

At least one source identifier must be verified. Do not claim an abstract/takeaway is a full-text quotation. If the exact provider identity is not known, create a `type: literature` note with verified bibliographic metadata instead of fabricating a provider-specific evidence object.

## What to produce

Create a compact but useful starter folder. Do not generate unnecessary files just to make the output look large.

At minimum, produce:

1. `00_primary_question.md` — `type: question`;
2. `01_main_hypothesis.md` — `type: hypothesis`;
3. `02_research_method.md` — `type: method`;
4. `03_first_experiment.md` — `type: experiment`;
5. `04_research_map.md` — `type: note`, summarizing the structure and linking the generated files.

Add literature/evidence/dataset notes only when you actually have verified information for them.

For each hypothesis include:

- statement;
- rationale;
- falsification criterion;
- assumptions;
- evidence needed;
- evidence that would weaken it.

For each experiment include:

- question/hypothesis tested;
- setup;
- independent variables;
- dependent variables;
- controls;
- metrics;
- confounders;
- stopping criteria;
- interpretation rules for positive/negative/mixed results.

For every project that includes experiments, first search and reuse the existing project metric dictionary. Include an evaluation note with a structured `evaluationPlan` and canonical metric IDs, then reference it from each structured experiment using `experimentSpec.evaluationPlan`. Specify evaluation objective, dataset or measurement population where applicable, primary, secondary and guardrail metrics, metric direction, unit, aggregation, baseline, comparison plan, ablation factors, controlled variables, success criteria, and failure/regression criteria. Do not invent outcomes. Imported run measurements require provenance and preserve their original source files.

## Output format

First provide:

```text
PROJECT_FOLDER: <exact folder name>
PROJECT_ID: <exact lowercase-kebab-case id>
```

Then provide a short **Research architecture** table:

| Filename | Stable ID | Type | Purpose |
| --- | --- | --- | --- |

Then output the manifest first in this exact form:

```text
FILE: <Project Folder>/.observaire-project.json
```

followed immediately by one fenced `json` block containing the complete manifest.

Then output every Markdown file separately in this exact form:

```text
FILE: <Project Folder>/00_example.md
```

followed immediately by one fenced Markdown block containing the complete file contents.

Do not put commentary inside the file blocks unless it belongs in the research file itself.

After all files, provide:

### Import checklist

- repeat the exact project folder name and project ID;
- list all generated stable note IDs;
- list all generated relationships as `source --type--> target`;
- list every relative Markdown link as `source-file -> target-file`;
- identify anything that still needs verification;
- state explicitly whether you used live web research;
- confirm that no `research:` frontmatter is needed because this is a folder-backed project;
- confirm that the folder can be recreated exactly and imported through **Observaire → Projects → Import + index**.

Before finishing, internally check that:

- `.observaire-project.json` contains a valid lowercase kebab-case project ID;
- numbered filenames form one clean project-local sequence beginning at `00_`;
- every relationship target exists in the generated bundle;
- every relative Markdown note link points to a generated filename;
- note IDs are unique;
- no result is presented as if an experiment already happened;
- no citation/source field was invented;
- every hypothesis is falsifiable;
- evidence and interpretation are clearly separated;
- no note contains an unnecessary `research:` field;
- no arbitrary frontmatter field was added outside the documented Observaire fields.

Now build the directly importable Observaire research project folder for the topic / idea / hypothesis above.
