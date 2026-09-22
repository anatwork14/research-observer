import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResearchAnalytics,
  buildVersionGroups,
  diffResearchVersions,
  entriesForResearch,
  selectedResearchIds,
} from "../lib/research/analytics.mjs";

const entries = [
  {
    slug: "idea-v1",
    title: "Idea v1",
    research: "retrieval",
    type: "hypothesis",
    status: "investigating",
    date: "2026-01-10",
    order: 1,
    words: 10,
    content: "# Idea\n\nOld claim.",
    assets: [],
    relationships: [],
  },
  {
    slug: "idea-v2",
    title: "Idea v2",
    research: "retrieval",
    type: "hypothesis",
    status: "validating",
    date: "2026-02-10",
    order: 2,
    words: 14,
    content: "# Idea\n\nRevised claim.\n\nNew limitation.",
    assets: ["figures/a.svg"],
    relationships: [{ type: "supersedes", target: "idea-v1" }],
  },
  {
    slug: "experiment",
    title: "Experiment",
    research: "retrieval",
    type: "experiment",
    status: "experimenting",
    date: "2026-03-01",
    order: 3,
    words: 20,
    content: "# Experiment",
    assets: [],
    relationships: [{ type: "produces", target: "result" }],
  },
  {
    slug: "result",
    title: "Result",
    research: "evaluation",
    type: "result",
    status: "complete",
    date: "2026-03-14",
    order: 4,
    words: 12,
    content: "# Result",
    assets: [],
    relationships: [{ type: "supports", target: "idea-v2" }],
  },
];

const workspace = {
  entries,
  projects: [
    {
      id: "retrieval",
      label: "Retrieval",
      notes: 3,
      active: 3,
      questions: 0,
      hypotheses: 2,
      literature: 0,
      experiments: 1,
      results: 0,
      evidence: 0,
      decisions: 0,
      words: 44,
      relationships: 2,
      crossProjectRelationships: 0,
      errors: 0,
      warnings: 0,
    },
    {
      id: "evaluation",
      label: "Evaluation",
      notes: 1,
      active: 0,
      questions: 0,
      hypotheses: 0,
      literature: 0,
      experiments: 0,
      results: 1,
      evidence: 0,
      decisions: 0,
      words: 12,
      relationships: 1,
      crossProjectRelationships: 1,
      errors: 0,
      warnings: 0,
    },
  ],
  health: {
    unansweredQuestions: [],
    experimentsWithoutResults: [],
    resultsWithoutExperiment: [],
    decisionsWithoutBasis: [],
    literatureMissingPdf: [],
    literatureMissingDoi: [],
    evidenceMissingSource: [],
    missingStableIds: [],
  },
};

test("analytics filters one or several research projects deterministically", () => {
  assert.deepEqual(selectedResearchIds(workspace, ["evaluation"]), ["evaluation"]);
  assert.equal(entriesForResearch(entries, ["retrieval"]).length, 3);
  assert.equal(entriesForResearch(entries, ["retrieval", "evaluation"]).length, 4);

  const analytics = buildResearchAnalytics(workspace, ["retrieval", "evaluation"]);
  assert.equal(analytics.totals.notes, 4);
  assert.equal(analytics.projects.length, 2);
  assert.equal(analytics.totals.crossProjectRelationships, 1);
  assert.equal(analytics.activity.length, 3);
});

test("version groups follow explicit supersedes relationships", () => {
  const groups = buildVersionGroups(entries);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].versions.map((entry) => entry.slug), ["idea-v1", "idea-v2"]);
  assert.deepEqual(groups[0].edges, [{ newer: "idea-v2", older: "idea-v1" }]);
});

test("version diff reports added and removed Markdown lines", () => {
  const diff = diffResearchVersions(entries[0], entries[1]);
  assert.ok(diff.added >= 2);
  assert.ok(diff.removed >= 1);
  assert.equal(diff.truncated, false);
  assert.ok(diff.lines.some((line) => line.type === "added" && line.text === "New limitation."));
  assert.ok(diff.lines.some((line) => line.type === "removed" && line.text === "Old claim."));
});
