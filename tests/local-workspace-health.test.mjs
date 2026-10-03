import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  classifyNodeRuntime,
  localMaintenanceEnabled,
  resolveLocalWorkspacePaths,
  summarizeLocalHealth,
} from "../lib/local-workspace-health.mjs";

test("resolveLocalWorkspacePaths keeps durable roots inside the repository", () => {
  const root = path.resolve("/tmp/observaire-health-test");
  const paths = resolveLocalWorkspacePaths(root, {
    progressDir: "research-data",
    annotationDir: "annotations-local",
    manuscriptsDir: "manuscripts-local",
  });

  assert.equal(paths.progress.path, path.join(root, "research-data"));
  assert.equal(paths.annotations.path, path.join(root, "annotations-local"));
  assert.equal(paths.manuscripts.path, path.join(root, "manuscripts-local"));
  assert.equal(paths.progress.valid, true);
});

test("resolveLocalWorkspacePaths rejects configured path escapes", () => {
  const root = path.resolve("/tmp/observaire-health-test");
  const paths = resolveLocalWorkspacePaths(root, { progressDir: "../outside" });

  assert.equal(paths.progress.valid, false);
  assert.equal(paths.progress.path, path.join(root, "progress"));
});

test("classifyNodeRuntime enforces the declared node engine window", () => {
  assert.equal(classifyNodeRuntime("22.13.0").state, "ready");
  assert.equal(classifyNodeRuntime("24.9.0").state, "ready");
  assert.equal(classifyNodeRuntime("22.12.9").state, "attention");
  assert.equal(classifyNodeRuntime("25.0.0").state, "attention");
});

test("local maintenance follows local-first write policy", () => {
  assert.equal(localMaintenanceEnabled({}, "development"), true);
  assert.equal(localMaintenanceEnabled({}, "production"), false);
  assert.equal(localMaintenanceEnabled({ OBSERVAIRE_LOCAL_MAINTENANCE: "1" }, "production"), true);
  assert.equal(localMaintenanceEnabled({ RESEARCH_OBSERVER_WRITES: "1" }, "production"), true);
});

test("summarizeLocalHealth separates attention from optional unavailable tools", () => {
  assert.deepEqual(
    summarizeLocalHealth([
      { state: "ready" },
      { state: "ready" },
      { state: "unavailable" },
    ]),
    { ready: 2, attention: 0, unavailable: 1, overall: "partial" },
  );

  assert.deepEqual(
    summarizeLocalHealth([
      { state: "ready" },
      { state: "attention" },
      { state: "unavailable" },
    ]),
    { ready: 1, attention: 1, unavailable: 1, overall: "attention" },
  );
});
