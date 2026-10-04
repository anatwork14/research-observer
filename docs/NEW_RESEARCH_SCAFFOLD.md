# New Research reviewed scaffold

The New Research workflow is deliberately split into four trust stages:

1. **Define** — the user states a topic/question and optional objective.
2. **Consensus** — external scholarly results are discovery material only.
3. **Codex** — a local, read-only model proposes gaps, falsifiable hypotheses, experiments, next actions, and cautions from the selected packet.
4. **Review + apply** — Observaire deterministically converts the reviewed plan into an exact Markdown proposal. Nothing is written until the user explicitly applies that exact proposal.

This document defines Stage 04.

## Core boundary

The scaffold service is deterministic application code, not an AI write path.

Codex does not receive filesystem write permission. The browser cannot submit arbitrary Markdown for Apply. Instead, Preview and Apply both send the structured plan plus target project information to the server. Apply rebuilds the scaffold from the same deterministic service and compares:

- the exact canonical research `workspaceSignature` captured at Preview time; and
- a SHA-256 `proposalHash` over the target, project manifest, filenames, and generated Markdown.

If either changes, Apply fails and requires a new Preview/review cycle.

## What the first scaffold creates

A reviewed scaffold contains:

- one primary `question` note;
- one ordinary `note` preserving the reviewed plan and selected-literature trace;
- up to eight `hypothesis` notes;
- up to eight `experiment` notes.

The service does **not** create:

- `evidence` objects;
- `supports` relationships;
- `contradicts` relationships;
- `answers` relationships;
- experiment results;
- measurements;
- datasets;
- citations that were not already present in the reviewed planning packet.

Consensus takeaways, abstracts, citation counts, ranking, semantic relevance, or source selection are not upgraded into proof.

## Planning relationships

The scaffold may create only two planning relationships in this first pass:

- `hypothesis --derived_from--> reviewed plan note`;
- `experiment --investigates--> matching hypothesis`.

Even these are emitted only when the current workspace vocabulary already allows the relationship type. The scaffold never widens `allowedRelationshipTypes` automatically.

If a proposed experiment names a hypothesis that does not exactly match a scaffolded hypothesis title, no typed relationship is guessed. The generated experiment text explicitly asks for manual review/linking.

## Existing project target

For an existing project:

- the target must resolve to an existing canonical project;
- generated note order starts after the highest current order in that project;
- folder-backed projects receive files inside their existing project folder;
- configured root-level projects receive `research` frontmatter when required;
- no existing file may be overwritten.

## New project target

For a new project:

- the user supplies a project label and optional description;
- the server derives a confined folder name and a stable kebab-case project ID;
- project-ID and folder collisions are rejected;
- a schema-v1 `.observaire-project.json` manifest is previewed and applied together with the notes;
- no path supplied by the browser is accepted as a filesystem destination.

## Content safety

All structured plan input is bounded and normalized server-side.

The scaffold rejects raw executable/embed content matching the same class of disallowed research-note payloads used by direct note creation, including script/iframe/object/embed/video/audio HTML and `javascript:` content.

Source URLs included in the selected-literature trace must already be HTTPS. DOI/provider IDs are preserved only as supplied by the reviewed plan packet.

## Atomicity and rollback

Apply performs a full preflight before creating files:

- current workspace signature still matches Preview;
- rebuilt proposal hash still matches Preview;
- target paths remain confined under the configured research root;
- target files do not exist;
- a new project folder does not already exist.

Files are created with exclusive-write semantics. After writing, the canonical compiler regenerates research artifacts. New compiler errors introduced by the scaffold cause rollback of every scaffold-created source file. Existing unrelated compiler errors are not silently reclassified as scaffold failures.

For a new project, rollback also removes the newly created project directory. Generated research artifacts are rebuilt best-effort after rollback.

## UI contract

Stage 04 must expose:

- target mode: new project or existing project;
- project destination metadata;
- exact manifest content for a new project;
- every exact Markdown file and path;
- every typed relationship proposed by the deterministic scaffold;
- summary counts for hypotheses and experiments;
- an explicit statement that zero Evidence objects and zero semantic Evidence relationships are being created;
- a separate **Apply reviewed scaffold** action;
- stale/change errors that remove the old review state and require a fresh preview.

Changing the topic, objective, plan, target mode, selected project, or new-project metadata invalidates the currently displayed preview by input identity. The UI derives this state rather than synchronously resetting state from an effect.

## Environment gate

Preview is read-only and may remain available when source writes are disabled.

Apply follows the local write policy:

```text
RESEARCH_OBSERVER_WRITES=1
```

or a non-production runtime.

No cloud service or remote agent is required.

## Verification

At minimum, verify:

```bash
npm ci
npm run doctor
npm test
node --test tests/new-research-scaffold.test.mjs
node --test tests/new-research-scaffold-safety.test.mjs
npm run typecheck
npm run lint
npm run build
npm run check:full
```

Browser QA must cover new-project and existing-project Preview, exact source expansion, explicit Apply, stale rejection, disabled-write Preview, responsive widths, keyboard/focus behavior, and successful navigation to created notes.

Durable source hashes outside intentionally created scaffold files must remain unchanged.
