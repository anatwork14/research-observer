# Claim ↔ Evidence audit analytics

The Claims view in `/insights` is a **derived audit over explicit saved manuscript semantics**. It does not create, repair, rank, or infer Claim↔Evidence relationships.

Read this document together with:

- `docs/MANUSCRIPT_CLAIMS.md`
- `docs/CLAIM_EVIDENCE_RELATIONS.md`
- `docs/RESEARCH_EVOLUTION.md`

## Source boundary

The audit may use only:

1. canonical research objects from the research compiler;
2. the validated manuscript Claim projection;
3. explicit valid `claim-evidence` edges already derived from saved visible editable `.tex` source.

It must not independently parse manuscript semantics or implement a second relationship resolver.

The audit is rebuildable. It creates no durable database, sidecar, score, or cache that becomes authoritative.

## Meaning of coverage

In this view, **coverage means authored relationship coverage inside Observaire**.

For example:

```text
0 Evidence targets
```

means:

> No valid saved `% observaire:claim-evidence ...` directive currently links this explicit Claim to a canonical Evidence object in the selected project.

It does **not** mean:

- the Claim is scientifically unsupported;
- the Claim is false;
- no citation exists;
- no relevant literature exists;
- AI found no support;
- the manuscript is incomplete.

Likewise, canonical Evidence with `0 Claims` means only that no explicit manuscript Claim currently targets it through the authored semantic contract. It is an inventory observation, not an error or quality defect.

## No composite quality score

Do not collapse Claim coverage into a research-quality, confidence, truth, credibility, readiness, or manuscript score.

Useful factual metrics include:

- valid explicit Claim count;
- Claims with zero, one, or multiple distinct Evidence targets;
- authored relationship count by exact relation type;
- Claims containing both explicit `supports` and `contradicts` relationships;
- Evidence linked to one or multiple distinct Claims;
- canonical Evidence with no authored Claim link;
- project-level counts;
- malformed/unresolved relationship issues already reported by the projection.

These measurements may be visualized, filtered, and compared. Their interpretation remains with the researcher.

## Distinct Evidence vs relationship count

A Claim may explicitly author more than one relationship to the same Evidence object:

```tex
% observaire:claim-evidence result-a supports evidence-a
% observaire:claim-evidence result-a qualifies evidence-a
```

This produces:

```text
1 distinct Evidence target
2 authored relationships
```

Coverage-by-target must therefore deduplicate canonical Evidence identity while relationship-mix metrics count the authored edges separately.

## Relationship vocabulary

The audit reflects only the current explicit vocabulary:

```text
supports
contradicts
contextualizes
qualifies
```

Do not normalize unsupported words into these categories.

Do not infer a relationship category from prose, citation text, annotation labels, result direction, or AI interpretation.

## Multi-project behavior

The Claims view reuses the same `/insights` research-project scope.

For each selected project:

- scan only that project's visible editable manuscript `.tex` sources through the existing Claim projection;
- resolve Claim↔Evidence endpoints using the canonical project-scoped contract;
- keep matching Claim IDs and Evidence-like names isolated across projects;
- show a project with no available manuscript scan as **unavailable**, not as zero Claims.

Aggregate charts include only projects whose Claim projection is available. The UI must identify unavailable projects separately.

## Valid and invalid relationships

Only valid projected `layer=claim-evidence` edges contribute to coverage metrics.

The following remain issues and must not increase valid counts:

- malformed directives;
- unsupported relation types;
- unresolved Claim endpoints;
- duplicate/invalid Claim anchors;
- missing Evidence targets;
- cross-project Evidence targets;
- non-Evidence research targets;
- duplicate exact directives beyond their one deduplicated valid edge.

Projection issues should remain inspectable with project/file/line/endpoints where available.

## Saved-source semantics

The audit inherits the Claim projection's saved-source boundary:

- unsaved editor changes are absent;
- hidden sources are absent;
- saving/reloading rebuilds current derived state;
- restoring a hidden source returns its Claims/relationships;
- there is no stale hand-maintained coverage record.

## Performance

The Claims view may scan selected manuscript projects because it explicitly requests manuscript analytics.

The other Insights views — Overview, Analytics, Timeline, and Versions — must not pay for Claim/manuscript scanning merely to render.

UI lists should remain bounded even if the underlying audit result is complete. Current first-pass bounds are:

- Claim audit rows: 80;
- unlinked Evidence rows: 40;
- issue rows: 40;
- Evidence-reach chart: 12.

Do not truncate the underlying service data to satisfy these UI bounds.

## UI language

Prefer:

- `With authored Evidence`
- `No authored Evidence link`
- `Distinct Evidence targets`
- `Authored semantic links`
- `Evidence reach across Claims`
- `Audit issues`

Avoid labels that imply automatic evaluation, such as:

- `unsupported Claim`
- `weak Claim`
- `bad Evidence`
- `confidence score`
- `truth score`
- `quality score`

unless a future explicit human-reviewed contract defines such concepts.

## Verification

Focused service tests should verify at minimum:

- 0 / 1 / 2+ distinct Evidence target bands;
- two relation types to one Evidence count as one distinct target and two relationships;
- support + contradiction overlap is counted factually;
- Evidence reuse counts distinct Claims;
- invalid relationship issues do not enter valid coverage;
- prose/citations alone do not create coverage;
- unavailable manuscript projects are labeled unavailable rather than zero;
- multi-project isolation;
- project scope changes the audit consistently.

Browser verification should confirm:

- `/insights?view=claims` loads the audit;
- other Insights tabs do not trigger manuscript Claim scanning;
- project-scope controls update Claim analytics;
- Claim/Evidence links navigate to the expected canonical surfaces;
- large lists remain bounded and usable;
- mobile/tablet layouts have no document-level horizontal overflow;
- unavailable projects are clearly separated from factual zero counts.
