import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("changed-only comparison mode is exact, URL-backed, and routed only to Timeline history", async () => {
  const page = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");

  assert.match(page, /historyChanged\?: string/);
  assert.match(page, /changedMode=\{filters\.historyChanged\}/);
  assert.match(component, /const selectedChangedOnly = changedMode === "only"/);
  assert.match(component, /params\.set\("historyChanged", "only"\)/);
  assert.match(component, /changedOnly\?: boolean/);
  assert.doesNotMatch(component, /changedMode\.includes/);
  assert.doesNotMatch(component, /changedMode\.toLowerCase/);
});

test("changed-only mode composes with exact semantic filters and focused Claim rows cannot bypass them", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");

  assert.match(component, /const comparisonChangedClaimIds = changedClaimIds\(comparisonEvents\)/);
  assert.match(component, /const comparisonVisibleClaimIds = selectedChangedOnly\s*\? comparisonCandidateClaimIds\.filter\(\(id\) => changedSet\.has\(id\)\)\s*:\s*comparisonCandidateClaimIds/);
  assert.match(component, /const compareClaimIds = selectedClaim\s*\? \(comparisonVisibleClaimIds\.includes\(selectedClaim\) \? \[selectedClaim\] : \[\]\)/);
  assert.doesNotMatch(component, /const compareClaimIds = selectedClaim\s*\? \[selectedClaim\]/);
  assert.match(component, /selectedEvent\s*\? focusedComparisonClaimIds\s*:\s*\(selectedEvidence \|\| selectedRelation\)/);
});

test("matching comparison rows prioritize explicit changes before unchanged snapshot state", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");

  assert.match(component, /const allComparisonChangedFirst = \[\s*\.\.\.comparisonChangedClaimIds,\s*\.\.\.allComparisonClaimIds\.filter\(\(id\) => !changedSet\.has\(id\)\),\s*\]/s);
  assert.match(component, /const stateFocusedChangedFirst = \[\s*\.\.\.comparisonChangedClaimIds\.filter\(\(id\) => stateFocusedComparisonClaimIds\.includes\(id\)\),/s);
  assert.match(component, /comparisonVisibleClaimIds\.slice\(0, 20\)/);
  assert.match(component, /Claims with matching explicit changes are prioritized ahead of unchanged matching state/);
});

test("comparison mode survives form and URL navigation but does not filter chronology or matrix snapshots", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");

  assert.match(component, /selectedChangedOnly && <input type="hidden" name="historyChanged" value="only" \/>/);
  assert.match(component, /changedOnly: selectedChangedOnly/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, changedOnly: false \}\)/);
  assert.match(component, /historyHref\(\{ \.\.\.hrefState, changedOnly: true \}\)/);
  assert.match(component, /comparison-only changed-row mode is preserved in URLs but does not alter this multi-revision matrix/);
  assert.doesNotMatch(component, /transitionEvents\([^\n]*selectedChangedOnly/);
  assert.doesNotMatch(component, /matrixChangedIds[^\n]*selectedChangedOnly/);
});

test("unchanged comparison state collapses natively while explicit additions removals and changes stay open", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");

  assert.match(component, /const deltaKind = !before && after \? "added" : before && !after \? "removed" : claimEvents\.length \? "changed" : "unchanged"/);
  assert.match(component, /<details className=\{`\$\{styles\.claimCompare\} \$\{deltaClass\}`\} open=\{deltaKind !== "unchanged"\}/);
  assert.match(component, /No matching change/);
  assert.match(component, /Base · before/);
  assert.match(component, /Compare · after/);
  assert.match(css, /\.claimCompare > summary/);
  assert.match(css, /\.claimUnchanged\s*\{[^}]*border-style:\s*dashed/s);
  assert.match(css, /\.claimAdded/);
  assert.match(css, /\.claimRemoved/);
  assert.match(css, /\.claimChanged/);
  assert.match(css, /\.claimCompare > summary:focus-visible/);
});

test("comparison mode is an accessible two-state presentation control", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");

  assert.match(component, /aria-label="Comparison Claim row mode"/);
  assert.match(component, />All matching<\/Link>/);
  assert.match(component, />Only changed<\/Link>/);
  assert.match(component, /aria-current=\{!selectedChangedOnly \? "page" : undefined\}/);
  assert.match(component, /aria-current=\{selectedChangedOnly \? "page" : undefined\}/);
  assert.match(css, /\.compareMode a:focus-visible/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*\.compareMode a/);
});
