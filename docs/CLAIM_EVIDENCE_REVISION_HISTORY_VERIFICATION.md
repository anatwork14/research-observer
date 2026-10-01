# Claim ↔ Evidence revision history — runtime verification

Use this checklist for the runtime/browser acceptance pass of `feature/claim-evidence-revision-history`.

The feature is read-only and derived. Verification must preserve these invariants:

- historical Claim state comes from committed manuscript Git snapshots only;
- committed `.observaire-ide.json` controls historical visibility at each revision;
- current dirty source and dirty visibility state are reported separately and never projected backward;
- Claim identity comes only from explicit `% observaire:claim <id>` markers;
- Claim↔Evidence history comes only from explicit `% observaire:claim-evidence <claim-id> <relation> <evidence-slug>` directives;
- no semantic meaning is inferred from prose, citations, dates, graph position, or AI output;
- Git revision sequence defines snapshot adjacency; commit timestamps are display metadata only;
- selected Base/Compare Evidence endpoints are validated against canonical research state at the exact same Git commit;
- current canonical Evidence state remains a separate present-day annotation and navigation state;
- incomplete historical research scans yield unavailable endpoint validation rather than false valid/missing results;
- arbitrary query-string commit values never become Git object/path reads.

## 1. Checkout and ancestry

Run in a clean isolated checkout/worktree.

```bash
git fetch origin
git checkout feature/claim-evidence-revision-history
git status --short
git rev-parse HEAD
git merge-base origin/main HEAD
git rev-list --left-right --count origin/main...HEAD
```

Expected before verification:

- clean worktree;
- merge base equals current `origin/main` used to create the feature branch;
- feature is behind `main` by `0`;
- do not rebase, squash, merge, reset, or force-push as part of verification.

If `main` moved after this checklist was written, report that fact and stop before integration decisions. Runtime verification may still run on the feature tip, but do not call it merge-ready against a changed base without re-evaluating ancestry.

## 2. Focused automated tests

Run:

```bash
node --test tests/manuscript-history.test.mjs
node --test tests/manuscript-evolution.test.mjs
node --test tests/manuscript-claim-history.test.mjs
node --test tests/manuscript-claim-history-order.test.mjs
node --test tests/manuscript-claim-history-ui.test.mjs
node --test tests/historical-research-evidence.test.mjs
```

These must cover at least:

- state-only revision opt-in;
- dirty `.observaire-ide.json` separated from dirty manuscript source files;
- state-only revision produces no fake manuscript edge;
- Claim added/removed;
- same-ID literal text change;
- exact one-to-one relation change;
- ambiguous multi-relation change remains explicit additions/removals;
- Evidence-target add/remove independent of relation-word changes;
- committed hidden-state changes;
- dirty working-tree Claim edits excluded;
- Git order preserved despite misleading timestamps;
- forged reused `history.projectPath` rejected;
- historical Evidence valid / wrong-type / missing across exact commits;
- historical folder-project precedence and cross-project result;
- duplicate historical canonical slug ambiguity;
- unsafe historical `progressDir` cannot escape the repository;
- incomplete historical research scan returns `unavailable`;
- Timeline-only historical loading;
- selected-pair-only historical Evidence validation;
- URL-backed Base/Compare/Claim controls;
- responsive static layout guards.

Then run the repository gate:

```bash
GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local
npm audit
npm audit --omit=dev
git diff --check
```

Record exact unit/workflow counts from the command output. Do not reuse counts from an older checkpoint.

## 3. Browser fixture

Use a disposable project fixture or restore the project exactly after testing.

Create a short committed history where manuscript and canonical research state change in the same repository.

### Revision A — valid historical Evidence

Canonical research contains exact same-project:

```yaml
id: evidence-robustness
type: evidence
research: <project>
```

Manuscript contains:

```tex
% observaire:claim robustness-under-drift
% observaire:claim-evidence robustness-under-drift supports evidence-robustness
Our method remains stable under distribution shift.
```

Keep a second `.tex` source hidden in committed `.observaire-ide.json`.

### Revision B — text/relation change + wrong-type historical endpoint

Change the same Claim ID literal passage and relation:

```tex
% observaire:claim robustness-under-drift
% observaire:claim-evidence robustness-under-drift qualifies evidence-robustness
Our method remains stable under stronger distribution shift.
```

At this same commit, change `evidence-robustness` canonical research object to another type such as:

```yaml
type: literature
```

Also unhide the second manuscript source, with a second explicit Claim inside it.

### Revision C — state-only manuscript visibility + missing historical endpoint

Change only manuscript `.observaire-ide.json` to hide the second source again, and remove the canonical `evidence-robustness` research object in the same commit if a separate research change is acceptable for the fixture. If you need a strictly manuscript-state-only commit for revision-list behavior, use a Revision C1 state-only commit and a Revision C2 endpoint-removal commit.

The verification must include at least one true state-only `.observaire-ide.json` commit with no `.tex` or research change.

### Working tree only

After committed revisions, make both:

- an uncommitted `.tex` Claim edit;
- an uncommitted `.observaire-ide.json` visibility change.

Neither working change may appear in historical committed snapshots.

## 4. Timeline history behavior

Open:

```text
/graph?research=<project>&view=timeline
```

Verify:

1. `Claim ↔ Evidence revision history` renders only in Timeline.
2. Summary shows bounded revisions scanned, historical Claim IDs, authored changes, and working changes.
3. Dirty source count and dirty visibility-state indication are distinct facts.
4. A true state-only visibility commit is present even though it changed no `.tex` bytes.
5. The state-only commit is labeled as a visibility-state change; it is not shown as a fake manuscript source edit.
6. The second Claim appears when its source is committed visible and leaves the next visible snapshot when the source is committed hidden.
7. The UI does not label that visibility-driven absence as source deletion.
8. `supports → qualifies` appears as one relation change for the same Claim/Evidence endpoints.
9. The same relation-word change does not also create an Evidence-target remove/add pair for the same endpoint.
10. Literal Claim text change is shown for the same explicit Claim ID.
11. Current uncommitted Claim text never appears in historical snapshots.
12. Current uncommitted visibility state never rewrites committed historical visibility.
13. Changing research endpoint validity does not remove or manufacture authored manuscript relation events.

## 5. Git-order regression

Create or use a fixture where commit author timestamps are intentionally non-monotonic while Git ancestry remains linear.

Verify:

- historical snapshot order follows the Git revision sequence;
- displayed timestamp values may look out of chronological order but do not reorder cards/transitions;
- the UI explicitly states that Git history defines revision order.

Do not sort the feature output manually by date during verification.

## 6. Base / Compare / Claim controls

Verify the URL-backed comparison form:

```text
claimBase=<loaded-full-sha>
claimCompare=<loaded-full-sha>
claimHistory=<optional-claim-id>
```

Checks:

- Base → Compare is directional;
- browser Back/Forward restores comparison state;
- reloading the URL restores the same selected pair/focus;
- Claim focus filters events and side-by-side Claim inspection only;
- Claim focus does not alter the underlying loaded snapshots;
- selecting two non-adjacent loaded revisions produces a direct factual snapshot comparison;
- identical Base/Compare produces zero explicit changes;
- invalid/unavailable `claimBase` or `claimCompare` falls back to the safe default loaded pair;
- raw query values are never sent to Git as manuscript or research object input;
- endpoint validation runs for the resolved Base/Compare snapshots, not the raw query SHA strings.

## 7. Same-commit historical Evidence endpoint validation

Verify all statuses using exact authored slugs.

### Historically valid

At Revision A, `evidence-robustness` must show as historically valid same-project Evidence.

If the slug is also current canonical Evidence today, it may link to:

```text
/progress/evidence-robustness
```

### Historically wrong type

At Revision B, where the same slug is `type: literature`, verify:

- status says historical target is not Evidence / wrong type;
- authored relation remains visible;
- there is no historical-validity upgrade from today's state;
- it is not linked to current `/progress/<slug>` merely because a current canonical Evidence object later exists.

### Historically missing

At the endpoint-removal revision, verify:

- status says historical target missing;
- authored slug remains visible;
- authored relation history remains intact.

### Historical cross-project

Create an exact slug that resolves at that commit only to another project.

Verify `cross-project`; do not accept it as same-project Evidence.

### Historical duplicate slug

Create two historical canonical objects with the same slug in the scanned commit.

Verify `ambiguous`; do not choose a winner.

### Incomplete validation

Use the focused service test or a disposable fixture that exceeds the bounded historical note read.

Verify the resolver reports `unavailable`, not `missing` or `valid` from a partial scan.

## 8. Historical vs current canonical separation

Exercise at least these two-dimensional cases where practical:

```text
historically valid + current canonical today
historically valid + not current canonical today
historically wrong-type/missing + current canonical today
```

Verify:

- historical state comes only from that selected Git commit;
- current state is clearly labeled as today/current canonical;
- current state never retroactively alters historical status;
- current navigation link appears only for historically valid + current canonical;
- unresolved historical status displays the authored slug rather than borrowing a title from an invalid current object.

## 9. Historical progressDir and project identity

The focused test covers unsafe path fallback. In browser/runtime fixture, also verify any non-default configured historical `progressDir` if practical.

For folder-backed research projects verify:

- historical `.observaire-project.json` project ID is honored;
- folder project ID takes precedence over conflicting note frontmatter;
- project rename is not inferred across commits; exact project identity is used at each endpoint check.

## 10. No historical deep-link confusion

Historical Claim file/section context may be shown as text.

Verify the history panel does **not** deep-link a historical line number into the current editor as though the old line still exists.

Current live Provenance deep links remain unchanged and should still use validated current file/line navigation.

## 11. Loading and performance boundaries

Verify each graph view separately.

### Research Graph

```text
/graph?research=<project>&view=research
```

Expected:

- no Claim-history panel;
- no historical Claim snapshot scan;
- no historical research Evidence index scan;
- no new history query controls.

### Provenance

```text
/graph?research=<project>&view=provenance
```

Expected:

- live Claim/Claim↔Evidence projection remains available;
- no historical Claim snapshot scan;
- no historical research Evidence index scan;
- existing provenance semantics unchanged.

### Timeline

Expected:

- existing manuscript revision scan is reused;
- historical Claim loader does not run a second `git log` for the same request;
- state-only revisions are included for Timeline history without turning `.observaire-ide.json` into a manuscript node;
- historical research endpoint indexes are built only for selected Base/Compare snapshots that have authored links;
- changing Claim focus alone does not cause validation of additional historical revisions;
- at most two distinct selected historical commit indexes are needed per rendered comparison.

Record a practical Timeline load/performance sanity observation for a normal fixture. Do not remove validation bounds merely to make a large fixture pass.

## 12. Responsive/browser matrix

Verify at minimum:

```text
390 × 844
768 × 1024
1024 × 768
1440 × 900 (or larger desktop)
```

At every size verify:

- no document-level horizontal overflow;
- summary cards wrap/stack cleanly;
- Base/Compare/Claim controls remain usable;
- coarse-pointer controls meet the existing 44 px interaction target;
- timeline event rows wrap long Claim IDs and Evidence slugs;
- side-by-side Claim comparison collapses to one column on narrow screens;
- long manuscript filenames, commit subjects, Claim IDs, Evidence slugs, and endpoint-status text do not widen the page;
- historical validity and current-canonical labels remain legible;
- browser console has no React hydration/render exceptions attributable to this feature.

## 13. Existing feature regression

Confirm this checkpoint does not break:

- Research Graph semantic/reference relationships;
- Provenance layer toggles;
- live explicit Claim nodes;
- live explicit Claim↔Evidence graph edges;
- Trace Health Claim/relationship issues;
- semantic research-version comparisons;
- manuscript revision timeline events;
- IDE Claim↔Evidence insertion;
- citation/prose non-inference rules.

A citation or strong prose statement without an explicit Claim↔Evidence directive must still create no authored semantic relationship.

## 14. Final report

Return this exact report shape:

1. branch tip verified
2. main tip during verification
3. merge base
4. ahead/behind
5. clean worktree before tests
6. focused manuscript-history tests
7. focused manuscript-evolution tests
8. focused Claim-history service tests
9. Git-order regression test
10. historical Evidence resolver tests
11. Claim-history UI/static test
12. `verify:merge-local`
13. unit test count
14. workflow test count
15. typecheck
16. lint
17. production build
18. full npm-audit critical count
19. production-only audit critical count
20. `git diff --check`
21. Revision A Claim behavior
22. Revision B text change
23. Revision B relation change
24. state-only visibility behavior
25. dirty `.tex` isolation
26. dirty visibility-state isolation
27. Git-order/browser ordering
28. Base/Compare URL persistence
29. Claim-focus behavior
30. invalid query SHA fallback
31. historically valid Evidence case
32. historical wrong-type case
33. historical missing case
34. historical cross-project case
35. historical duplicate/ambiguous case
36. incomplete-scan unavailable case
37. historical/current canonical separation
38. historical progressDir/project identity
39. no historical editor deep-link confusion
40. Research Graph loading boundary
41. Provenance loading boundary
42. Timeline history-scan reuse
43. selected-pair-only Evidence indexing
44. Timeline performance sanity
45. 390×844 result + `scrollWidth/clientWidth`
46. 768×1024 result + `scrollWidth/clientWidth`
47. 1024×768 result + `scrollWidth/clientWidth`
48. desktop result + `scrollWidth/clientWidth`
49. console result
50. unrelated regressions
51. defects fixed
52. blockers
53. existing unrelated warnings
54. merge-ready yes/no
55. exact final verified commit SHA
56. `progress.md` updated yes/no
57. nothing merged to `main`
58. nothing else changed

Do not merge this feature branch as part of verification. Integration is a separate explicit step after the report is reviewed.
