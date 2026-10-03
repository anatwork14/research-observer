import test from "node:test";
import assert from "node:assert/strict";
import { buildResearchOrchestration } from "../lib/research/orchestration.mjs";

function project(id, overrides = {}) {
  return {
    id,
    label: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    notes: 2,
    active: 1,
    questions: 0,
    hypotheses: 1,
    literature: 0,
    experiments: 1,
    results: 0,
    evidence: 0,
    evaluations: 0,
    decisions: 0,
    words: 100,
    relationships: 0,
    crossProjectRelationships: 0,
    errors: 0,
    warnings: 0,
    ...overrides,
  };
}

function configProject(id, orchestration) {
  return { id, label: project(id).label, ...(orchestration === undefined ? {} : { orchestration }) };
}

function workspace({ projects, configProjects, entries = [] }) {
  return {
    projects,
    entries,
    config: { researchProjects: configProjects },
  };
}

test("declared status is preserved while dependency waiting is derived separately", () => {
  const model = buildResearchOrchestration(workspace({
    projects: [project("retrieval"), project("evaluation")],
    configProjects: [
      configProject("retrieval", { status: "active", dependsOn: ["evaluation"], next: "Run benchmark" }),
      configProject("evaluation", { status: "queued" }),
    ],
  }));

  const retrieval = model.projects.find((item) => item.id === "retrieval");
  assert.equal(retrieval.orchestrationStatus, "active");
  assert.equal(retrieval.dependencyState, "waiting");
  assert.deepEqual(retrieval.waitingOn.map((item) => item.id), ["evaluation"]);
  assert.equal(model.summary.active, 1);
  assert.equal(model.summary.waiting, 1);
});

test("done dependencies clear waiting without changing the declared source status", () => {
  const model = buildResearchOrchestration(workspace({
    projects: [project("retrieval"), project("evaluation")],
    configProjects: [
      configProject("retrieval", { status: "queued", dependsOn: ["evaluation"] }),
      configProject("evaluation", { status: "done" }),
    ],
  }));

  const retrieval = model.projects.find((item) => item.id === "retrieval");
  assert.equal(retrieval.orchestrationStatus, "queued");
  assert.equal(retrieval.dependencyState, "clear");
  assert.equal(retrieval.waitingOn.length, 0);
  assert.equal(model.summary.queued, 1);
  assert.equal(model.summary.done, 1);
});

test("untracked projects remain visible and dated activity is factual", () => {
  const model = buildResearchOrchestration(workspace({
    projects: [project("alpha")],
    configProjects: [configProject("alpha")],
    entries: [
      { slug: "older", title: "Older", research: "alpha", date: "2026-01-01", order: 1, type: "question" },
      { slug: "latest", title: "Latest", research: "alpha", date: "2026-03-01", order: 2, type: "result" },
      { slug: "undated", title: "Undated", research: "alpha", order: 3, type: "note" },
    ],
  }));

  assert.equal(model.projects[0].tracked, false);
  assert.equal(model.projects[0].orchestrationStatus, "untracked");
  assert.deepEqual(model.projects[0].latestActivity.map((item) => item.slug), ["latest", "older"]);
  assert.equal(model.summary.untracked, 1);
});

test("missing and self dependencies are explicit invalid states", () => {
  const model = buildResearchOrchestration(workspace({
    projects: [project("alpha"), project("beta")],
    configProjects: [
      configProject("alpha", { status: "active", dependsOn: ["alpha", "missing-project"] }),
      configProject("beta", { status: "done" }),
    ],
  }));

  const alpha = model.projects.find((item) => item.id === "alpha");
  assert.equal(alpha.orchestrationStatus, "active");
  assert.equal(alpha.dependencyState, "invalid");
  assert.ok(model.issues.some((issue) => issue.code === "orchestration-self-dependency"));
  assert.ok(model.issues.some((issue) => issue.code === "orchestration-dependency-missing"));
  assert.equal(model.summary.invalid, 1);
});

test("dependency cycles are reported without rewriting declared statuses", () => {
  const model = buildResearchOrchestration(workspace({
    projects: [project("alpha"), project("beta"), project("gamma")],
    configProjects: [
      configProject("alpha", { status: "active", dependsOn: ["beta"] }),
      configProject("beta", { status: "queued", dependsOn: ["gamma"] }),
      configProject("gamma", { status: "blocked", dependsOn: ["alpha"] }),
    ],
  }));

  assert.ok(model.issues.some((issue) => issue.code === "orchestration-cycle"));
  assert.deepEqual(
    model.projects.map((item) => [item.id, item.orchestrationStatus, item.dependencyState]),
    [
      ["alpha", "active", "invalid"],
      ["beta", "queued", "invalid"],
      ["gamma", "blocked", "invalid"],
    ],
  );
});

test("selected scope keeps dependency context for a target outside the visible scope", () => {
  const model = buildResearchOrchestration(workspace({
    projects: [project("alpha"), project("beta")],
    configProjects: [
      configProject("alpha", { status: "active", dependsOn: ["beta"] }),
      configProject("beta", { status: "queued" }),
    ],
  }), ["alpha"]);

  assert.deepEqual(model.projects.map((item) => item.id), ["alpha"]);
  assert.equal(model.projects[0].dependencies[0].id, "beta");
  assert.equal(model.projects[0].dependencies[0].selected, false);
  assert.equal(model.projects[0].dependencyState, "waiting");
  assert.deepEqual(model.edges.map((edge) => [edge.source, edge.target, edge.targetSelected]), [["alpha", "beta", false]]);
});

test("invalid orchestration status does not become an invented workflow state", () => {
  const model = buildResearchOrchestration(workspace({
    projects: [project("alpha")],
    configProjects: [configProject("alpha", { status: "urgent" })],
  }));

  assert.equal(model.projects[0].orchestrationStatus, "untracked");
  assert.equal(model.projects[0].tracked, false);
  assert.ok(model.issues.some((issue) => issue.code === "orchestration-status-invalid"));
});
