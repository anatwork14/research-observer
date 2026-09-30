import assert from "node:assert/strict";
import test from "node:test";
import { parseManuscriptClaimAnchors } from "../lib/research/manuscript-claims.mjs";
import { parseManuscriptClaimEvidenceRelations } from "../lib/research/manuscript-claim-relations.mjs";

test("claim-evidence directives are not parsed as Claim anchors", () => {
  const source = [
    "% observaire:claim explicit-result",
    "% observaire:claim-evidence explicit-result supports evidence-a",
    "Claim prose.",
  ].join("\n");
  const claims = parseManuscriptClaimAnchors(source);
  const relations = parseManuscriptClaimEvidenceRelations(source);
  assert.equal(claims.claims.length, 1);
  assert.equal(claims.claims[0].claimId, "explicit-result");
  assert.deepEqual(claims.issues, []);
  assert.equal(relations.relations.length, 1);
  assert.deepEqual(relations.issues, []);
});
