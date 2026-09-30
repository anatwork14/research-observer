import assert from "node:assert/strict";
import test from "node:test";
import {
  MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS,
  manuscriptClaimEvidenceEdgeId,
  parseManuscriptClaimEvidenceRelations,
} from "../lib/research/manuscript-claim-relations.mjs";

test("claim-evidence parser accepts the explicit three-token contract", () => {
  const source = [
    "% observaire:claim-evidence robustness-under-drift supports evidence-robustness",
    "% observaire:claim-evidence robustness-under-drift contextualizes 010-evidence-domain-shift",
  ].join("\n");
  const result = parseManuscriptClaimEvidenceRelations(source);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.relations, [
    { claimId: "robustness-under-drift", relation: "supports", evidenceSlug: "evidence-robustness", line: 1 },
    { claimId: "robustness-under-drift", relation: "contextualizes", evidenceSlug: "010-evidence-domain-shift", line: 2 },
  ]);
});

test("relation vocabulary is intentionally small and explicit", () => {
  assert.deepEqual([...MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS], ["supports", "contradicts", "contextualizes", "qualifies"]);
  const result = parseManuscriptClaimEvidenceRelations("% observaire:claim-evidence result proves evidence-a");
  assert.equal(result.relations.length, 0);
  assert.equal(result.issues[0].type, "unsupported-relation");
});

test("parser rejects placeholders, malformed IDs, and extra tokens instead of guessing", () => {
  const source = [
    "% observaire:claim-evidence claim-id supports evidence-a",
    "% observaire:claim-evidence claim-one supports evidence-slug",
    "% observaire:claim-evidence Claim-One supports evidence-a",
    "% observaire:claim-evidence claim-one supports Evidence_A",
    "% observaire:claim-evidence claim-one supports evidence-a because-important",
    "% observaire:claim-evidence",
  ].join("\n");
  const result = parseManuscriptClaimEvidenceRelations(source);
  assert.equal(result.relations.length, 0);
  assert.deepEqual(result.issues.map((issue) => issue.type), [
    "invalid-claim-id",
    "invalid-evidence-slug",
    "invalid-claim-id",
    "invalid-evidence-slug",
    "invalid-directive",
    "invalid-directive",
  ]);
});

test("claim-evidence edge identity is stable and project scoped", () => {
  assert.equal(
    manuscriptClaimEvidenceEdgeId("alpha", "robustness-under-drift", "supports", "evidence-robustness"),
    "claim-evidence:alpha:robustness-under-drift:supports:evidence-robustness",
  );
  assert.notEqual(
    manuscriptClaimEvidenceEdgeId("alpha", "robustness-under-drift", "supports", "evidence-robustness"),
    manuscriptClaimEvidenceEdgeId("beta", "robustness-under-drift", "supports", "evidence-robustness"),
  );
});
