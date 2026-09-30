import assert from "node:assert/strict";
import test from "node:test";
import { buildManuscriptClaimProjection } from "../lib/research/manuscript-claim-projection.mjs";

const evidence = (slug, research = "default") => ({ slug, research, type: "evidence", title: slug });
const literature = (slug, research = "default") => ({ slug, research, type: "literature", title: slug });

function project(content, researchEntries = [evidence("evidence-a")]) {
  return buildManuscriptClaimProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [{ file: "main.tex", content }],
    researchEntries,
  });
}

test("valid explicit Claim↔Evidence directive creates one authored semantic edge", () => {
  const result = project([
    "% observaire:claim robust-result",
    "% observaire:claim-evidence robust-result supports evidence-a",
    "The method remains robust.",
  ].join("\n"));

  const relation = result.edges.find((edge) => edge.layer === "claim-evidence");
  assert.ok(relation);
  assert.equal(relation.source, "research:evidence-a");
  assert.equal(relation.target, "claim:default:robust-result");
  assert.equal(relation.type, "supports");
  assert.equal(relation.explicit, true);
  assert.equal(result.stats.relations, 1);
  assert.equal(result.stats.relationIssues, 0);
});

test("all allowed authored relation types remain distinct", () => {
  const result = project([
    "% observaire:claim result",
    "% observaire:claim-evidence result supports evidence-a",
    "% observaire:claim-evidence result contradicts evidence-b",
    "% observaire:claim-evidence result contextualizes evidence-c",
    "% observaire:claim-evidence result qualifies evidence-d",
    "The result is explicitly related to four evidence objects.",
  ].join("\n"), [evidence("evidence-a"), evidence("evidence-b"), evidence("evidence-c"), evidence("evidence-d")]);
  assert.deepEqual(
    result.edges.filter((edge) => edge.layer === "claim-evidence").map((edge) => edge.type).sort(),
    ["contextualizes", "contradicts", "qualifies", "supports"],
  );
});

test("non-Evidence and cross-project targets remain health issues without edges", () => {
  const result = project([
    "% observaire:claim result",
    "% observaire:claim-evidence result supports paper-a",
    "% observaire:claim-evidence result supports evidence-other",
    "% observaire:claim-evidence result supports evidence-missing",
    "Claim prose.",
  ].join("\n"), [
    literature("paper-a"),
    evidence("evidence-other", "other-project"),
  ]);
  assert.equal(result.stats.relations, 0);
  assert.deepEqual(result.relationIssues.map((issue) => issue.type), [
    "evidence-type",
    "evidence-cross-project",
    "evidence-missing",
  ]);
});

test("relation to missing or duplicate Claim cannot create semantic edge", () => {
  const result = project([
    "% observaire:claim duplicated",
    "First claim prose.",
    "",
    "% observaire:claim duplicated",
    "Second claim prose.",
    "",
    "% observaire:claim-evidence duplicated supports evidence-a",
    "% observaire:claim-evidence absent supports evidence-a",
  ].join("\n"));
  assert.equal(result.stats.relations, 0);
  assert.equal(result.relationIssues.filter((issue) => issue.type === "claim-unresolved").length, 2);
});

test("duplicate exact relation emits one edge and explicit duplicate health", () => {
  const result = project([
    "% observaire:claim result",
    "% observaire:claim-evidence result supports evidence-a",
    "% observaire:claim-evidence result supports evidence-a",
    "Claim prose.",
  ].join("\n"));
  assert.equal(result.stats.relations, 1);
  assert.equal(result.stats.relationDuplicates, 2);
  assert.equal(result.relationIssues.filter((issue) => issue.type === "duplicate-relation").length, 2);
});

test("citation or prose wording alone never creates Claim↔Evidence semantics", () => {
  const result = project([
    "% observaire:claim result",
    "This proves and supports the result \\cite{evidence-a}.",
  ].join("\n"));
  assert.equal(result.stats.relations, 0);
  assert.equal(result.edges.some((edge) => edge.layer === "claim-evidence"), false);
});
