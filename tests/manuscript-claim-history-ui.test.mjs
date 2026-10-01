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

test("Claim history UI keeps historical semantics factual, bounded, and dirty state separate", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const service = await fs.readFile(path.join(root, "lib/research/manuscript-claim-history.mjs"), "utf8");
  assert.match(component, /Current dirty editor text is never projected backward/);
  assert.match(component, /no semantic relationship is inferred from prose or citations/);
  assert.match(component, /slice\(0, 10\)/);
  assert.match(component, /changedClaimIds\(comparisonEvents\)\.slice\(0, 20\)/);
  assert.match(component, /bounded at 40/);
  assert.match(service, /const MAX_SNAPSHOTS = 40/);
  assert.match(service, /includeStateChanges: true/);
  assert.match(service, /currentCanonical: Boolean/);
});

test("historical Evidence display distinguishes authored historical slugs from current canonical Evidence", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /link\.currentCanonical \? \(/);
  assert.match(component, /not current canonical Evidence/);
  assert.match(component, /\/progress\/\$\{encodeURIComponent\(link\.evidenceSlug\)\}/);
});

test("Claim history responsive layout collapses compare grids without document-width assumptions", async () => {
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(css, /\.shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(css, /\.shell > \* \{ min-width: 0; max-width: 100%; \}/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.claimPair \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*min-height: 44px/);
});
