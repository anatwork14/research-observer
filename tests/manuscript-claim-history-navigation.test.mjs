import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Claim history chronology drill-down stays URL-backed and preserves selected comparison state", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /function historyHref/);
  assert.match(component, /Revision and Claim links update the same URL-backed comparison state/);
  assert.match(component, /compareCommit: transition\.toCommit/);
  assert.match(component, /claimId: event\.claimId/);
  assert.match(component, /baseCommit: base\?\.commit/);
  assert.match(component, /compareCommit: compare\?\.commit/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: transition\.toCommit/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: event/);
});

test("Claim evolution matrix contains horizontal width and keeps the Claim identity column visible", async () => {
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(css, /\.matrixPanel\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.matrixScroll\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.matrix\s*\{[^}]*width:\s*max\(100%, 1180px\)/s);
  assert.match(css, /\.matrix tr > :first-child\s*\{[^}]*position:\s*sticky[^}]*left:\s*0[^}]*z-index:\s*2/s);
  assert.match(css, /\.matrix thead tr > :first-child\s*\{[^}]*z-index:\s*3/s);
  assert.match(css, /\.matrix tbody tr > :first-child\s*\{[^}]*background:\s*var\(--surface-strong\)/s);
});

test("side-by-side Claim delta summaries reuse only explicit comparison events", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /function comparisonEventSummary\(events: ManuscriptClaimHistoryEvent\[\]\)/);
  assert.match(component, /EVENT_ORDER[\s\S]*events\.filter\(\(event\) => event\.type === type\)\.length/);
  assert.match(component, /const claimEvents = transitionEvents\(comparison\?\.events \|\| \[\], id\)/);
  assert.match(component, /comparisonEventSummary\(claimEvents\)/);
  assert.doesNotMatch(component, /comparisonEventSummary\([^)]*excerpt/);
  assert.doesNotMatch(component, /comparisonEventSummary\([^)]*citation/);
});
