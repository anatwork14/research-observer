import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResearchEvolutionTrail,
  diffResearchSemantics,
} from "../lib/research/semantic-evolution.mjs";

const baseline = {
  slug: "idea-v1",
  title: "Retrieval hypothesis",
  summary: "Dense retrieval should improve recall.",
  type: "hypothesis",
  status: "investigating",
  date: "2026-01-10",
  tags: ["retrieval", "baseline"],
  assets: ["figures/baseline.svg"],
  headings: [{ level: 1, title: "Hypothesis" }, { level: 2, title: "Method" }],
  relationships: [
    { type: "supports", target: "prior-observation" },
    { type: "supersedes", target: "idea-v0" },
  ],
  incomingRelationships: [{ type: "supports", source: "evidence-a" }],
};

const revised = {
  ...baseline,
  slug: "idea-v2",
  summary: "Dense retrieval should improve recall when reranking is constrained.",
  status: "validating",
  date: "2026-02-10",
  tags: ["retrieval", "robustness"],
  assets: ["figures/baseline.svg", "figures/ablation.svg"],
  headings: [
    { level: 1, title: "Hypothesis" },
    { level: 2, title: "Method" },
    { level: 2, title: "Limitations" },
  ],
  relationships: [
    { type: "supports", target: "prior-observation" },
    { type: "contradicts", target: "latency-assumption", note: "Observed under the fixed budget." },
    { type: "supersedes", target: "idea-v1" },
  ],
  incomingRelationships: [
    { type: "supports", source: "evidence-a" },
    { type: "contradicts", source: "evidence-b" },
    { type: "references", source: "method-note" },
  ],
};

const current = {
  ...revised,
  slug: "idea-v3",
  title: "Constrained retrieval hypothesis",
  date: "2026-03-10",
  incomingRelationships: [
    { type: "supports", source: "evidence-a" },
    { type: "supports", source: "evidence-c" },
  ],
  relationships: [
    { type: "supports", target: "prior-observation" },
    { type: "supersedes", target: "idea-v2" },
  ],
};

test("semantic diff reports normalized research changes and excludes supersedes plumbing", () => {
  const diff = diffResearchSemantics(baseline, revised);

  assert.deepEqual(
    diff.fieldChanges.map((change) => change.field),
    ["summary", "status"],
  );
  assert.deepEqual(diff.tags, { added: ["robustness"], removed: ["baseline"] });
  assert.deepEqual(diff.headings, { added: ["Limitations"], removed: [] });
  assert.deepEqual(diff.assets, { added: ["figures/ablation.svg"], removed: [] });
  assert.deepEqual(diff.relationships.added, [
    { type: "contradicts", target: "latency-assumption", note: "Observed under the fixed budget." },
  ]);
  assert.deepEqual(diff.relationships.removed, []);
  assert.deepEqual(diff.incomingEvidence.added, [{ type: "contradicts", source: "evidence-b" }]);
  assert.equal(diff.relationships.added.some((relation) => relation.type === "supersedes"), false);
  assert.equal(diff.summary.changedDimensions, 6);
  assert.equal(diff.hasChanges, true);
});

test("semantic diff tracks explicit evidence source provenance changes", () => {
  const older = {
    source: { kind: "pdf", pdf: "papers/a.pdf", page: 3 },
  };
  const newer = {
    source: { kind: "pdf", pdf: "papers/a.pdf", page: 7 },
  };
  const diff = diffResearchSemantics(older, newer);

  assert.deepEqual(diff.fieldChanges, [
    {
      field: "source",
      label: "Evidence source",
      before: "papers/a.pdf · p.3",
      after: "papers/a.pdf · p.7",
    },
  ]);
});

test("semantic evolution trail follows explicit predecessor edges", () => {
  const trail = buildResearchEvolutionTrail([baseline, revised, current]);

  assert.equal(trail.length, 3);
  assert.equal(trail[0].changes, null);
  assert.deepEqual(trail[0].predecessors, []);
  assert.equal(trail[1].predecessors[0].slug, "idea-v1");
  assert.equal(trail[1].changes.summary.evidenceSignalChanges, 1);
  assert.equal(trail[2].predecessors[0].slug, "idea-v2");
  assert.equal(trail[2].changes.fieldChanges.some((change) => change.field === "title"), true);
  assert.deepEqual(trail.map((item) => item.slug), ["idea-v1", "idea-v2", "idea-v3"]);
});

test("branched lineage never invents an adjacent predecessor comparison", () => {
  const branch = {
    ...baseline,
    slug: "idea-branch",
    title: "Alternative retrieval hypothesis",
    date: "2026-02-20",
    relationships: [{ type: "supersedes", target: "idea-v1" }],
  };
  const merged = {
    ...current,
    slug: "idea-merged",
    title: "Merged retrieval hypothesis",
    date: "2026-04-10",
    relationships: [
      { type: "supersedes", target: "idea-v2", note: "Retains the constrained reranking path." },
      { type: "supersedes", target: "idea-branch", note: "Adopts the alternative failure analysis." },
    ],
  };
  const trail = buildResearchEvolutionTrail([baseline, revised, branch, merged]);
  const item = trail.find((candidate) => candidate.slug === "idea-merged");

  assert.deepEqual(item.predecessors.map((predecessor) => predecessor.slug), ["idea-v2", "idea-branch"]);
  assert.equal(item.predecessors[0].note, "Retains the constrained reranking path.");
  assert.equal(item.predecessors[1].note, "Adopts the alternative failure analysis.");
  assert.equal(item.changes, null);
});

test("wording-only edits do not become semantic changes", () => {
  const left = {
    title: "Same",
    summary: "Same summary",
    status: "validating",
    tags: ["a"],
    headings: [{ title: "Method" }],
    relationships: [{ type: "supersedes", target: "older" }],
  };
  const right = {
    ...left,
    content: "Completely different Markdown wording.",
    relationships: [{ type: "supersedes", target: "left" }],
  };

  const diff = diffResearchSemantics(left, right);
  assert.equal(diff.hasChanges, false);
  assert.equal(diff.summary.changedDimensions, 0);
});
