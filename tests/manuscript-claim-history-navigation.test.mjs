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
  assert.match(component, /evidenceSlug: event\.evidenceSlug/);
  assert.match(component, /eventType: selectedEvent/);
  assert.match(component, /relationType: selectedRelation/);
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
  assert.match(component, /focusedLinks\(base\.links, selectedEvidence, selectedRelation\)/);
  assert.match(component, /link\.evidenceSlug === evidenceSlug/);
  assert.doesNotMatch(component, /includes\(selectedEvidence\).*title/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit:.*selectedEvidence/);
});

test("event and relation filters normalize exact authored vocabulary and compose with Claim/Evidence focus", async () => {
  const page = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(page, /historyEvent\?: string/);
  assert.match(page, /historyRelation\?: string/);
  assert.match(page, /eventType=\{filters\.historyEvent\}/);
  assert.match(page, /relationType=\{filters\.historyRelation\}/);
  assert.match(component, /params\.set\("historyEvent", eventType\)/);
  assert.match(component, /params\.set\("historyRelation", relationType\)/);
  assert.match(component, /name="historyEvent"/);
  assert.match(component, /name="historyRelation"/);
  assert.match(component, /const selectedEvent = EVENT_ORDER\.find\(\(type\) => type === eventType\) \|\| ""/);
  assert.match(component, /const selectedRelation = MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS\.find\(\(relation\) => relation === relationType\) \|\| ""/);
  assert.match(component, /\(!eventType \|\| event\.type === eventType\)/);
  assert.match(component, /event\.relation === relationType \|\| event\.beforeRelation === relationType \|\| event\.afterRelation === relationType/);
  assert.match(component, /\(!relationType \|\| link\.relation === relationType\)/);
  assert.doesNotMatch(component, /eventMatchesRelation[\s\S]{0,240}excerpt/);
  assert.doesNotMatch(component, /eventMatchesRelation[\s\S]{0,240}citation/);
  assert.doesNotMatch(component, /eventMatchesRelation[\s\S]{0,240}currentCanonical/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit:.*selectedEvent/);
  assert.doesNotMatch(component, /loadHistoricalResearchEvidenceIndex\(\{ commit:.*selectedRelation/);
});

test("event-type filtering restricts unfocused matrix and compare rows to matching events", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /const focusedComparisonClaimIds = selectedEvent\s*\? changedClaimIds\(comparisonEvents\)\s*:\s*stateFocusedComparisonClaimIds/);
  assert.match(component, /const matrixDefaultIds = selectedEvent\s*\? matrixChangedIds\s*:/);
  assert.match(component, /const matrixChangedIds = changedClaimIds\(matrixTransitions\.flatMap\(\(transition\) => transitionEvents\(transition\.events, "", selectedEvidence, selectedEvent, selectedRelation\)\)\)/);
  assert.doesNotMatch(component, /selectedEvent\s*\?\s*matrixFocusedClaimIds/);
});

test("history filter chips remove one dimension at a time and preserve Base/Compare plus other filters", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(component, /aria-label="Active Claim and Evidence history filters"/);
  assert.match(component, /Claim: \{selectedClaim\} ×/);
  assert.match(component, /Evidence: \{selectedEvidence\} ×/);
  assert.match(component, /Event: \{EVENT_LABELS\[selectedEvent\]\} ×/);
  assert.match(component, /Relation: \{selectedRelation\} ×/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, claimId: undefined \}\)/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, evidenceSlug: undefined \}\)/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, eventType: undefined \}\)/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, relationType: undefined \}\)/);
  assert.match(component, /Clear filters/);
  assert.match(css, /\.focusBar\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.focusBar a:focus-visible/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*\.focusBar a/);
});

test("chronology Evidence details provide exact focus links without changing filters or selected revision pair", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(component, /event\.evidenceSlug === selectedEvidence \? styles\.eventEvidenceActiveLink : styles\.eventEvidenceLink/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, evidenceSlug: event\.evidenceSlug \}\)/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, claimId: event\.claimId \}\)/);
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
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, claimId: id, evidenceSlug: slug \}\)/);
  assert.match(component, /href=\{`\/progress\/\$\{encodeURIComponent\(link\.evidenceSlug\)\}`\}/);
  assert.doesNotMatch(component, /Focus Evidence:[\s\S]{0,100}\/progress\//);
});

test("expanded comparison form is responsive without compressing six selectors", async () => {
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(css, /\.form\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.form button \{ grid-column: span 3;/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.form \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}[\s\S]*\.form button \{ grid-column: span 2; \}/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.form \{ grid-template-columns: 1fr; \}[\s\S]*\.form button \{ grid-column: span 1; \}/);
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

test("side-by-side Claim delta summaries reuse only explicit filtered comparison events", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /function comparisonEventSummary\(events: ManuscriptClaimHistoryEvent\[\]\)/);
  assert.match(component, /EVENT_ORDER[\s\S]*events\.filter\(\(event\) => event\.type === type\)\.length/);
  assert.match(component, /const claimEvents = transitionEvents\(comparison\?\.events \|\| \[\], id, selectedEvidence, selectedEvent, selectedRelation\)/);
  assert.match(component, /comparisonEventSummary\(claimEvents\)/);
  assert.doesNotMatch(component, /comparisonEventSummary\([^)]*excerpt/);
  assert.doesNotMatch(component, /comparisonEventSummary\([^)]*citation/);
});
