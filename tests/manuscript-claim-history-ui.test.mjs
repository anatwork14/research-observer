import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Claim revision history loads only on Timeline and reuses the existing manuscript history scan", async () => {
  const source = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  assert.match(source, /listManuscriptRevisions\(\{ projectId, includeStateChanges: view === "timeline" \}\)/);
  assert.match(source, /if \(view === "timeline" && historyResult\.status === "fulfilled"\)/);
  assert.match(source, /loadManuscriptClaimEvolution\(\{[\s\S]*history: manuscriptHistory/);
  assert.match(source, /view === "timeline" && \([\s\S]*<ManuscriptClaimHistory/);
  assert.doesNotMatch(source, /view === "provenance"[\s\S]{0,180}loadManuscriptClaimEvolution/);
});

test("Claim history comparison state is URL-backed and preserves the selected project", async () => {
  const page = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  for (const param of ["claimBase", "claimCompare", "claimHistory", "evidenceHistory", "historyEvent", "historyRelation", "historyChanged"]) {
    assert.match(page, new RegExp(`${param}\\?: string`));
  }
  assert.match(component, /<form action="\/graph" method="get"/);
  assert.match(component, /name="research" value=\{projectId\}/);
  assert.match(component, /name="view" value="timeline"/);
  assert.match(component, /name="claimBase"/);
  assert.match(component, /name="claimCompare"/);
  assert.match(component, /name="claimHistory"/);
  assert.match(component, /name="evidenceHistory"/);
  assert.match(component, /name="historyEvent"/);
  assert.match(component, /name="historyRelation"/);
});

test("Claim history UI keeps historical semantics factual, bounded, and working state separate", async () => {
  const page = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const service = await fs.readFile(path.join(root, "lib/research/manuscript-claim-history.mjs"), "utf8");
  assert.match(component, /Current dirty editor text is never projected backward/);
  assert.match(component, /no semantic relationship is inferred from prose or citations/);
  assert.match(component, /const workingChanges = dirtyFiles\.length \+ \(stateDirty \? 1 : 0\)/);
  assert.match(component, /Manuscript visibility state differs from the latest committed state/);
  assert.match(page, /stateDirty=\{manuscriptStateDirty\}/);
  assert.match(page, /manuscriptStateDirty = Boolean\(manuscriptHistory\.stateDirty\)/);
  assert.match(component, /events\.slice\(0, 10\)/);
  assert.match(component, /comparisonVisibleClaimIds\.slice\(0, 20\)/);
  assert.match(component, /bounded at 40/);
  assert.match(service, /const MAX_SNAPSHOTS = 40/);
  assert.match(service, /includeStateChanges: true/);
  assert.match(service, /currentCanonical: Boolean/);
});

test("Claim history chronology follows Git revision order rather than authored timestamps", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const service = await fs.readFile(path.join(root, "lib/research/manuscript-claim-history.mjs"), "utf8");
  assert.match(component, /Revision order follows Git history; displayed timestamps are commit metadata and do not reorder snapshots/);
  assert.match(service, /snapshots: newestFirstSnapshots\.reverse\(\)/);
  assert.doesNotMatch(service, /snapshots\.slice\(\)\.sort/);
});

test("chronology revision, Claim, Evidence, and summary drill-down reuse safe URL-backed loaded-snapshot state", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /compareCommit: transition\.toCommit/);
  assert.match(component, /claimId: event\.claimId/);
  assert.match(component, /evidenceSlug: event\.evidenceSlug/);
  assert.match(component, /eventType: type/);
  assert.match(component, /relationType: relation/);
  assert.match(component, /transition\.toCommit === compare\?\.commit \? styles\.matrixActiveLink : styles\.matrixLink/);
  assert.match(component, /event\.claimId === selectedClaim \? styles\.matrixActiveLink : styles\.matrixLink/);
  assert.match(component, /className=\{styles\.matrixCellLink\}/);
  assert.match(component, /baseCommit: pairBase\?\.commit/);
  assert.match(component, /compareCommit: pairCompare\?\.commit/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: transition\.toCommit/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: event/);
});

test("historical Evidence comparison validates only selected loaded snapshots and separates historical from current canonical state", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const resolver = await fs.readFile(path.join(root, "lib/research/historical-research-evidence.mjs"), "utf8");
  assert.match(component, /const base = snapshots\.find\(\(snapshot\) => snapshot\.commit === baseCommit\) \|\| previous/);
  assert.match(component, /const compare = snapshots\.find\(\(snapshot\) => snapshot\.commit === compareCommit\) \|\| latest/);
  assert.match(component, /const validationCommits = \[\.\.\.new Set\(\[base, compare\]/);
  assert.match(component, /loadHistoricalResearchEvidenceIndex\(\{ commit, projectId \}\)/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: baseCommit/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: compareCommit/);
  assert.match(component, /resolveHistoricalEvidenceSlug\(historicalIndex, link\.evidenceSlug, \{ projectId \}\)/);
  assert.match(component, /historically valid Evidence · current canonical/);
  assert.match(component, /historical target missing/);
  assert.match(component, /historical target ambiguous/);
  assert.match(component, /historical target belongs to project/);
  assert.match(component, /historical target type/);
  assert.match(component, /historical endpoint validation unavailable/);
  assert.match(component, /resolution\.status === "valid" && link\.currentCanonical/);
  assert.match(component, /current canonical exists today/);
  assert.match(component, /not current canonical today/);
  assert.match(component, /Historical endpoints: \{endpointSummary\(base/);
  assert.match(component, /Historical endpoints: \{endpointSummary\(compare/);
  assert.match(component, /const ENDPOINT_STATUS_ORDER/);
  assert.match(resolver, /const MAX_NOTES = 1000/);
  assert.match(resolver, /const MAX_NOTE_BYTES = 2 \* 1024 \* 1024/);
  assert.match(resolver, /const MAX_PARALLEL_READS = 8/);
  assert.match(resolver, /const MAX_INDEX_CACHE = 12/);
  assert.match(resolver, /if \(!index\?\.available \|\| !index\?\.complete\)/);
});

test("multi-revision Claim matrix stays bounded, URL-backed, and never expands historical Evidence validation beyond Base/Compare", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(component, /const matrixSnapshots = snapshots\.slice\(-12\)/);
  assert.match(component, /const matrixClaimIds = selectedClaim \? \[selectedClaim\] : matrixDefaultIds\.slice\(0, 20\)/);
  assert.match(component, /function historyHref/);
  assert.match(component, /params\.set\("claimBase", baseCommit\)/);
  assert.match(component, /params\.set\("claimCompare", compareCommit\)/);
  assert.match(component, /params\.set\("claimHistory", claimId\)/);
  assert.match(component, /compareCommit: snapshot\.commit/);
  assert.match(component, /claimId: id/);
  assert.match(component, /Claim evolution matrix/);
  assert.match(component, /Matrix-only revisions do not trigger historical research endpoint scans/);
  assert.match(component, /matrixEventSummary\(events\)/);
  assert.match(component, /\$\{links\.length\} \$\{\(selectedEvidence \|\| selectedRelation\) \? "focused" : "authored"\} link\$\{links\.length === 1 \? "" : "s"\}/);
  assert.match(css, /\.matrixScroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.matrix\s*\{[^}]*width:\s*max\(100%, 1180px\)/s);
  assert.match(css, /\.matrixLink:focus-visible/);
  assert.match(css, /\.matrixActiveLink/);
  assert.match(css, /\.matrixChanged/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*\.matrixLink,[\s\S]*\.matrixActiveLink/);
});

test("side-by-side Claim rows are bounded, changed-first, and collapse unchanged state without altering the event model", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(component, /const allComparisonChangedFirst = \[/);
  assert.match(component, /const comparisonVisibleClaimIds = selectedChangedOnly/);
  assert.match(component, /comparisonVisibleClaimIds\.slice\(0, 20\)/);
  assert.match(component, /<details className=\{`\$\{styles\.claimCompare\} \$\{deltaClass\}`\} open=\{deltaKind !== "unchanged"\}/);
  assert.match(component, /deltaKind = !before && after \? "added" : before && !after \? "removed" : claimEvents\.length \? "changed" : "unchanged"/);
  assert.match(css, /\.claimCompare > summary/);
  assert.match(css, /\.claimUnchanged/);
  assert.match(css, /\.claimAdded/);
  assert.match(css, /\.claimRemoved/);
  assert.match(css, /\.claimChanged/);
  assert.doesNotMatch(component, /excerpt.*similar/i);
});

test("Claim history responsive layout collapses compare grids without document-width assumptions", async () => {
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(css, /\.shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(css, /\.shell > \* \{ min-width: 0; max-width: 100%; \}/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.claimPair \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*min-height: 44px/);
});
