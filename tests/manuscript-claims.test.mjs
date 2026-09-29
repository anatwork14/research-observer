import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidManuscriptClaimId,
  manuscriptClaimNodeId,
  parseManuscriptClaimAnchors,
} from "../lib/research/manuscript-claims.mjs";

const source = [
  "\\section{Introduction}",
  "% observaire:claim robustness-under-drift",
  "Our method remains stable under distribution shift \\cite{alpha}.",
  "",
  "% observaire:claim reproducible-evaluation",
  "% explanatory comment that must not become claim text",
  "\\subsection{Evaluation}",
  "The evaluation protocol can be reproduced from the saved configuration.",
].join("\n");

test("claim IDs require bounded lowercase kebab-case", () => {
  assert.equal(isValidManuscriptClaimId("robustness-under-drift"), true);
  assert.equal(isValidManuscriptClaimId("claim2"), true);
  assert.equal(isValidManuscriptClaimId("Claim-Two"), false);
  assert.equal(isValidManuscriptClaimId("claim_two"), false);
  assert.equal(isValidManuscriptClaimId("two words"), false);
  assert.equal(isValidManuscriptClaimId(`a${"b".repeat(80)}`), false);
});

test("explicit claim anchors attach to the following prose passage", () => {
  const result = parseManuscriptClaimAnchors(source);
  assert.deepEqual(result.issues, []);
  assert.equal(result.claims.length, 2);

  const first = result.claims[0];
  assert.equal(first.claimId, "robustness-under-drift");
  assert.equal(first.markerLine, 2);
  assert.equal(first.targetLine, 3);
  assert.equal(first.passage.heading?.title, "Introduction");
  assert.match(first.passage.excerpt, /^Our method remains stable/);
  assert.doesNotMatch(first.passage.excerpt, /observaire:claim/);

  const second = result.claims[1];
  assert.equal(second.claimId, "reproducible-evaluation");
  assert.equal(second.markerLine, 5);
  assert.equal(second.targetLine, 8);
  assert.equal(second.passage.heading?.title, "Evaluation");
  assert.match(second.passage.excerpt, /^The evaluation protocol/);
  assert.doesNotMatch(second.passage.excerpt, /explanatory comment/);
});

test("stacked explicit claim markers may deliberately share one passage", () => {
  const content = [
    "% observaire:claim first-claim",
    "% observaire:claim second-claim",
    "One literal paragraph contains both explicit claim anchors.",
  ].join("\n");
  const result = parseManuscriptClaimAnchors(content);
  assert.equal(result.claims.length, 2);
  assert.equal(result.claims[0].passage.start, result.claims[1].passage.start);
  assert.equal(result.claims[0].passage.end, result.claims[1].passage.end);
});

test("invalid and orphan claim anchors surface issues without invented targets", () => {
  const content = [
    "% observaire:claim Not-Valid",
    "Some prose.",
    "",
    "% observaire:claim valid-id extra-token",
    "More prose.",
    "",
    "% observaire:claim orphan-claim",
  ].join("\n");
  const result = parseManuscriptClaimAnchors(content);
  assert.equal(result.claims.length, 0);
  assert.deepEqual(result.issues.map((issue) => issue.type), ["invalid-id", "invalid-id", "orphan"]);
});

test("claim node identity is stable within project and explicit ID", () => {
  assert.equal(manuscriptClaimNodeId("default", "robustness-under-drift"), "claim:default:robustness-under-drift");
});
