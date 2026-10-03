import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsDrilldown,
  buildEvidenceSignalSummary,
  normalizeAnalyticsDrilldown,
} from "../lib/research/analytics-drilldown.mjs";
import { buildResearchAnalytics } from "../lib/research/analytics.mjs";

const entries = [
  {
    slug: "question-a",
    title: "Question A",
    summary: "Primary question",
    research: "alpha",
    type: "question",
    status: "investigating",
    date: "2026-01-10",
    order: 1,
    words: 10,
    relationships: [],
  },
  {
    slug: "hypothesis-a",
    title: "Hypothesis A",
    summary: "Primary hypothesis",
    research: "alpha",
    type: "hypothesis",
    status: "validating",
    date: "2026-02-11",
    order: 2,
    words: 12,
    relationships: [{ type: "references", target: "result-b" }],
  },
  {
    slug: "evidence-a",
    title: "Evidence A",
    summary: "Supports the hypothesis",
    research: "alpha",
    type: "evidence",
    status: "complete",
    date: "2026-02-15",
    order: 3,
    words: 9,
    relationships: [
      { type: "supports", target: "hypothesis-a" },
      { type: "answers", target: "question-a" },
    ],
  },
  {
    slug: "result-b",
    title: "Result B",
    summary: "Cross-project result",
    research: "beta",
    type: "result",
    status: "complete",
    date: "2026-03-01",
    order: 4,
    words: 8,
    relationships: [{ type: "contradicts", target: "hypothesis-a", note: "Observed in beta." }],
  },
];

const projects = [
  { id: "alpha", label: "Alpha", notes: 3, active: 2, questions: 1, hypotheses: 1, literature: 0, experiments: 0, results: 0, evidence: 1, decisions: 0, words: 31, relationships: 3, crossProjectRelationships: 1, warnings: 1, errors: 0 },
  { id: "beta", label: "Beta", notes: 1, active: 0, questions: 0, hypotheses: 0, literature: 0, experiments: 0, results: 1, evidence: 0, decisions: 0, words: 8, relationships: 1, crossProjectRelationships: 1, warnings: 0, errors: 0 },
];

const workspace = {
  entries,
  projects,
  health: {
    unansweredQuestions: ["question-a"],
    experimentsWithoutResults: [],
    resultsWithoutExperiment: ["result-b"],
    decisionsWithoutBasis: [],
    literatureMissingPdf: [],
    literatureMissingDoi: [],
    evidenceMissingSource: [],
    missingStableIds: [],
  },
};

const analytics = buildResearchAnalytics(workspace, ["alpha", "beta"]);

function drill(filters) {
  return buildAnalyticsDrilldown({ workspace, analytics, filters });
}

test("analytics drilldown filters exact type, status, month, and project values", () => {
  assert.deepEqual(drill({ focus: "type", value: "evidence" }).entries.map((entry) => entry.slug), ["evidence-a"]);
  assert.deepEqual(drill({ focus: "status", value: "complete" }).entries.map((entry) => entry.slug), ["evidence-a", "result-b"]);
  assert.deepEqual(drill({ focus: "month", value: "2026-02" }).entries.map((entry) => entry.slug), ["hypothesis-a", "evidence-a"]);
  assert.deepEqual(drill({ focus: "project", value: "beta" }).entries.map((entry) => entry.slug), ["result-b"]);
});

test("relationship drilldown returns explicit authored edges without inferring reverse edges", () => {
  const result = drill({ focus: "relation", value: "contradicts" });
  assert.equal(result.kind, "relations");
  assert.equal(result.count, 1);
  assert.equal(result.relations[0].source.slug, "result-b");
  assert.equal(result.relations[0].target.slug, "hypothesis-a");
  assert.equal(result.relations[0].relation.note, "Observed in beta.");
});

test("health drilldown respects both compiler condition and exact project", () => {
  assert.deepEqual(
    drill({ focus: "health", value: "unansweredQuestions", project: "alpha" }).entries.map((entry) => entry.slug),
    ["question-a"],
  );
  assert.equal(drill({ focus: "health", value: "unansweredQuestions", project: "beta" }).count, 0);
});

test("cross-project drilldown keeps exact source and target direction", () => {
  const alphaToBeta = drill({ focus: "cross-project", sourceProject: "alpha", targetProject: "beta" });
  const betaToAlpha = drill({ focus: "cross-project", sourceProject: "beta", targetProject: "alpha" });
  assert.deepEqual(alphaToBeta.relations.map((row) => [row.source.slug, row.target.slug, row.relation.type]), [["hypothesis-a", "result-b", "references"]]);
  assert.deepEqual(betaToAlpha.relations.map((row) => [row.source.slug, row.target.slug, row.relation.type]), [["result-b", "hypothesis-a", "contradicts"]]);
});

test("evidence signal summary counts only explicit signals authored from Evidence objects", () => {
  const summary = buildEvidenceSignalSummary(entries);
  assert.deepEqual(summary, {
    evidence: 1,
    signals: 2,
    supports: 1,
    contradicts: 0,
    answers: 1,
    targetsWithSignals: 2,
    targetsWithoutSignals: 1,
  });

  assert.deepEqual(drill({ focus: "evidence-signal", value: "supports" }).entries.map((entry) => entry.slug), ["hypothesis-a"]);
  assert.deepEqual(drill({ focus: "evidence-signal", value: "with" }).entries.map((entry) => entry.slug), ["question-a", "hypothesis-a"]);
  assert.deepEqual(drill({ focus: "evidence-signal", value: "without" }).entries.map((entry) => entry.slug), ["result-b"]);
});

test("normalization rejects unknown analytics focus instead of broadening selection", () => {
  assert.deepEqual(normalizeAnalyticsDrilldown({ focus: "quality", value: "bad" }), {
    focus: "",
    value: "bad",
    project: "",
    sourceProject: "",
    targetProject: "",
  });
  assert.equal(drill({ focus: "quality", value: "bad" }), null);
});
