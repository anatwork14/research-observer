import assert from "node:assert/strict";
import test from "node:test";
import { mergeEvolutionLayers } from "../lib/research/evolution-merge.mjs";
import { traceEvolutionNeighborhood } from "../lib/research/evolution-trace.mjs";
import { buildManuscriptCitationProjection } from "../lib/research/evolution.mjs";
import { buildManuscriptClaimProjection } from "../lib/research/manuscript-claim-projection.mjs";

const content = [
  "\\section{Results}",
  "% observaire:claim robust-under-shift",
  "The method remains stable under shift \\cite{alpha}.",
].join("\n");

function researchProjection() {
  return {
    projectId: "default",
    nodes: [{
      id: "research:evidence-alpha",
      kind: "research",
      label: "Evidence alpha",
      research: "default",
      role: "evidence",
    }],
    edges: [],
    timeline: [],
    lineages: [],
    stats: { researchNodes: 1 },
  };
}

test("citation and explicit claim layers converge on one literal Passage identity", () => {
  const citation = buildManuscriptCitationProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [{
      file: "main.tex",
      content,
      citations: [{
        key: "alpha",
        file: "main.tex",
        start: content.indexOf("\\cite{alpha}"),
        end: content.indexOf("\\cite{alpha}") + "\\cite{alpha}".length,
        bibFiles: ["references.bib"],
        status: "resolved",
        choices: [{ slug: "evidence-alpha" }],
      }],
    }],
  });
  const claims = buildManuscriptClaimProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [{ file: "main.tex", content }],
  });

  const merged = mergeEvolutionLayers(researchProjection(), citation, claims);
  const passages = merged.nodes.filter((node) => node.kind === "passage");
  const claim = merged.nodes.find((node) => node.kind === "claim");
  const citationNode = merged.nodes.find((node) => node.kind === "citation");
  const manuscript = merged.nodes.find((node) => node.kind === "manuscript");

  assert.equal(passages.length, 1);
  assert.ok(claim);
  assert.ok(citationNode);
  assert.ok(manuscript);
  const passage = passages[0];
  assert.ok(merged.edges.some((edge) => edge.source === citationNode.id && edge.target === passage.id && edge.type === "located_in"));
  assert.ok(merged.edges.some((edge) => edge.source === passage.id && edge.target === claim.id && edge.type === "anchors_claim"));
  assert.ok(merged.edges.some((edge) => edge.source === claim.id && edge.target === manuscript.id && edge.type === "part_of"));
});

test("explicit claim layer adds no semantic evidence relationship", () => {
  const claims = buildManuscriptClaimProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [{ file: "main.tex", content }],
  });
  assert.equal(claims.edges.some((edge) => ["supports", "contradicts", "answers", "confirms", "uses_as_evidence"].includes(edge.type)), false);
  assert.ok(claims.edges.every((edge) => edge.layer === "claim"));
});

test("seven-hop trace can include explicit Claim between Passage and Manuscript", () => {
  const edges = [
    { source: "paper", target: "annotation" },
    { source: "annotation", target: "evidence" },
    { source: "evidence", target: "citation" },
    { source: "citation", target: "passage" },
    { source: "passage", target: "claim" },
    { source: "claim", target: "manuscript" },
    { source: "manuscript", target: "revision" },
  ];
  const traced = traceEvolutionNeighborhood(edges, "paper", 7);
  assert.deepEqual([...traced], ["paper", "annotation", "evidence", "citation", "passage", "claim", "manuscript", "revision"]);
  assert.equal(traceEvolutionNeighborhood(edges, "paper", 6).has("revision"), false);
});
