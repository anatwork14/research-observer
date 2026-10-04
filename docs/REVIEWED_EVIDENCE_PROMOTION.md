# Reviewed Consensus Evidence promotion

## Purpose

Research Assist may discover scholarly sources through Consensus, but discovery rank, abstracts, takeaways, and AI reasoning are not research truth. This workflow turns one user-reviewed Consensus result into one canonical `type: evidence` Markdown object only after an explicit preview and Apply step.

The workflow is intentionally separate from New Research scaffolding. Planning may preserve literature metadata without promoting it to Evidence. Evidence promotion happens only here or through the existing explicit local-PDF Evidence capture path.

## Review boundary

For each Consensus result the user may open **Review evidence**. The review contains:

- the canonical project where the Evidence note will be stored;
- the source identity and whether eligible full-text excerpts are present;
- an optional authored relation to the current canonical research note;
- an optional research comment;
- the exact Markdown filename and content that will be written;
- a SHA-256 proposal hash bound to the current compiler workspace signature.

Preview is read-only. Apply is a separate explicit action.

## Relationship semantics

The reviewed flow never infers semantic relationships from search ranking, query wording, abstracts, takeaways, citation counts, Codex output, or text similarity.

The only semantic relations this first workflow may author are:

- `supports`
- `contradicts`
- `answers`

The user must select the relation explicitly. Empty selection creates Evidence without a semantic edge.

`answers` is accepted only when the target canonical object is `type: question`.

The selected relation must already exist in `allowedRelationshipTypes`; the workflow never widens workspace vocabulary.

## Target and project placement

When Research Assist is opened from a canonical note, that note is the review target. Even when the user chooses no semantic relation, the reviewed Evidence is stored in that note's research project.

If no current target exists, the requested valid project is used; otherwise the default project is the fallback.

Browser-supplied paths are never accepted. The filename is derived server-side from the canonical project placement, current order, reviewed source identity, and review proposal.

## Source provenance

The Evidence note records canonical Consensus provenance already supported by the research compiler:

```yaml
source:
  kind: consensus
  url: https://...
  doi: 10....
  paper_id: ...
  query: ...
```

Available authors, year, journal, study type, and citation count may be preserved as source context.

Eligible full-text chunks returned by Consensus are clearly labelled as Evidence excerpts. When no eligible full-text excerpt exists, Consensus takeaway/abstract text is labelled **Discovery context**, not a verified quotation.

## Untrusted content

Consensus/result/query/comment text is treated as untrusted source data. The reviewed service rejects raw executable/embed payloads including script, iframe, object, embed, video, audio, and `javascript:` content before preview.

## Preview and stale safety

Preview returns:

- `workspaceSignature`
- `proposalHash`
- source identity
- target/project metadata
- exact Markdown file

Apply recompiles the current workspace and rejects the operation when:

- the workspace signature changed after preview (`EVIDENCE_REVIEW_STALE`);
- the exact proposal changed after review (`EVIDENCE_REVIEW_CHANGED`).

Changing relation, comment, source result, query, project, or current target invalidates the client-visible preview.

## Filesystem safety

Apply:

1. requires same-origin POST;
2. requires the normal local write policy (`RESEARCH_OBSERVER_WRITES=1` in production);
3. rebuilds the proposal server-side;
4. confines the destination to the compiler's configured research root;
5. refuses an existing target;
6. creates the file with exclusive `wx` semantics;
7. rebuilds canonical research artifacts;
8. removes the new file and rebuilds prior generated state if the new Evidence introduces compiler errors.

No annotation, manuscript, config, or unrelated research file is modified.

## UI contract

The default Consensus result action is **Review evidence**, not a one-click durable write.

The user sees:

- current target note;
- explicit relation selector;
- optional research comment;
- review-only/apply-enabled state;
- exact Markdown preview;
- proposal hash prefix;
- explicit Apply and Discard controls;
- canonical link after successful save.

The older evidence API remains available for compatible existing flows, but the Research Assist Consensus UI uses the review-first path.

## Non-goals

This workflow does not:

- automatically choose support/contradiction/answer semantics;
- score evidence strength or research quality;
- create claims from literature;
- merge duplicate scholarly sources automatically;
- mutate an existing Evidence note;
- give Codex or Consensus direct filesystem authority;
- auto-save search results;
- create background tasks or a second evidence database.
