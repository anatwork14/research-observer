import assert from "node:assert/strict";
import test from "node:test";
import { buildResearchEvolutionProjection } from "../lib/research/evolution.mjs";

function workspace(entries) {
  return {
    entries,
    assets: [],
    graph: { nodes: [], edges: [] },
    experiments: [],
  };
}

test("Consensus evidence creates a stable external source-to-evidence provenance edge", () => {
  const fixture = workspace([
    {
      slug: "consensus-evidence",
      filename: "01_consensus_evidence.md",
      title: "Evidence: Example scholarly paper",
      research: "default",
      type: "evidence",
      status: "complete",
      order: 1,
      content: "# Evidence",
      source: {
        kind: "consensus",
        doi: "https://doi.org/10.1000/Example.DOI",
        url: "https://example.org/paper#abstract",
        paperId: "provider-paper-1",
      },
    },
  ]);

  const first = buildResearchEvolutionProjection(fixture, { projectId: "default" });
  const second = buildResearchEvolutionProjection(fixture, { projectId: "default" });
  const source = first.nodes.find((node) => node.kind === "paper");
  assert.ok(source);
  assert.equal(source.sourceKind, "consensus");
  assert.equal(source.type, "consensus");
  assert.equal(source.doi, "10.1000/example.doi");
  assert.equal(source.url, "https://example.org/paper");
  assert.equal(source.paperId, "provider-paper-1");
  assert.equal(source.id, second.nodes.find((node) => node.kind === "paper")?.id);
  assert.ok(first.edges.some((edge) =>
    edge.source === source.id &&
    edge.target === "research:consensus-evidence" &&
    edge.type === "source_of" &&
    edge.layer === "source",
  ));
});

test("external source identity prefers DOI so provider URL changes do not split one paper", () => {
  const entries = [
    {
      slug: "evidence-a",
      filename: "01_a.md",
      title: "Evidence: Same paper A",
      research: "default",
      type: "evidence",
      order: 1,
      content: "",
      source: { kind: "consensus", doi: "10.1000/shared", url: "https://example.org/a" },
    },
    {
      slug: "evidence-b",
      filename: "02_b.md",
      title: "Evidence: Same paper B",
      research: "default",
      type: "evidence",
      order: 2,
      content: "",
      source: { kind: "consensus", doi: "10.1000/SHARED", url: "https://example.org/b" },
    },
  ];

  const projection = buildResearchEvolutionProjection(workspace(entries), { projectId: "default" });
  const sources = projection.nodes.filter((node) => node.kind === "paper");
  assert.equal(sources.length, 1);
  assert.equal(projection.edges.filter((edge) => edge.type === "source_of").length, 2);
});
