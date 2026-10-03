import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("revision compare summary derives only from explicit comparison events", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /const comparisonEvents = comparison \? transitionEvents\(comparison\.events, selectedClaim, selectedEvidence, selectedEvent, selectedRelation\) : \[\]/);
  assert.match(component, /const relationTransitionTotal = comparisonEvents\.filter\(\(event\) => event\.type === "relation-changed"\)\.length/);
  assert.match(component, /function relationTransitionCount\([\s\S]*event\.type === "relation-changed"[\s\S]*event\.beforeRelation === before[\s\S]*event\.afterRelation === after/);
  assert.match(component, /EVENT_ORDER\.map\(\(type\) => \{[\s\S]*comparisonEvents\.filter\(\(event\) => event\.type === type\)\.length/);
  assert.doesNotMatch(component, /relationTransitionCount\([^)]*excerpt/);
  assert.doesNotMatch(component, /relationTransitionCount\([^)]*citation/);
  assert.doesNotMatch(component, /relationTransitionCount\([^)]*title/);
});

test("relation transition matrix uses only the fixed authored relation vocabulary", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.tsx"), "utf8");
  assert.match(component, /MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS/);
  assert.match(component, /MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS\.map\(\(before\) =>/);
  assert.match(component, /MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS\.map\(\(after\) =>/);
  assert.match(component, /relationTransitionCount\(comparisonEvents, before, after\)/);
  assert.match(component, /No unambiguous direct relation transformation matches the active comparison filters/);
});

test("relation transition matrix remains internally scrollable and document-contained", async () => {
  const css = await fs.readFile(path.join(root, "components/ManuscriptClaimHistory.module.css"), "utf8");
  assert.match(css, /\.deltaPanel\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.relationTransitionScroll\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.relationTransitionMatrix\s*\{[^}]*min-width:\s*560px/s);
  assert.match(css, /\.relationTransitionHit/);
});
