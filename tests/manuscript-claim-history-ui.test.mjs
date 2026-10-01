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
  for (const param of ["claimBase", "claimCompare", "claimHistory"]) assert.match(page, new RegExp(`${param}\\?: string`));
  assert.match(component, /<form action="\/graph" method="get"/);
  assert.match(component, /name="research" value=\{projectId\}/);
  assert.match(component, /name="view" value="timeline"/);
  assert.match(component, /name="claimBase"/);
  assert.match(component, /name="claimCompare"/);
  assert.match(component, /name="claimHistory"/);
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
  assert.match(component, /slice\(0, 10\)/);
  assert.match(component, /changedClaimIds\(comparisonEvents\)\.slice\(0, 20\)/);
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

test("historical Evidence comparison validates only selected loaded snapshots and separates historical from current canonical state", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
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
});

test("Claim history responsive layout collapses compare grids without document-width assumptions", async () => {
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(css, /\.shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(css, /\.shell > \* \{ min-width: 0; max-width: 100%; \}/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.claimPair \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*min-height: 44px/);
});
