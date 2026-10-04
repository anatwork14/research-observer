import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  orchestrationConfigWritable,
  previewOrchestrationConfig,
  readOrchestrationEditorState,
  saveOrchestrationConfig,
} from "../lib/research/orchestration-config.mjs";

async function fixture({ folderProject = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-orchestration-config-"));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
  const config = {
    schemaVersion: 1,
    progressDir: "progress",
    customObject: { preserved: true },
    researchProjects: [
      { id: "alpha", label: "Alpha", owner: "team-a", orchestration: { status: "active", dependsOn: ["beta"], next: "Run alpha" } },
      { id: "beta", label: "Beta", orchestration: { status: "queued" } },
      { id: "gamma", label: "Gamma" },
    ],
  };
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify(config, null, 2) + "\n", "utf8");
  await fs.writeFile(path.join(root, "progress", "00_alpha.md"), "---\nid: alpha-note\nresearch: alpha\ntype: question\nstatus: investigating\n---\n# Alpha\n", "utf8");
  await fs.writeFile(path.join(root, "progress", "01_beta.md"), "---\nid: beta-note\nresearch: beta\ntype: result\nstatus: complete\n---\n# Beta\n", "utf8");
  await fs.writeFile(path.join(root, "progress", "02_gamma.md"), "---\nid: gamma-note\nresearch: gamma\ntype: note\nstatus: idea\n---\n# Gamma\n", "utf8");
  if (folderProject) {
    const folder = path.join(root, "progress", "folder-research");
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, "00_question.md"), "---\nid: folder-question\ntype: question\nstatus: investigating\n---\n# Folder question\n", "utf8");
  }
  return root;
}

async function cleanup(root) {
  await fs.rm(root, { recursive: true, force: true });
}

test("editor state exposes a content hash and authored orchestration only", async () => {
  const root = await fixture();
  try {
    const state = await readOrchestrationEditorState({ rootDir: root });
    assert.match(state.baseSha256, /^[a-f0-9]{64}$/);
    assert.equal(state.projects.find((item) => item.id === "alpha").orchestration.status, "active");
    assert.equal(state.projects.find((item) => item.id === "gamma").orchestration, null);
  } finally {
    await cleanup(root);
  }
});

test("preview derives waiting context without writing config bytes", async () => {
  const root = await fixture();
  try {
    const before = await fs.readFile(path.join(root, "research-observer.config.json"), "utf8");
    const state = await readOrchestrationEditorState({ rootDir: root });
    const result = await previewOrchestrationConfig({
      rootDir: root,
      projectId: "gamma",
      baseSha256: state.baseSha256,
      orchestration: { status: "active", dependsOn: ["beta"], next: "Review gamma" },
    });
    assert.equal(result.preview.valid, true);
    assert.equal(result.preview.project.status, "active");
    assert.equal(result.preview.project.dependencyState, "waiting");
    assert.deepEqual(result.preview.project.waitingOn.map((item) => item.id), ["beta"]);
    assert.equal(await fs.readFile(path.join(root, "research-observer.config.json"), "utf8"), before);
  } finally {
    await cleanup(root);
  }
});

test("preview reports self, missing, and cycle dependencies without mutating declared status", async () => {
  const root = await fixture();
  try {
    const state = await readOrchestrationEditorState({ rootDir: root });
    const self = await previewOrchestrationConfig({
      rootDir: root,
      projectId: "alpha",
      baseSha256: state.baseSha256,
      orchestration: { status: "active", dependsOn: ["alpha"] },
    });
    assert.equal(self.preview.project.status, "active");
    assert.equal(self.preview.valid, false);
    assert.ok(self.preview.issues.some((item) => item.code === "orchestration-self-dependency"));

    const missing = await previewOrchestrationConfig({
      rootDir: root,
      projectId: "alpha",
      baseSha256: state.baseSha256,
      orchestration: { status: "active", dependsOn: ["does-not-exist"] },
    });
    assert.equal(missing.preview.valid, false);
    assert.ok(missing.preview.issues.some((item) => item.code === "orchestration-dependency-missing"));

    const cycle = await previewOrchestrationConfig({
      rootDir: root,
      projectId: "beta",
      baseSha256: state.baseSha256,
      orchestration: { status: "queued", dependsOn: ["alpha"] },
    });
    assert.equal(cycle.preview.valid, false);
    assert.ok(cycle.preview.issues.some((item) => item.code === "orchestration-cycle"));
  } finally {
    await cleanup(root);
  }
});

test("save preserves unrelated config fields and uses the reviewed explicit values", async () => {
  const root = await fixture();
  try {
    const state = await readOrchestrationEditorState({ rootDir: root });
    const result = await saveOrchestrationConfig({
      rootDir: root,
      projectId: "beta",
      baseSha256: state.baseSha256,
      orchestration: { status: "done", dependsOn: [], next: "Archive benchmark", note: "Validated locally" },
    });
    assert.equal(result.saved, true);
    assert.match(result.baseSha256, /^[a-f0-9]{64}$/);
    const saved = JSON.parse(await fs.readFile(path.join(root, "research-observer.config.json"), "utf8"));
    assert.deepEqual(saved.customObject, { preserved: true });
    assert.equal(saved.researchProjects.find((item) => item.id === "alpha").owner, "team-a");
    assert.deepEqual(saved.researchProjects.find((item) => item.id === "beta").orchestration, {
      status: "done",
      dependsOn: [],
      next: "Archive benchmark",
      note: "Validated locally",
    });
    const tempFiles = (await fs.readdir(root)).filter((name) => name.startsWith(".research-observer.config.json."));
    assert.deepEqual(tempFiles, []);
  } finally {
    await cleanup(root);
  }
});

test("removing orchestration previews and saves as Untracked without deleting project config", async () => {
  const root = await fixture();
  try {
    const state = await readOrchestrationEditorState({ rootDir: root });
    const preview = await previewOrchestrationConfig({ rootDir: root, projectId: "alpha", baseSha256: state.baseSha256, orchestration: null });
    assert.equal(preview.preview.valid, true);
    assert.equal(preview.preview.project.status, "untracked");
    assert.equal(preview.preview.project.dependencyState, "clear");

    await saveOrchestrationConfig({ rootDir: root, projectId: "alpha", baseSha256: state.baseSha256, orchestration: null });
    const saved = JSON.parse(await fs.readFile(path.join(root, "research-observer.config.json"), "utf8"));
    const alpha = saved.researchProjects.find((item) => item.id === "alpha");
    assert.equal(alpha.label, "Alpha");
    assert.equal(alpha.owner, "team-a");
    assert.equal("orchestration" in alpha, false);
  } finally {
    await cleanup(root);
  }
});

test("stale base hash rejects save without overwriting newer config bytes", async () => {
  const root = await fixture();
  try {
    const state = await readOrchestrationEditorState({ rootDir: root });
    const file = path.join(root, "research-observer.config.json");
    const newer = (await fs.readFile(file, "utf8")).replace('"preserved": true', '"preserved": "newer"');
    await fs.writeFile(file, newer, "utf8");
    await assert.rejects(
      () => saveOrchestrationConfig({
        rootDir: root,
        projectId: "beta",
        baseSha256: state.baseSha256,
        orchestration: { status: "done", dependsOn: [] },
      }),
      (error) => error?.code === "ORCHESTRATION_CONFIG_STALE",
    );
    assert.equal(await fs.readFile(file, "utf8"), newer);
  } finally {
    await cleanup(root);
  }
});

test("invalid draft shape and invalid workflow status are rejected before writes", async () => {
  const root = await fixture();
  try {
    const state = await readOrchestrationEditorState({ rootDir: root });
    await assert.rejects(
      () => previewOrchestrationConfig({ rootDir: root, projectId: "alpha", baseSha256: state.baseSha256, orchestration: { status: "urgent", dependsOn: [] } }),
      (error) => error?.code === "ORCHESTRATION_STATUS_INVALID",
    );
    await assert.rejects(
      () => previewOrchestrationConfig({ rootDir: root, projectId: "alpha", baseSha256: state.baseSha256, orchestration: { status: "active", dependsOn: "beta" } }),
      (error) => error?.code === "ORCHESTRATION_DEPENDENCIES_INVALID",
    );
  } finally {
    await cleanup(root);
  }
});

test("auto-discovered folder project receives config metadata only when explicitly edited", async () => {
  const root = await fixture({ folderProject: true });
  try {
    const beforeState = await readOrchestrationEditorState({ rootDir: root });
    const folder = beforeState.projects.find((item) => item.id === "folder-research");
    assert.equal(folder.autoIndexed, true);
    assert.equal(folder.configured, false);
    assert.equal(folder.orchestration, null);

    await saveOrchestrationConfig({
      rootDir: root,
      projectId: "folder-research",
      baseSha256: beforeState.baseSha256,
      orchestration: { status: "queued", dependsOn: [], next: "Review imported evidence" },
    });
    const saved = JSON.parse(await fs.readFile(path.join(root, "research-observer.config.json"), "utf8"));
    const record = saved.researchProjects.find((item) => item.id === "folder-research");
    assert.equal(record.label, "Folder Research");
    assert.equal(record.orchestration.status, "queued");
    const afterState = await readOrchestrationEditorState({ rootDir: root });
    const after = afterState.projects.find((item) => item.id === "folder-research");
    assert.equal(after.autoIndexed, true);
    assert.equal(after.configured, true);
  } finally {
    await cleanup(root);
  }
});

test("write policy is development-first and production requires explicit opt-in", () => {
  const beforeNodeEnv = process.env.NODE_ENV;
  const beforeWrites = process.env.RESEARCH_OBSERVER_WRITES;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.RESEARCH_OBSERVER_WRITES;
    assert.equal(orchestrationConfigWritable(), false);
    process.env.RESEARCH_OBSERVER_WRITES = "1";
    assert.equal(orchestrationConfigWritable(), true);
    process.env.NODE_ENV = "development";
    delete process.env.RESEARCH_OBSERVER_WRITES;
    assert.equal(orchestrationConfigWritable(), true);
  } finally {
    if (beforeNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = beforeNodeEnv;
    if (beforeWrites === undefined) delete process.env.RESEARCH_OBSERVER_WRITES;
    else process.env.RESEARCH_OBSERVER_WRITES = beforeWrites;
  }
});
