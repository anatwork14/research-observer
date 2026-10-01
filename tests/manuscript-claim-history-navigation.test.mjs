import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Claim history chronology drill-down stays URL-backed and preserves selected comparison state", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /function historyHref/);
  assert.match(component, /compareCommit: transition\.toCommit/);
  assert.match(component, /claimId: event\.claimId/);
  assert.match(component, /evidenceSlug: selectedEvidence/);
  assert.match(component, /baseCommit: base\?\.commit/);
  assert.match(component, /compareCommit: compare\?\.commit/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: transition\.toCommit/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit: event/);
});

test("Evidence history focus is explicit, exact, URL-backed, and intersects Claim focus", async () => {
  const page = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(page, /evidenceHistory\?: string/);
  assert.match(page, /evidenceSlug=\{filters\.evidenceHistory\}/);
  assert.match(component, /params\.set\("evidenceHistory", evidenceSlug\)/);
  assert.match(component, /name="evidenceHistory"/);
  assert.match(component, /const evidenceSlugs = \[\.\.\.new Set\(snapshots\.flatMap/);
  assert.match(component, /const selectedEvidence = evidenceSlugs\.includes\(evidenceSlug\) \? evidenceSlug : ""/);
  assert.match(component, /\(!claimId \|\| event\.claimId === claimId\)[\s\S]*\(!evidenceSlug \|\| event\.evidenceSlug === evidenceSlug\)/);
  assert.match(component, /transitionEvents\(comparison\.events, selectedClaim, selectedEvidence\)/);
  assert.match(component, /link\.evidenceSlug === selectedEvidence/);
  assert.doesNotMatch(component, /includes\(selectedEvidence\).*title/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit:.*selectedEvidence/);
});

test("history focus chips remove one dimension at a time and preserve Base/Compare", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(component, /aria-label="Active Claim and Evidence history focus"/);
  assert.match(component, /Claim: \{selectedClaim\} ×/);
  assert.match(component, /Evidence: \{selectedEvidence\} ×/);
  assert.match(component, /historyHref\(\{ projectId, baseCommit: base\?\.commit, compareCommit: compare\?\.commit, evidenceSlug: selectedEvidence \}\)/);
  assert.match(component, /historyHref\(\{ projectId, baseCommit: base\?\.commit, compareCommit: compare\?\.commit, claimId: selectedClaim \}\)/);
  assert.match(component, /className=\{styles\.clearFocus\} href=\{historyHref\(\{ projectId, baseCommit: base\?\.commit, compareCommit: compare\?\.commit \}\)\}/);
  assert.match(css, /\.focusBar\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.focusBar a:focus-visible/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*\.focusBar a/);
});

test("chronology Evidence details provide exact focus links without changing the selected revision pair", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(component, /event\.evidenceSlug === selectedEvidence \? styles\.eventEvidenceActiveLink : styles\.eventEvidenceLink/);
  assert.match(component, /evidenceSlug: event\.evidenceSlug/);
  assert.match(component, /baseCommit: base\?\.commit/);
  assert.match(component, /compareCommit: compare\?\.commit/);
  assert.match(component, /claimId: selectedClaim/);
  assert.match(css, /\.eventEvidenceLink:focus-visible/);
  assert.match(css, /\.eventEvidenceActiveLink/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*\.eventEvidenceLink,[\s\S]*\.eventEvidenceActiveLink \{ min-height: 44px; \}/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.eventEvidenceLink,[\s\S]*\.eventEvidenceActiveLink \{ grid-column: 1 \/ -1; \}/);
});

test("Base and Compare endpoint cards focus authored Evidence history independently from canonical navigation", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /const beforeEvidenceSlugs = \[\.\.\.new Set\(beforeLinks\.map\(\(link\) => link\.evidenceSlug\)\)\]/);
  assert.match(component, /const afterEvidenceSlugs = \[\.\.\.new Set\(afterLinks\.map\(\(link\) => link\.evidenceSlug\)\)\]/);
  assert.match(component, /aria-label=\{`Base Evidence history focus for \$\{id\}`\}/);
  assert.match(component, /aria-label=\{`Compare Evidence history focus for \$\{id\}`\}/);
  assert.match(component, /Focus Evidence: \{slug\}/);
  assert.match(component, /baseCommit: base\.commit, compareCommit: compare\.commit, claimId: id, evidenceSlug: slug/);
  assert.match(component, /href=\{`\/progress\/\$\{encodeURIComponent\(link\.evidenceSlug\)\}`\}/);
  assert.doesNotMatch(component, /Focus Evidence:[\s\S]{0,100}\/progress\//);
});

test("Claim evolution matrix contains horizontal width and keeps the Claim identity column visible", async () => {
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(css, /\.matrixPanel\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.matrixScroll\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.matrix\s*\{[^}]*width:\s*max\(100%, 1180px\)/s);
  assert.match(css, /\.matrix tr > :first-child\s*\{[^}]*position:\s*sticky[^}]*left:\s*0[^}]*z-index:\s*2/s);
  assert.match(css, /\.matrix thead tr > :first-child\s*\{[^}]*z-index:\s*3/s);
  assert.match(css, /\.matrix tbody tr > :first-child\s*\{[^}]*background:\s*var\(--surface-strong\)/s);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) auto/);
});

test("side-by-side Claim delta summaries reuse only explicit comparison events", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /function comparisonEventSummary\(events: ManuscriptClaimHistoryEvent\[\]\)/);
  assert.match(component, /EVENT_ORDER[\s\S]*events\.filter\(\(event\) => event\.type === type\)\.length/);
  assert.match(component, /const claimEvents = transitionEvents\(comparison\?\.events \|\| \[\], id, selectedEvidence\)/);
  assert.match(component, /comparisonEventSummary\(claimEvents\)/);
  assert.doesNotMatch(component, /comparisonEventSummary\([^)]*excerpt/);
  assert.doesNotMatch(component, /comparisonEventSummary\([^)]*citation/);
});
