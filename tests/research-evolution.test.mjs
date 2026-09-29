import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManuscriptCitationProjection,
  buildResearchEvolutionProjection,
  mergeEvolutionProjections,
} from "../lib/research/evolution.mjs";

function entry(overrides) {
  return {
    slug: overrides.slug,
    filename: overrides.filename || `${overrides.slug}.md`,
    title: overrides.title || overrides.slug,
    research: overrides.research || "default",
    type: overrides.type || "note",
    status: overrides.status || "complete",
    date: overrides.date,
    order: overrides.order ?? 0,
    source: overrides.source,
    pdf: overrides.pdf,
    content: overrides.content || "",
  };
}

function workspace() {
  return {
    entries: [
      entry({
        slug: "literature-paper",
        title: "Source paper",
        type: "literature",
        date: "2026-09-01",
        order: 1,
        pdf: "papers/source.pdf",
      }),
      entry({
        slug: "evidence-figure",
        title: "Figure evidence",
        type: "evidence",
        date: "2026-09-03",
        order: 2,
        source: { kind: "pdf", pdf: "papers/source.pdf", page: 4 },
        content: [
          "# Figure evidence",
          "",
          "**Observaire source annotation:** `ann-figure-1`",
          "",
          "**Annotation type:** figure",
          "",
          "**Anchor kind:** region",
          "",
          "**Region source text kind:** caption",
        ].join("\n"),
      }),
      entry({
        slug: "hypothesis-v1",
        title: "Hypothesis v1",
        type: "hypothesis",
        date: "2026-09-04",
        order: 3,
      }),
      entry({
        slug: "hypothesis-v2",
        title: "Hypothesis v2",
        type: "hypothesis",
        date: "2026-09-08",
        order: 4,
      }),
    ],
    assets: [{ path: "papers/source.pdf", extension: ".pdf" }],
    graph: {
      nodes: [],
      edges: [
        { source: "evidence-figure", target: "hypothesis-v2", type: "supports", explicit: true },
        { source: "hypothesis-v2", target: "hypothesis-v1", type: "supersedes", explicit: true },
        { source: "hypothesis-v1", target: "literature-paper", type: "references", explicit: false },
      ],
    },
    experiments: [
      {
        id: "run-1",
        label: "Ablation run",
        status: "complete",
        project: "default",
        experimentSlug: "experiment-1",
        timestamps: {
          createdAt: "2026-09-05T10:00:00Z",
          completedAt: "2026-09-05T10:30:00Z",
        },
      },
    ],
  };
}

test("evolution projection preserves paper to annotation to evidence provenance", () => {
  const projection = buildResearchEvolutionProjection(workspace(), { projectId: "default" });
  const nodeIds = new Set(projection.nodes.map((node) => node.id));
  assert.ok(nodeIds.has("paper:papers/source.pdf"));
  assert.ok(nodeIds.has("annotation:ann-figure-1"));
  assert.ok(nodeIds.has("research:evidence-figure"));

  const annotation = projection.nodes.find((node) => node.id === "annotation:ann-figure-1");
  assert.equal(annotation.annotationType, "figure");
  assert.equal(annotation.anchorKind, "region");
  assert.equal(annotation.sourceTextKind, "caption");
  assert.equal(annotation.page, 4);

  assert.ok(projection.edges.some((edge) => edge.source === "paper:papers/source.pdf" && edge.target === "annotation:ann-figure-1" && edge.type === "annotated_as"));
  assert.ok(projection.edges.some((edge) => edge.source === "annotation:ann-figure-1" && edge.target === "research:evidence-figure" && edge.type === "promoted_to"));
  assert.ok(projection.edges.some((edge) => edge.source === "research:evidence-figure" && edge.target === "research:hypothesis-v2" && edge.type === "supports"));
});

test("nested project source paths resolve to canonical distinct paper identities", () => {
  const fixture = {
    entries: [
      entry({
        slug: "alpha-evidence",
        filename: "Alpha Study/01_evidence.md",
        research: "alpha",
        type: "evidence",
        source: { kind: "pdf", pdf: "papers/source.pdf", page: 2 },
      }),
      entry({
        slug: "beta-evidence",
        filename: "Beta Study/01_evidence.md",
        research: "beta",
        type: "evidence",
        source: { kind: "pdf", pdf: "papers/source.pdf", page: 3 },
      }),
    ],
    assets: [
      { path: "Alpha Study/papers/source.pdf", extension: ".pdf" },
      { path: "Beta Study/papers/source.pdf", extension: ".pdf" },
    ],
    graph: { nodes: [], edges: [] },
    experiments: [],
  };

  const alpha = buildResearchEvolutionProjection(fixture, { projectId: "alpha" });
  const beta = buildResearchEvolutionProjection(fixture, { projectId: "beta" });
  assert.ok(alpha.nodes.some((node) => node.id === "paper:Alpha Study/papers/source.pdf"));
  assert.ok(beta.nodes.some((node) => node.id === "paper:Beta Study/papers/source.pdf"));
  assert.ok(!alpha.nodes.some((node) => node.id === "paper:Beta Study/papers/source.pdf"));
});

test("supersedes relationships become explicit version lineages", () => {
  const projection = buildResearchEvolutionProjection(workspace(), { projectId: "default" });
  assert.equal(projection.lineages.length, 1);
  const lineage = projection.lineages[0];
  assert.equal(lineage.cyclic, false);
  assert.deepEqual(lineage.newest, ["research:hypothesis-v2"]);
  assert.deepEqual(lineage.oldest, ["research:hypothesis-v1"]);
  assert.deepEqual(lineage.members, ["research:hypothesis-v1", "research:hypothesis-v2"]);
});

test("timeline combines dated research objects and experiment run timestamps", () => {
  const projection = buildResearchEvolutionProjection(workspace(), { projectId: "default" });
  assert.equal(projection.timeline.length, 6);
  assert.equal(projection.timeline[0].nodeId, "research:literature-paper");
  assert.ok(projection.timeline.some((event) => event.kind === "run" && event.type === "createdAt" && event.runId === "run-1"));
  assert.ok(projection.timeline.some((event) => event.kind === "run" && event.type === "completedAt" && event.runId === "run-1"));
  assert.deepEqual(
    projection.timeline.map((event) => event.at),
    projection.timeline.map((event) => event.at).slice().sort(),
  );
});

test("manuscript citation projection only links uniquely resolved citations", () => {
  const manuscript = buildManuscriptCitationProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [
      {
        file: "main.tex",
        citations: [
          { key: "figureEvidence", start: 12, end: 26, status: "resolved", choices: [{ slug: "evidence-figure" }] },
          { key: "ambiguous", start: 30, end: 39, status: "ambiguous", choices: [{ slug: "hypothesis-v1" }, { slug: "hypothesis-v2" }] },
          { key: "missing", start: 42, end: 49, status: "missing", choices: [] },
        ],
      },
    ],
  });

  assert.equal(manuscript.stats.citations, 3);
  assert.equal(manuscript.stats.resolved, 1);
  assert.equal(manuscript.stats.ambiguous, 1);
  assert.equal(manuscript.stats.missing, 1);
  assert.ok(manuscript.edges.some((edge) => edge.source === "research:evidence-figure" && edge.type === "cited_as"));
  assert.equal(manuscript.edges.filter((edge) => edge.type === "cited_as").length, 1);
  assert.deepEqual(manuscript.unresolved.map((item) => item.status).sort(), ["ambiguous", "missing"]);
});

test("merged projection creates a traceable evidence to citation to manuscript path", () => {
  const research = buildResearchEvolutionProjection(workspace(), { projectId: "default" });
  const manuscript = buildManuscriptCitationProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [{
      file: "main.tex",
      citations: [{ key: "figureEvidence", start: 12, end: 26, status: "resolved", choices: [{ slug: "evidence-figure" }] }],
    }],
  });
  const merged = mergeEvolutionProjections(research, manuscript);
  const citation = merged.nodes.find((node) => node.kind === "citation");
  const manuscriptNode = merged.nodes.find((node) => node.kind === "manuscript");
  assert.ok(citation);
  assert.ok(manuscriptNode);
  assert.ok(merged.edges.some((edge) => edge.source === "research:evidence-figure" && edge.target === citation.id && edge.type === "cited_as"));
  assert.ok(merged.edges.some((edge) => edge.source === citation.id && edge.target === manuscriptNode.id && edge.type === "appears_in"));
});

test("project filter excludes other research projects", () => {
  const fixture = workspace();
  fixture.entries.push(entry({ slug: "other-note", title: "Other", research: "other", type: "hypothesis", date: "2026-09-02", order: 1 }));
  fixture.graph.edges.push({ source: "other-note", target: "hypothesis-v1", type: "references", explicit: false });
  const projection = buildResearchEvolutionProjection(fixture, { projectId: "default" });
  assert.ok(!projection.nodes.some((node) => node.id === "research:other-note"));
  assert.ok(!projection.edges.some((edge) => edge.source === "research:other-note" || edge.target === "research:other-note"));
});
