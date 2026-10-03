# Claim ↔ Evidence revision history

Observaire's Claim/Evidence revision history is a **read-only derived projection over committed Git snapshots**. It answers factual questions about how explicitly authored manuscript state changed across commits. It does not infer meaning from prose, citations, dates, or AI interpretation.

Read this document together with:

- `docs/MANUSCRIPT_CLAIMS.md`
- `docs/CLAIM_EVIDENCE_RELATIONS.md`
- `docs/CLAIM_EVIDENCE_AUDIT.md`
- `docs/RESEARCH_EVOLUTION.md`

## Source boundary

Historical Claim state may use only:

1. actual Git commits returned by the manuscript history service;
2. committed `.tex` bytes inside the selected manuscript project;
3. the committed `.observaire-ide.json` visibility state for that revision, when present;
4. the existing Claim and Claim↔Evidence directive parsers.

For a selected Base/Compare pair, historical Evidence endpoint validation may additionally read the canonical research files under the **same Git commit**. It must use the historical configured `progressDir`, historical project-folder manifests, stable note IDs/fallback slugs, exact project identity, and exact `type: evidence` state from that commit.

Current editor buffers, dirty working-tree bytes, filesystem mtimes, IDE save timestamps, build timestamps, current hidden-state choices, and current research-object type/project state must not rewrite historical snapshots.

Dirty manuscript files may be reported as current working state, but they are not revision snapshots.

## Historical visibility

A committed `.observaire-ide.json` state controls which `.tex` files participate in that revision's historical Claim snapshot.

If a commit changes only manuscript visibility state, Claim-history may include that commit even when no `.tex` bytes changed. The ordinary manuscript revision graph keeps state-only history opt-in so the state file is never presented as a manuscript source file.

A Claim that leaves the visible snapshot because its source became hidden is recorded factually as absent from the next visible authored snapshot. Do not label that as deletion unless source history separately establishes deletion.

## Historical Claim identity

Claim identity remains the explicit authored ID:

```tex
% observaire:claim robustness-under-drift
```

For the same Claim ID across two snapshots, the projection may report factual changes such as:

- Claim appeared in the visible authored snapshot;
- Claim left the visible authored snapshot;
- literal bounded Claim passage text changed;
- file or section location changed.

Do not infer that one removed Claim ID was renamed into another added Claim ID. A changed ID is represented as removal plus addition unless a future explicit rename contract is introduced.

Duplicate or malformed Claim IDs remain historical snapshot issues rather than being auto-repaired.

## Historical Claim ↔ Evidence directives

Historical links are reconstructed from explicit committed directives:

```tex
% observaire:claim-evidence <claim-id> <relation> <evidence-slug>
```

Supported authored relation words remain exactly:

```text
supports
contradicts
contextualizes
qualifies
```

A historical snapshot records the exact syntactically valid directive attached to a valid unique Claim ID in that snapshot. The directive remains part of authored history regardless of whether its Evidence slug validates.

## Same-commit historical Evidence validation

For the selected Base and Compare snapshots only, the side-by-side view may validate each authored Evidence slug against the canonical research tree at that **same commit**.

The resolution states are factual and exact:

```text
valid
missing
ambiguous
cross-project
wrong-type
unavailable
```

`valid` requires all of the following at the selected Git commit:

- exact canonical slug match;
- exactly one matching research object;
- the same selected research project identity;
- exact `type: evidence`.

Do not use aliases, title similarity, DOI identity, citation keys, current research state, or prose to upgrade an endpoint.

### Historical project and slug rules

Historical validation mirrors the canonical compiler rules that determine endpoint identity:

- use the historical `research-observer.config.json` `progressDir` when it is path-safe;
- unsafe/malformed historical `progressDir` falls back to repository-local `progress` rather than escaping the repository;
- historical `.observaire-project.json` controls a folder project's ID when valid;
- folder project identity takes precedence over a note's `research` frontmatter;
- a valid stable note `id` is the canonical slug;
- without a stable ID, root-note fallback is its file slug and folder-project fallback is `<project-id>-<file-slug>`.

If the same canonical slug resolves to multiple historical objects, the status is `ambiguous`; do not choose a winner.

### Bounded/incomplete scans

Historical research validation is bounded. If a selected historical research tree cannot be scanned completely—for example because a note exceeds the historical read bound or the note-count bound is exceeded—the resolver returns `unavailable` for endpoint checks from that index.

A partial index must never be used to claim either:

- “this slug was historically valid Evidence”, or
- “this slug was historically missing”.

This avoids false certainty from incomplete historical data.

### Current canonical state is separate

Historical validity and current canonical validity are separate dimensions.

Examples:

```text
historically valid + current canonical
historically valid + not current canonical today
historically wrong type + current canonical today
historically missing + current canonical today
```

A current `/progress/<slug>` link is shown only when the endpoint was historically valid same-project Evidence for that selected snapshot **and** the slug is current canonical Evidence today.

Current canonical state must never retroactively decide whether the historical authored directive existed or whether it was valid at that commit.

## Adjacent-revision events

Snapshot adjacency follows the bounded Git revision sequence returned by the manuscript history service. The loader reverses that newest-first sequence once for oldest→newest reading. Commit timestamps are displayed metadata only: author dates may be equal or skewed and must never reorder snapshot adjacency.

Adjacent historical snapshots may produce only factual events derived from explicit manuscript state:

```text
claim-added
claim-removed
claim-text-changed
claim-moved
evidence-target-added
evidence-target-removed
relation-added
relation-removed
relation-changed
```

Historical endpoint validation does not create or delete these authored manuscript events. It annotates selected comparison endpoints separately.

### Relation change rule

A direct relation transformation such as:

```text
supports → qualifies
```

may be reported only when the same exact `<claim-id, evidence-slug>` endpoints have:

- exactly one removed relation type; and
- exactly one added relation type

between the two compared snapshots.

If multiple relation types disappear and/or appear for the same endpoints, do not guess pairings. Report the explicit additions and removals separately.

Changing only the relation word does not mean the Evidence target itself disappeared. Evidence-target add/remove events operate on exact `<claim-id, evidence-slug>` endpoint presence independent of relation type.

## Arbitrary revision comparison

The UI may compare any two loaded committed snapshots with a directional **Base → Compare** contract.

Comparison state is URL-backed:

```text
claimBase=<full-commit-sha>
claimCompare=<full-commit-sha>
claimHistory=<optional-claim-id>
evidenceHistory=<optional-authored-evidence-slug>
```

`claimHistory` and `evidenceHistory` are view filters only. They must not change or regenerate the historical snapshots.

Evidence focus is an exact authored-slug filter over the already-loaded historical manuscript snapshots. It is not a canonical-research lookup and does not itself assert that the slug was historically valid Evidence. The selected Base/Compare endpoint validator separately determines `valid`, `missing`, `wrong-type`, `cross-project`, `ambiguous`, or `unavailable` for that same authored slug.

Claim focus and Evidence focus combine with strict AND semantics. When Evidence focus is active:

- chronology includes only explicit events whose `evidenceSlug` exactly matches;
- Claim text/move/add/remove events without an Evidence endpoint are not promoted into Evidence-related events;
- matrix rows are Claims that explicitly link to that slug within the displayed revision window, plus Claims with matching explicit endpoint events;
- matrix cells report only authored links to that exact slug;
- side-by-side link sets are narrowed to that exact authored slug.

Invalid or unavailable Claim/Evidence focus values normalize to no corresponding focus rather than title/alias/fuzzy matching.

Invalid or unavailable commit query values fall back to the default recent pair rather than causing arbitrary Git object access. Historical Evidence validation is invoked only after Base and Compare have resolved to commit SHAs from the already-loaded bounded snapshot list. Raw query-string commit text must never become a Git object/path read.

## UI semantics

The first UI lives under `/graph?view=timeline` and complements:

- the global research/manuscript timeline;
- semantic research-version comparison;
- existing provenance views.

The history panel should show:

- bounded committed revisions scanned;
- unique historical Claim IDs;
- factual authored transition count;
- current dirty manuscript-file count and dirty visibility-state indicator, clearly excluded from history;
- Git-sequenced adjacent-revision events with commit timestamps shown as metadata;
- Base/Compare/Claim/Evidence controls;
- a bounded multi-revision Claim matrix with URL-backed revision and Claim drill-down;
- side-by-side literal Claim text and explicit relation sets;
- factual per-Claim delta summaries derived only from explicit comparison events;
- same-commit historical Evidence endpoint status for selected Base/Compare relations;
- current canonical availability as a separate present-day annotation/navigation state.

Do not deep-link a historical Claim line into the current editor as if the historical line number necessarily still existed.

## Bounds

Historical work is intentionally bounded:

- manuscript Git history service: maximum 80 revisions;
- Claim historical snapshots: latest 40 relevant revisions;
- historical `.tex` read: maximum 2 MiB per source;
- historical research endpoint index: maximum 1,000 ordered Markdown notes per selected revision;
- historical research note read: maximum 2 MiB per note;
- historical research endpoint indexes: selected Base and Compare revisions only;
- event rows displayed per transition: 10;
- unfocused side-by-side matching Claims: 20;
- multi-revision matrix: latest 12 loaded snapshots × at most 20 Claim rows.

The underlying loaded Claim snapshot may contain more Claims/events than the UI displays. Disclose bounded presentation instead of silently implying completeness.

## Loading boundary

Claim revision history is Timeline-only in the first implementation.

- Research Graph must not load historical Claim snapshots or historical Evidence endpoint indexes.
- Provenance must not load historical Claim snapshots or historical Evidence endpoint indexes.
- Timeline may reuse its already-loaded manuscript revision history so it does not run a duplicate `git log` merely for Claim history.
- Historical Evidence endpoint indexing runs only for selected Base/Compare snapshots that contain authored Evidence links, not for all 40 historical Claim snapshots.
- Changing Claim or Evidence focus filters must not broaden historical research indexing beyond the resolved Base/Compare pair.

An unavailable historical Claim scan or historical Evidence scan must fail soft without breaking the canonical research timeline or removing authored manuscript history.

## Non-inference rules

Historical revision events and endpoint validation must never infer:

- support/contradiction from prose wording;
- Evidence use from citation proximity;
- Claim rename from textual similarity;
- relation transformation from ambiguous many-to-many relation changes;
- chronology from authored timestamps, mtimes, filename order, graph position, or IDE timestamps;
- historical endpoint validity from current canonical research state;
- historical endpoint identity from title/DOI/citation similarity;
- Evidence-focus matches from title, alias, DOI, citation key, or substring similarity.

## Verification

Focused verification should include:

- Claim added/removed;
- same-ID literal text change;
- Claim file/section move;
- exact one-to-one relation change;
- ambiguous multi-relation change remains additions/removals;
- Evidence target add/remove independent of relation-word change;
- Git revision order preserved even with misleading author timestamps;
- committed hidden-state changes, including state-only commits;
- dirty working-tree Claim edits excluded;
- dirty visibility-state changes reported separately from source files;
- historical Evidence valid at one commit, wrong-type at another, and missing at another;
- historical cross-project and duplicate-slug ambiguity;
- historical custom/unsafe `progressDir` behavior;
- incomplete historical research scan yields `unavailable`, not false missing/valid;
- current-canonical state remains separate from historical validity;
- Timeline-only loading and reuse of the existing manuscript history scan;
- selected-pair-only historical Evidence indexing;
- URL-backed Base/Compare/Claim/Evidence controls;
- exact Evidence focus, invalid Evidence focus normalization, and Claim+Evidence AND behavior;
- Evidence focus does not turn Claim text/move events into Evidence events;
- Evidence focus does not trigger additional historical research indexes beyond Base/Compare;
- matrix revision/Claim URL drill-down, bounds, sticky Claim column, and internal horizontal containment;
- invalid comparison SHAs cannot trigger arbitrary Git reads;
- responsive comparison/timeline layout without document-level overflow.

Do not claim browser/runtime verification until it runs in a real checkout.