# Claim ↔ Evidence revision history — runtime verification

Use this checklist for the first runtime/browser acceptance pass of `feature/claim-evidence-revision-history`.

The feature is read-only and derived. Verification must preserve these invariants:

- historical Claim state comes from committed manuscript Git snapshots only;
- committed `.observaire-ide.json` controls historical visibility at each revision;
- current dirty source and dirty visibility state are reported separately and never projected backward;
- Claim identity comes only from explicit `% observaire:claim <id>` markers;
- Claim↔Evidence history comes only from explicit `% observaire:claim-evidence <claim-id> <relation> <evidence-slug>` directives;
- no semantic meaning is inferred from prose, citations, dates, graph position, or AI output;
- Git revision sequence defines snapshot adjacency; commit timestamps are display metadata only;
- current canonical Evidence resolution is a present-day annotation, not historical endpoint validation;
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
- Timeline-only historical loading;
- URL-backed Base/Compare/Claim controls;
- responsive static layout guards.

Then run the repository gate:

```bash
GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local
git diff --check
```

Record exact unit/workflow counts from the command output. Do not reuse counts from an older checkpoint.

## 3. Browser fixture

Use a disposable project fixture or restore the project exactly after testing.

Create a short committed manuscript history with explicit Claim semantics. The minimum useful sequence is:

### Revision A — initial Claim

```tex
% observaire:claim robustness-under-drift
% observaire:claim-evidence robustness-under-drift supports evidence-robustness
Our method remains stable under distribution shift.
```

Keep a second `.tex` source hidden in committed `.observaire-ide.json`.

### Revision B — text and relation change

Change the same Claim ID literal passage text and replace exactly one relation:

```tex
% observaire:claim robustness-under-drift
% observaire:claim-evidence robustness-under-drift qualifies evidence-robustness
Our method remains stable under stronger distribution shift.
```

Also unhide the second source in committed `.observaire-ide.json`, with a second explicit Claim inside it.

### Revision C — state-only visibility commit

Change only `.observaire-ide.json` to hide the second source again. Do not modify `.tex` bytes.

### Working tree only

After Revision C, make both:

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
4. Revision C is present even though it changed only visibility state.
5. Revision C is labeled as a visibility-state change; it is not shown as a fake manuscript source edit.
6. The second Claim appears when its source is committed visible and leaves the next visible snapshot when the source is committed hidden.
7. The UI does not label that visibility-driven absence as source deletion.
8. `supports → qualifies` appears as one relation change for the same Claim/Evidence endpoints.
9. The same relation-word change does not also create an Evidence-target remove/add pair for the same endpoint.
10. Literal Claim text change is shown for the same explicit Claim ID.
11. Current uncommitted Claim text never appears in historical snapshots.
12. Current uncommitted visibility state never rewrites committed historical visibility.

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
- query values are never sent to Git as object/path input.

## 7. Historical Evidence display

Use both cases:

### Current canonical Evidence

A historical authored Evidence slug that currently resolves to same-project canonical `type:evidence` may link to `/progress/<slug>`.

### Not current canonical Evidence

Use a historical authored slug that now resolves to nothing, wrong type, or wrong project.

Verify:

- the literal historical authored slug remains visible;
- it is labeled `not current canonical Evidence`;
- the UI does not borrow a title from a current wrong-type/cross-project object;
- the historical directive is not deleted merely because current canonical resolution fails;
- the UI never claims that the target was historically valid canonical Evidence.

## 8. No historical deep-link confusion

Historical Claim file/section context may be shown as text.

Verify the history panel does **not** deep-link a historical line number into the current editor as though the old line still exists.

Current live Provenance deep links remain unchanged and should still use validated current file/line navigation.

## 9. Loading boundaries

Verify each graph view separately.

### Research Graph

```text
/graph?research=<project>&view=research
```

Expected:

- no Claim-history panel;
- no historical Claim snapshot scan;
- no new history query controls.

### Provenance

```text
/graph?research=<project>&view=provenance
```

Expected:

- live Claim/Claim↔Evidence projection remains available;
- no historical Claim snapshot scan;
- existing provenance semantics unchanged.

### Timeline

Expected:

- existing manuscript revision scan is reused;
- historical Claim loader does not run a second `git log` for the same request;
- state-only revisions are included for Timeline history without turning `.observaire-ide.json` into a manuscript node.

## 10. Responsive/browser matrix

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
- long manuscript filenames, commit subjects, Claim IDs, and Evidence slugs do not widen the page;
- current-canonical and historical-slug labels remain legible;
- browser console has no React hydration/render exceptions attributable to this feature.

## 11. Existing feature regression

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

## 12. Final report

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
10. Claim-history UI/static test
11. `verify:merge-local`
12. unit test count
13. workflow test count
14. typecheck
15. lint
16. production build
17. `git diff --check`
18. Revision A behavior
19. Revision B text change
20. Revision B relation change
21. Revision C state-only visibility behavior
22. dirty `.tex` isolation
23. dirty visibility-state isolation
24. Git-order/browser ordering
25. Base/Compare URL persistence
26. Claim-focus behavior
27. invalid query SHA fallback
28. current canonical Evidence case
29. non-current historical Evidence case
30. no historical editor deep-link confusion
31. Research Graph loading boundary
32. Provenance loading boundary
33. Timeline history-scan reuse
34. 390×844 result + `scrollWidth/clientWidth`
35. 768×1024 result + `scrollWidth/clientWidth`
36. 1024×768 result + `scrollWidth/clientWidth`
37. desktop result
38. console result
39. unrelated regressions
40. blockers
41. existing unrelated warnings
42. merge-ready yes/no
43. exact final verified commit SHA
44. nothing else changed

Do not merge this feature branch as part of verification. Integration is a separate explicit step after the report is reviewed.
