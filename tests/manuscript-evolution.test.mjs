import assert from "node:assert/strict";
import test from "node:test";
import { buildManuscriptRevisionProjection } from "../lib/research/manuscript-evolution.mjs";
import { mergeEvolutionLayers } from "../lib/research/evolution-merge.mjs";

const history = {
  available: true,
  dirtyFiles: ["main.tex"],
  revisions: [
    {
      commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      shortCommit: "aaaaaaaaaa",
      at: "2026-09-10T10:00:00Z",
      author: "Researcher",
      subject: "revise introduction",
      files: [{ file: "main.tex", added: 8, removed: 2 }],
      added: 8,
      removed: 2,
    },
    {
      commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      shortCommit: "bbbbbbbbbb",
      at: "2026-09-11T11:00:00Z",
      author: "Researcher",
      subject: "update references",
      files: [
        { file: "main.tex", added: 2, removed: 1 },
        { file: "references.bib", added: 10, removed: 0 },
      ],
      added: 12,
      removed: 1,
    },
  ],
};

test("manuscript revisions become revision nodes, version edges, and timeline events", () => {
  const projection = buildManuscriptRevisionProjection({ projectId: "default", history });
  assert.equal(projection.stats.revisions, 2);
  assert.equal(projection.stats.dirtyFiles, 1);
  assert.ok(projection.nodes.some((node) => node.kind === "revision" && node.commit.startsWith("aaaaaaaa")));
  assert.ok(projection.nodes.some((node) => node.kind === "manuscript" && node.file === "references.bib"));
  assert.ok(projection.edges.some((edge) => edge.type === "revised_in" && edge.source === "manuscript:default:main.tex"));
  assert.deepEqual(projection.timeline.map((event) => event.kind), ["manuscript", "manuscript"]);
  assert.equal(projection.timeline[1].status, "2 files · +12 −1");
});

test("generic evolution merge keeps citation/manuscript nodes and appends revision timeline", () => {
  const research = {
    nodes: [{ id: "research:evidence", kind: "research", label: "Evidence", research: "default" }],
    edges: [],
    timeline: [{ id: "timeline:research:evidence", at: "2026-09-09T00:00:00.000Z", kind: "research", label: "Evidence", research: "default" }],
    lineages: [],
    stats: { researchNodes: 1, timelineEvents: 1 },
  };
  const citations = {
    nodes: [
      { id: "citation:default:main.tex:1:key", kind: "citation", label: "key", research: "default" },
      { id: "manuscript:default:main.tex", kind: "manuscript", label: "main.tex", research: "default" },
    ],
    edges: [{ id: "citation-edge", source: "research:evidence", target: "citation:default:main.tex:1:key", type: "cited_as", layer: "citation", explicit: true }],
  };
  const revisions = buildManuscriptRevisionProjection({ projectId: "default", history });
  const merged = mergeEvolutionLayers(research, citations, revisions);
  assert.equal(merged.stats.manuscriptNodes, 2);
  assert.equal(merged.stats.citationNodes, 1);
  assert.equal(merged.stats.revisionNodes, 2);
  assert.equal(merged.timeline.length, 3);
  assert.ok(merged.edges.some((edge) => edge.type === "revised_in"));
});
