import assert from "node:assert/strict";
import test from "node:test";
import { buildManuscriptClaimProjection } from "../lib/research/manuscript-claim-projection.mjs";

function file(file, content) {
  return { file, content };
}

test("unique explicit claim creates Passage to Claim to Manuscript provenance", () => {
  const projection = buildManuscriptClaimProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [file("main.tex", [
      "\\section{Results}",
      "% observaire:claim robust-under-shift",
      "The method remains stable under shift \\cite{alpha}.",
    ].join("\n"))],
  });

  const claim = projection.nodes.find((node) => node.kind === "claim");
  const passage = projection.nodes.find((node) => node.kind === "passage");
  const manuscript = projection.nodes.find((node) => node.kind === "manuscript");
  assert.ok(claim);
  assert.ok(passage);
  assert.ok(manuscript);
  assert.equal(claim.claimId, "robust-under-shift");
  assert.equal(claim.section, "Results");
  assert.equal(claim.line, 3);
  assert.equal(claim.anchorLine, 2);
  assert.match(claim.excerpt, /method remains stable/);
  assert.match(claim.href, /file=main\.tex/);
  assert.match(claim.href, /line=2/);
  assert.match(passage.href, /line=3/);
  assert.equal(projection.stats.claims, 1);
  assert.equal(projection.stats.claimIssues, 0);

  assert.ok(projection.edges.some((edge) => edge.source === passage.id && edge.target === claim.id && edge.type === "anchors_claim" && edge.layer === "claim"));
  assert.ok(projection.edges.some((edge) => edge.source === claim.id && edge.target === manuscript.id && edge.type === "part_of" && edge.layer === "claim"));
});

test("claim without any citation still creates a literal Passage and Claim", () => {
  const projection = buildManuscriptClaimProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [file("main.tex", "% observaire:claim uncited-observation\nThis claim has no citation yet.")],
  });
  assert.equal(projection.nodes.filter((node) => node.kind === "claim").length, 1);
  assert.equal(projection.nodes.filter((node) => node.kind === "passage").length, 1);
  assert.equal(projection.edges.some((edge) => edge.type === "cited_as"), false);
});

test("duplicate explicit IDs across files are health issues and do not create guessed claim identity", () => {
  const projection = buildManuscriptClaimProjection({
    projectId: "default",
    files: [
      file("main.tex", "% observaire:claim same-id\nFirst prose."),
      file("chapters/results.tex", "% observaire:claim same-id\nSecond prose."),
    ],
  });
  assert.equal(projection.nodes.filter((node) => node.kind === "claim").length, 0);
  assert.equal(projection.stats.claims, 0);
  assert.equal(projection.stats.duplicates, 2);
  assert.equal(projection.issues.filter((issue) => issue.type === "duplicate").length, 2);
  assert.equal(projection.edges.length, 0);
});

test("invalid and orphan directives remain health issues without claim nodes", () => {
  const projection = buildManuscriptClaimProjection({
    projectId: "default",
    files: [file("main.tex", [
      "% observaire:claim Bad-ID",
      "Prose.",
      "",
      "% observaire:claim orphan-id",
    ].join("\n"))],
  });
  assert.equal(projection.nodes.filter((node) => node.kind === "claim").length, 0);
  assert.equal(projection.stats.invalid, 1);
  assert.equal(projection.stats.orphan, 1);
});

test("claim IDs are scoped by project rather than globally across research workspaces", () => {
  const a = buildManuscriptClaimProjection({
    projectId: "a",
    files: [file("main.tex", "% observaire:claim shared-name\nProject A prose.")],
  });
  const b = buildManuscriptClaimProjection({
    projectId: "b",
    files: [file("main.tex", "% observaire:claim shared-name\nProject B prose.")],
  });
  const aClaim = a.nodes.find((node) => node.kind === "claim");
  const bClaim = b.nodes.find((node) => node.kind === "claim");
  assert.notEqual(aClaim.id, bClaim.id);
  assert.equal(aClaim.id, "claim:a:shared-name");
  assert.equal(bClaim.id, "claim:b:shared-name");
});
