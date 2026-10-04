import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyResearchScaffold,
  previewResearchScaffold,
} from "../lib/research/new-research-scaffold.mjs";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";

const plan = {
  overview: "Selected literature suggests a retrieval comparison is worth testing, but no result is established.",
  sources: [{
    sourceId: "paper-1",
    title: "Retrieval systems study",
    authors: ["A. Researcher"],
    year: 2026,
    journal: "Journal of Retrieval",
    doi: "10.1234/retrieval",
    url: "https://example.org/retrieval",
  }],
  researchGaps: [{
    title: "Latency-constrained evidence gap",
    rationale: "The selected packet does not establish the effect under a fixed latency budget.",
    sourceIds: ["paper-1"],
  }],
  hypotheses: [{
    title: "Reranking improves recall",
    statement: "Reranking increases recall at a fixed latency budget.",
    falsificationCriterion: "Recall does not improve or latency exceeds the fixed budget.",
    derivedFromGaps: ["Latency-constrained evidence gap"],
    sourceIds: ["paper-1"],
  }],
  experiments: [{
    title: "Reranking latency experiment",
    hypothesisTitle: "Reranking improves recall",
    design: "Compare baseline retrieval and reranking under the same serving budget.",
    independentVariables: ["reranking enabled"],
    dependentVariables: ["recall", "latency"],
    controls: ["dataset", "hardware"],
    metrics: ["Recall@10", "p95 latency"],
    confounders: ["cache state"],
    stoppingCriteria: ["planned sample complete"],
  }],
  nextActions: ["Review the metric definitions before execution."],
  cautions: ["Consensus discovery metadata is not proof of the hypothesis."],
};

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-new-research-scaffold-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = path.join(root, "progress", "Existing Study");
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
    progressDir: "progress",
    warnOnMissingId: true,
    strictVocabulary: true,
    allowedTypes: ["question", "note", "hypothesis", "experiment", "evidence"],
    allowedStatuses: ["idea", "investigating", "complete"],
    allowedRelationshipTypes: ["derived_from", "investigates", "supports", "contradicts", "answers"],
    allowedMediaExtensions: [".pdf"],
    maxAssetBytes: 1048576,
    researchProjects: [{ id: "default", label: "Main research" }],
    savedCollections: [],
  }, null, 2));
  await fs.writeFile(path.join(project, "00_seed.md"), [
    "---",
    "id: existing-seed",
    "title: Existing seed",
    "summary: Existing project seed.",
    "type: question",
    "status: investigating",
    "---",
    "",
    "# Existing seed",
    "",
  ].join("\n"));
  return root;
}

test("scaffold preview is deterministic, reviewable, and does not promote discovery sources to Evidence", async (t) => {
  const root = await fixture(t);
  const input = {
    rootDir: root,
    topic: "Does reranking improve retrieval recall?",
    objective: "Test recall gains without exceeding a serving latency budget.",
    plan,
    target: { mode: "new", projectLabel: "Reranking Study", projectDescription: "Reviewed scaffold fixture." },
  };
  const first = await previewResearchScaffold(input);
  const second = await previewResearchScaffold(input);

  assert.equal(first.proposalHash, second.proposalHash);
  assert.equal(first.target.projectId, "reranking-study");
  assert.equal(first.manifest?.filename, "Reranking Study/.observaire-project.json");
  assert.equal(first.summary.notes, 4);
  assert.equal(first.summary.hypotheses, 1);
  assert.equal(first.summary.experiments, 1);
  assert.equal(first.summary.evidenceObjects, 0);
  assert.equal(first.summary.semanticEvidenceRelationships, 0);
  assert.equal(first.files.some((file) => file.type === "evidence"), false);
  assert.equal(first.files.some((file) => file.relationships.some((relation) => ["supports", "contradicts", "answers"].includes(relation.type))), false);
  const planningNote = first.files.find((file) => file.kind === "plan");
  assert.match(planningNote?.content ?? "", /Consensus metadata and model-generated synthesis remain discovery\/planning context/);
  assert.match(planningNote?.content ?? "", /DOI 10\.1234\/retrieval/);
});

test("reviewed scaffold apply creates a compiler-indexed folder project and only explicit planning relationships", async (t) => {
  const root = await fixture(t);
  const input = {
    rootDir: root,
    topic: "Does reranking improve retrieval recall?",
    objective: "Test recall gains without exceeding a serving latency budget.",
    plan,
    target: { mode: "new", projectLabel: "Reranking Study", projectDescription: "Reviewed scaffold fixture." },
  };
  const preview = await previewResearchScaffold(input);
  const result = await applyResearchScaffold({
    ...input,
    expectedWorkspaceSignature: preview.workspaceSignature,
    expectedProposalHash: preview.proposalHash,
  });
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const project = workspace.projects.find((item) => item.id === "reranking-study");
  const notes = workspace.entries.filter((item) => item.research === "reranking-study");
  const hypothesis = notes.find((item) => item.type === "hypothesis");
  const experiment = notes.find((item) => item.type === "experiment");

  assert.equal(result.project.created, true);
  assert.equal(project?.notes, 4);
  assert.equal(notes.length, 4);
  assert.equal(notes.some((item) => item.type === "evidence"), false);
  assert.equal(hypothesis?.relationships.some((relation) => relation.type === "derived_from"), true);
  assert.equal(experiment?.relationships.some((relation) => relation.type === "investigates" && relation.target === hypothesis?.id), true);
  assert.equal(notes.some((item) => item.relationships.some((relation) => ["supports", "contradicts", "answers"].includes(relation.type))), false);
  assert.equal(await fs.readFile(path.join(root, "progress", "Reranking Study", ".observaire-project.json"), "utf8").then((value) => value.includes('"id": "reranking-study"')), true);
});

test("existing-project scaffold appends after current notes and stale workspace changes block apply", async (t) => {
  const root = await fixture(t);
  const input = {
    rootDir: root,
    topic: "Existing project follow-up",
    objective: "Add a reviewed follow-up plan.",
    plan,
    target: { mode: "existing", projectId: "existing-study" },
  };
  const preview = await previewResearchScaffold(input);
  assert.equal(preview.files[0].filename, "Existing Study/01_existing-project-follow-up.md");

  await fs.writeFile(path.join(root, "progress", "Existing Study", "99_external-change.md"), [
    "---",
    "id: external-change",
    "title: External change",
    "summary: Changes the workspace after preview.",
    "type: note",
    "status: idea",
    "---",
    "",
    "# External change",
    "",
  ].join("\n"));

  await assert.rejects(
    () => applyResearchScaffold({
      ...input,
      expectedWorkspaceSignature: preview.workspaceSignature,
      expectedProposalHash: preview.proposalHash,
    }),
    (error) => error?.code === "SCAFFOLD_STALE",
  );

  await assert.rejects(
    fs.stat(path.join(root, "progress", "Existing Study", "01_existing-project-follow-up.md")),
    (error) => error?.code === "ENOENT",
  );
});
