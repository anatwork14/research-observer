import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  loadHistoricalResearchEvidenceIndex,
  resolveHistoricalEvidenceSlug,
} from "../lib/research/historical-research-evidence.mjs";

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function writeNote(file, { id, type, research = "default", title = id }) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, [
    "---",
    ...(id === undefined ? [] : [`id: ${id}`]),
    `type: ${type}`,
    `research: ${research}`,
    `title: ${title || "Untitled"}`,
    "---",
    "",
    `# ${title || "Untitled"}`,
    "",
  ].join("\n"));
}

async function initRepo(prefix) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  git(root, "init");
  git(root, "config", "user.name", "Observaire Test");
  git(root, "config", "user.email", "observaire@example.invalid");
  return root;
}

test("historical Evidence resolution follows the exact progress snapshot at each commit", async () => {
  const root = await initRepo("observaire-historical-evidence-");
  try {
    await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({ progressDir: "history-progress" }, null, 2) + "\n");
    const note = path.join(root, "history-progress", "001_evidence.md");
    await writeNote(note, { id: "evidence-a", type: "evidence", title: "Historical Evidence A" });
    git(root, "add", ".");
    git(root, "commit", "-m", "Evidence exists");
    const validCommit = git(root, "rev-parse", "HEAD");

    let index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit: validCommit, projectId: "default" });
    assert.equal(index.progressPath, "history-progress");
    assert.equal(index.complete, true);
    assert.deepEqual(resolveHistoricalEvidenceSlug(index, "evidence-a"), {
      slug: "evidence-a",
      status: "valid",
      research: "default",
      type: "evidence",
      title: "Historical Evidence A",
      file: "001_evidence.md",
    });

    await writeNote(note, { id: "evidence-a", type: "literature", title: "Historical Literature A" });
    git(root, "add", ".");
    git(root, "commit", "-m", "Evidence became literature");
    const wrongTypeCommit = git(root, "rev-parse", "HEAD");
    index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit: wrongTypeCommit, projectId: "default" });
    assert.equal(resolveHistoricalEvidenceSlug(index, "evidence-a").status, "wrong-type");

    await fs.rm(note);
    git(root, "add", "-A");
    git(root, "commit", "-m", "Remove research object");
    const missingCommit = git(root, "rev-parse", "HEAD");
    index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit: missingCommit, projectId: "default" });
    assert.equal(resolveHistoricalEvidenceSlug(index, "evidence-a").status, "missing");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("historical Evidence resolution preserves folder-project precedence and duplicate ambiguity", async () => {
  const root = await initRepo("observaire-historical-evidence-project-");
  try {
    const progress = path.join(root, "progress");
    await fs.mkdir(path.join(progress, "alpha"), { recursive: true });
    await fs.writeFile(path.join(progress, "alpha", ".observaire-project.json"), JSON.stringify({ schemaVersion: 1, id: "alpha", label: "Alpha" }, null, 2) + "\n");
    await writeNote(path.join(progress, "alpha", "001_evidence.md"), {
      id: "shared-evidence",
      type: "evidence",
      research: "default",
      title: "Alpha Evidence",
    });
    git(root, "add", ".");
    git(root, "commit", "-m", "Add project Evidence");
    const crossProjectCommit = git(root, "rev-parse", "HEAD");

    let index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit: crossProjectCommit, projectId: "default" });
    const crossProject = resolveHistoricalEvidenceSlug(index, "shared-evidence");
    assert.equal(crossProject.status, "cross-project");
    assert.equal(crossProject.research, "alpha");
    assert.equal(resolveHistoricalEvidenceSlug(index, "shared-evidence", { projectId: "alpha" }).status, "valid");

    await writeNote(path.join(progress, "002_duplicate.md"), {
      id: "shared-evidence",
      type: "evidence",
      research: "default",
      title: "Default Duplicate",
    });
    git(root, "add", ".");
    git(root, "commit", "-m", "Duplicate slug");
    const duplicateCommit = git(root, "rev-parse", "HEAD");
    index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit: duplicateCommit, projectId: "default" });
    assert.equal(resolveHistoricalEvidenceSlug(index, "shared-evidence").status, "ambiguous");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("historical fallback slugs match compiler folder discovery and ignore import staging directories", async () => {
  const root = await initRepo("observaire-historical-evidence-discovery-");
  try {
    const progress = path.join(root, "progress");
    await writeNote(path.join(progress, "alpha", "001_fallback.md"), {
      id: undefined,
      type: "evidence",
      research: "default",
      title: "Folder fallback",
    });
    await writeNote(path.join(progress, ".private", "002_hidden-folder.md"), {
      id: undefined,
      type: "evidence",
      research: "default",
      title: "Undiscovered folder fallback",
    });
    await writeNote(path.join(progress, ".observaire-import-staging", "003_imported.md"), {
      id: "import-only-evidence",
      type: "evidence",
      research: "default",
      title: "Import staging",
    });
    git(root, "add", ".");
    git(root, "commit", "-m", "Compiler discovery edge cases");
    const commit = git(root, "rev-parse", "HEAD");
    const index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit, projectId: "default" });

    assert.equal(resolveHistoricalEvidenceSlug(index, "alpha-001_fallback", { projectId: "alpha" }).status, "valid");
    assert.equal(resolveHistoricalEvidenceSlug(index, "001_fallback").status, "missing");
    assert.equal(resolveHistoricalEvidenceSlug(index, "002_hidden-folder").status, "valid");
    assert.equal(resolveHistoricalEvidenceSlug(index, "default-002_hidden-folder").status, "missing");
    assert.equal(resolveHistoricalEvidenceSlug(index, "import-only-evidence").status, "missing");
    assert.equal(index.entries.some((entry) => entry.file.includes(".observaire-import-staging")), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("historical Evidence validation never reads a progressDir that escapes the repository", async () => {
  const root = await initRepo("observaire-historical-evidence-path-");
  try {
    await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({ progressDir: "../outside" }, null, 2) + "\n");
    await writeNote(path.join(root, "progress", "001_safe.md"), { id: "safe-evidence", type: "evidence" });
    git(root, "add", ".");
    git(root, "commit", "-m", "Unsafe configured path");
    const commit = git(root, "rev-parse", "HEAD");
    const index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit, projectId: "default" });
    assert.equal(index.progressPath, "progress");
    assert.equal(resolveHistoricalEvidenceSlug(index, "safe-evidence").status, "valid");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("an incomplete historical note scan yields unavailable rather than false validity or absence", async () => {
  const root = await initRepo("observaire-historical-evidence-bound-");
  try {
    const progress = path.join(root, "progress");
    await fs.mkdir(progress, { recursive: true });
    const oversized = [
      "---",
      "id: giant-evidence",
      "type: evidence",
      "research: default",
      "---",
      "",
      "x".repeat(2 * 1024 * 1024 + 64),
    ].join("\n");
    await fs.writeFile(path.join(progress, "001_giant.md"), oversized);
    git(root, "add", ".");
    git(root, "commit", "-m", "Oversized historical note");
    const commit = git(root, "rev-parse", "HEAD");
    const index = await loadHistoricalResearchEvidenceIndex({ rootDir: root, commit, projectId: "default" });
    assert.equal(index.available, true);
    assert.equal(index.complete, false);
    assert.equal(resolveHistoricalEvidenceSlug(index, "giant-evidence").status, "unavailable");
    assert.equal(resolveHistoricalEvidenceSlug(index, "definitely-missing").status, "unavailable");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
