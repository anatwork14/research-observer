import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  previewOrchestrationConfig,
  readOrchestrationEditorState,
  saveOrchestrationConfig,
} from "../lib/research/orchestration-config.mjs";

test("malformed authored orchestration can be reviewed and removed as Untracked", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-orchestration-recovery-"));
  try {
    await fs.mkdir(path.join(root, "progress"), { recursive: true });
    await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
      schemaVersion: 1,
      progressDir: "progress",
      researchProjects: [
        { id: "alpha", label: "Alpha", description: "Keep me", orchestration: null },
      ],
    }, null, 2) + "\n", "utf8");
    await fs.writeFile(path.join(root, "progress", "00_alpha.md"), "---\nid: alpha-note\nresearch: alpha\ntype: note\nstatus: idea\n---\n# Alpha\n", "utf8");

    const state = await readOrchestrationEditorState({ rootDir: root });
    assert.equal(state.projects.find((item) => item.id === "alpha").orchestration, null);

    const preview = await previewOrchestrationConfig({
      rootDir: root,
      projectId: "alpha",
      baseSha256: state.baseSha256,
      orchestration: null,
    });
    assert.equal(preview.preview.valid, true);
    assert.equal(preview.preview.project.status, "untracked");
    assert.deepEqual(preview.preview.changes, [
      { field: "orchestration", before: "Invalid metadata", after: "untracked" },
    ]);

    await saveOrchestrationConfig({
      rootDir: root,
      projectId: "alpha",
      baseSha256: state.baseSha256,
      orchestration: null,
    });
    const config = JSON.parse(await fs.readFile(path.join(root, "research-observer.config.json"), "utf8"));
    assert.equal(config.researchProjects[0].description, "Keep me");
    assert.equal("orchestration" in config.researchProjects[0], false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
