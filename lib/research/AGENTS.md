# Research service agent contract

These instructions apply to implementation under `lib/research/` and complement the repository-root `AGENTS.md`.

For graph/timeline/version work, also read `docs/RESEARCH_EVOLUTION.md`. For explicit manuscript Claim work, also read `docs/MANUSCRIPT_CLAIMS.md`. For authored Claim↔Evidence semantics, also read `docs/CLAIM_EVIDENCE_RELATIONS.md`. For Claim↔Evidence analytics, also read `docs/CLAIM_EVIDENCE_AUDIT.md`. For committed historical Claim/Evidence evolution, also read `docs/CLAIM_EVIDENCE_REVISION_HISTORY.md`.

## Canonical-data boundary

- `progress/` remains the canonical indexed research source. Never create a second hand-maintained graph, timeline, citation, passage, claim, or version database.
- Evolution/provenance/timeline data are derived projections and must remain rebuildable from canonical research/manuscript/Git sources.
- Explicit manuscript Claim identity is authored in saved `.tex` comments; no separate Claim database is authoritative.
- Explicit Claim↔Evidence semantics are authored in saved `.tex` comments; no relationship sidecar/database is authoritative.
- Claim↔Evidence audit analytics are derived from the validated Claim projection plus canonical research objects; no audit database or score is authoritative.
- Historical Claim/Evidence evolution is derived from committed manuscript bytes and committed manuscript visibility state; no revision sidecar/database is authoritative.
- Generated `.research-observer/` and `public/_research/` data are never authoritative.

## Graph semantics

- Preserve the compiler distinction between explicit typed relationships and implicit Markdown references.
- Never infer `supports`, `contradicts`, `answers`, `based_on`, `supersedes`, `confirms`, or other semantic relationships from proximity, citation occurrence, manuscript passage text, explicit Claim presence, annotation type, metric direction, dates, or AI interpretation.
- Promoted annotation provenance may be reconstructed only from the durable promotion snapshot stored in canonical evidence content plus canonical evidence `source` metadata.
- Private annotation-sidecar changes after promotion must not silently rewrite historical evidence provenance.
- Canonical local PDF identity must use the compiler-visible asset path, including folder-backed project context. Two projects with `papers/source.pdf` must never collapse into one source node.
- Reviewed Consensus/external scholarly evidence may create a source-provenance node from already stored canonical identifiers only. Identity precedence is normalized DOI, then provider paper ID, then canonical HTTPS URL. Do not invent a paper identity or upgrade external evidence into a semantic relationship.

## Citation and passage projection

- Reuse `resolveLatexCitationTokens`; do not implement another bibliography-key resolver.
- Only one uniquely resolved canonical citation choice may create a research→citation graph edge.
- Ambiguous or missing citations remain unresolved. Never guess by key text, title similarity, nearby prose, or author/year heuristics outside the existing canonical resolver.
- Hidden manuscript sources stay out of the live citation and passage projection.
- Passage nodes are deterministic derived views over the same saved `.tex` content used for citation resolution. They are not durable manuscript entities and not semantic claims.
- Passage extraction may expose only source facts: file, offsets, line span, nearest explicit heading, and a bounded literal excerpt.
- Keep heading metadata separate from prose passage text when the heading precedes the cited paragraph. Ignore comment-only headings.
- Multiple citation occurrences in the same saved passage should deduplicate to one Passage node.
- Never summarize, paraphrase, classify, score, or semantically interpret passage text as part of this projection.

## Explicit manuscript Claims

- Claims are created only from a user-authored `% observaire:claim <id>` comment in saved visible editable `.tex` source.
- Claim IDs are lowercase kebab-case, at most 80 characters, project-scoped, and unique within the live manuscript projection. The reserved `claim-id` editor placeholder is invalid until replaced.
- A Claim anchor attaches to the next substantive saved prose passage. Blank/comment-only lines, stacked Claim markers, and standalone heading commands may be skipped when locating that passage.
- A valid unique Claim may exist without any citation. Do not invent a research/evidence edge for an uncited Claim.
- Citation and Claim projections must converge on the same deterministic Passage identity when they refer to the same saved block.
- Duplicate, invalid, and orphan anchors are health issues. Do not auto-rename, choose a duplicate winner, or manufacture a fallback target.
- Claim projection may create only structural provenance edges such as `anchors_claim` and `part_of` unless a separate valid explicit Claim↔Evidence directive exists.
- Claim presence or citation proximity never implies `supports`, `contradicts`, `confirms`, `answers`, or any other Claim↔Evidence semantic relation.
- Lightweight active-editor diagnostics may surface malformed/orphan Claim anchors, but project-wide duplicate detection belongs to the project-level projection.

## Explicit Claim ↔ Evidence relationships

- Create Claim↔Evidence semantics only from a saved `% observaire:claim-evidence <claim-id> <relation> <evidence-slug>` directive.
- The directive names both endpoints explicitly. Never resolve endpoints from proximity, current selection, citation key, title similarity, DOI, alias guessing, or nearby prose.
- Supported relationship types are deliberately limited to `supports`, `contradicts`, `contextualizes`, and `qualifies` until the contract is deliberately expanded.
- The Claim endpoint must resolve to one valid unique Claim in the selected manuscript project.
- The Evidence endpoint must resolve by exact canonical slug to a same-project canonical research object with `type: evidence`.
- Literature/citation candidates do not automatically qualify as Evidence for this semantic contract.
- A valid relationship produces one `claim-evidence` graph edge directed Evidence→Claim with the authored relationship type.
- Malformed, unresolved, cross-project, non-Evidence, or duplicate directives remain health issues. Do not create fallback semantic edges.
- Duplicate exact directives may collapse to one derived edge but must remain visible as duplicate health.
- Citation paths and Claim↔Evidence semantic edges are independent facts. Neither may manufacture the other.
- AI may draft a proposal in a future review workflow, but durable semantics still require an explicit saved/reviewed directive.

## Claim ↔ Evidence audit analytics

- Build audit analytics only from canonical research objects and the already-validated manuscript Claim projection. Do not parse `.tex` again or implement another relationship resolver inside analytics.
- `0 Evidence targets` means zero valid authored Claim↔Evidence directives for that Claim in saved visible manuscript source. It does not mean scientifically unsupported, false, low confidence, or uncited.
- Canonical Evidence with zero Claim links is an inventory observation, not an error.
- Do not create a composite quality, confidence, truth, readiness, credibility, or manuscript score from coverage counts.
- Distinct-Evidence coverage deduplicates canonical Evidence identity. Multiple authored relation types between the same Claim/Evidence pair count as one distinct Evidence target but multiple relationship edges.
- Metrics may count factual overlap such as Claims containing both explicit `supports` and `contradicts`; do not convert that overlap into an automatic verdict.
- Invalid, duplicate, unresolved, cross-project, or wrong-type relationship directives stay issues and must not contribute to valid coverage counts beyond the one deduplicated valid edge allowed by the projection contract.
- Multi-project audits remain project-scoped. Identical Claim IDs in different projects are separate identities.
- If a selected project has no available visible editable manuscript Claim projection, report that project as unavailable. Never display missing manuscript data as factual zero Claims.
- Preserve saved-source semantics: unsaved editor text and hidden sources remain outside the live audit until saved/restored.
- Other Insights views must not pay for Claim/manuscript scanning. Keep the audit loader lazy to `view=claims`.
- Underlying audit results may be complete while rendered lists/charts are bounded. Do not truncate service data merely to satisfy UI limits.

## Manuscript navigation

- Citation/Passage/Claim deep links may request a file and positive line in `/ide`.
- The IDE must honor a requested file only if the selected workspace reports it as editable and visible.
- Hidden, missing, resource, traversal, or unrelated-project paths must not be opened through provenance navigation.
- Reuse the workbench `openFile`/cursor mechanism already used by diagnostics and SyncTeX; do not automate DOM clicks or bypass stale-safe source reads.
- Cursor navigation must work after either textarea or CodeMirror adapters finish mounting.

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
- Use path-safe Git output. Renames, spaces, and non-ASCII source names must not silently disappear from history/status parsing.
- A Git repository with no `HEAD` yet still has valid working-tree state: report dirty/untracked manuscript files while returning zero committed revisions.
- Dirty/untracked manuscript files are working state, not revisions. Report them separately.
- If Git history is unavailable, degrade the revision layer without breaking research/citation/claim projections.
- State-only `.observaire-ide.json` commits are opt-in revision metadata. Never present the state file itself as a manuscript source or create a fake `revised_in` manuscript edge for it.

## Historical Claim ↔ Evidence revisions

- Historical Claim snapshots may read only committed project-confined `.tex` bytes plus the committed `.observaire-ide.json` visibility state for that exact Git revision.
- Reuse the existing Claim and Claim↔Evidence parsers. Do not implement a historical prose classifier or citation-to-Evidence inference path.
- Historical Claim IDs are exact authored IDs. Do not infer renames from text similarity, file moves, dates, or adjacency.
- A historical authored Claim↔Evidence directive records what the manuscript explicitly said at that commit. Current canonical Evidence resolution is an annotation only; it must not decide whether the historical authored directive existed.
- Do not claim historical same-project/type:evidence validation until historical canonical `progress/` state is reconstructed separately.
- `relation-changed` may be emitted only for exactly one removed and one added relation on the same exact Claim/Evidence endpoints. Ambiguous multi-relation changes remain additions/removals.
- Evidence-target add/remove operates on exact Claim/Evidence endpoint presence independently of relation words, so `supports → qualifies` alone does not remove/re-add the Evidence target.
- Committed visibility-state changes may add/remove Claims from the visible historical snapshot even when `.tex` bytes do not change; describe that as snapshot presence/absence, not automatic source deletion.
- Historical Claim scanning is Timeline-only in the first UI. Research Graph and Provenance must not pay for it.
- Reuse the Timeline page's already-loaded manuscript revision list rather than running a duplicate `git log` in the same request.
- Invalid `claimBase`/`claimCompare` query values must select only already-loaded snapshots or fall back to a safe default pair; never pass arbitrary query text to Git object reads.

## Timeline semantics

- Research-note `date` is a calendar date, not an instant. UI formatting must not shift it across days because of the viewer's timezone.
- Experiment-run and Git commit timestamps are real instants and may be localized for display.
- Never synthesize chronology from numeric filename order, mtimes, graph position, or IDE timestamps.

## Bounds

Keep expensive derived work bounded. Current contracts include:

- manuscript Git history: maximum 80 revisions;
- historical Claim snapshots: latest 40 relevant committed revisions;
- historical `.tex` read: maximum 2 MiB per source;
- historical events displayed per transition: 10;
- unfocused historical Claim comparisons displayed: 20 changed Claim IDs;
- research source diff: maximum 240 lines per side;
- project-scoped citation scanning: visible editable `.tex` files only;
- project-scoped Claim/Claim↔Evidence scanning: visible editable `.tex` files only;
- passage excerpt: bounded literal source text only;
- provenance UI: maximum 90 rendered nodes per lane before search/focus prioritization;
- selected provenance trace: maximum 7 hops in the UI (service helper accepts a bounded maximum of 12);
- Claim audit rendered rows: 80 Claims, 40 unlinked Evidence, 40 issues, and 12 Evidence-reach bars in the first UI pass.

Do not remove bounds to make one large fixture pass. The underlying derived projection remains complete even when the UI renders a bounded working set.

## Verification

For evolution and Claim-semantics work, run focused tests plus the repository gate:

```bash
node --test tests/research-evolution.test.mjs
node --test tests/research-evolution-consensus.test.mjs
node --test tests/research-evolution-trace.test.mjs
node --test tests/research-evolution-layout.test.mjs
node --test tests/research-evolution-passages.test.mjs
node --test tests/research-evolution-claims.test.mjs
node --test tests/manuscript-passages.test.mjs
node --test tests/manuscript-claims.test.mjs
node --test tests/manuscript-claim-projection.test.mjs
node --test tests/manuscript-claim-relations.test.mjs
node --test tests/manuscript-claim-relation-collision.test.mjs
node --test tests/manuscript-claim-evidence-projection.test.mjs
node --test tests/manuscript-claim-history.test.mjs
node --test tests/manuscript-claim-history-ui.test.mjs
node --test tests/claim-evidence-audit.test.mjs
node --test tests/claim-evidence-audit-loading.test.mjs
node --test tests/latex-claim-anchor-ui.test.mjs
node --test tests/latex-provenance-navigation.test.mjs
node --test tests/research-version-lineage.test.mjs
node --test tests/research-version-compare.test.mjs
node --test tests/manuscript-evolution.test.mjs
node --test tests/manuscript-history.test.mjs
GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local
git diff --check
```

Do not claim those checks passed unless they actually ran in a real checkout.
