# Research service agent contract

These instructions apply to implementation under `lib/research/` and complement the repository-root `AGENTS.md`.

For graph/timeline/version work, also read `docs/RESEARCH_EVOLUTION.md`.

## Canonical-data boundary

- `progress/` remains the canonical indexed research source. Never create a second hand-maintained graph, timeline, citation, or version database.
- Evolution/provenance/timeline data are derived projections and must remain rebuildable from canonical research/manuscript/Git sources.
- Generated `.research-observer/` and `public/_research/` data are never authoritative.

## Graph semantics

- Preserve the compiler distinction between explicit typed relationships and implicit Markdown references.
- Never infer `supports`, `contradicts`, `answers`, `based_on`, `supersedes`, or other semantic relationships from proximity, citation occurrence, annotation type, metric direction, dates, or AI interpretation.
- Promoted annotation provenance may be reconstructed only from the durable promotion snapshot stored in canonical evidence content plus canonical evidence `source` metadata.
- Private annotation-sidecar changes after promotion must not silently rewrite historical evidence provenance.

## Citation projection

- Reuse `resolveLatexCitationTokens`; do not implement another bibliography-key resolver.
- Only one uniquely resolved canonical citation choice may create a research→citation graph edge.
- Ambiguous or missing citations remain unresolved. Never guess by key text, title similarity, or author/year heuristics outside the existing canonical resolver.
- Hidden manuscript sources stay out of the live citation projection.

## Semantic research versions

- A semantic version pair exists only through an explicit same-project `supersedes` relationship.
- Stored direction is newer→older; UI reading order is older→newer and must follow relationship topology.
- Dates/order may break ties between independent branches but cannot override relationship direction.
- Cross-project supersedes is excluded from semantic-version comparison.
- Cycles must remain visibly invalid rather than being linearized as a valid chain.
- Version diff is bounded and compares current canonical Markdown objects; do not describe it as historical Git reconstruction.

## Manuscript revisions

- Manuscript revision history may use real Git commits only. Do not use `.observaire-ide.json.updatedAt`, source mtimes, browser save timestamps, or build timestamps as revision events.
- Git history access is read-only, project-path confined, bounded, and must ignore potentially disruptive global Git configuration where practical.
- Dirty/untracked manuscript files are working state, not revisions. Report them separately.
- If Git history is unavailable, degrade the revision layer without breaking research/citation projections.

## Bounds

Keep expensive derived work bounded. Current contracts include:

- manuscript Git history: maximum 80 revisions;
- research source diff: maximum 240 lines per side;
- project-scoped citation scanning: visible editable `.tex` files only.

Do not remove bounds to make one large fixture pass.

## Verification

For evolution work, run focused tests plus the repository gate:

```bash
node --test tests/research-evolution.test.mjs
node --test tests/research-version-lineage.test.mjs
node --test tests/research-version-compare.test.mjs
node --test tests/manuscript-evolution.test.mjs
GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local
git diff --check
```

Do not claim those checks passed unless they actually ran in a real checkout.
