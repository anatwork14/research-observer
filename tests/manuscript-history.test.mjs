import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { listManuscriptRevisions } from "../lib/research/manuscript-history.mjs";

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("manuscript history preserves renamed source paths and dirty filenames with spaces", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-manuscript-history-"));
  try {
    const manuscriptRoot = path.join(root, "manuscripts", "default");
    await fs.mkdir(manuscriptRoot, { recursive: true });
    await fs.writeFile(path.join(manuscriptRoot, "main.tex"), "\\documentclass{article}\n\\begin{document}\nDraft\n\\end{document}\n", "utf8");

    git(root, "init");
    git(root, "config", "user.name", "Observaire Test");
    git(root, "config", "user.email", "observaire@example.invalid");
    git(root, "add", "manuscripts/default/main.tex");
    git(root, "commit", "-m", "Initial manuscript");

    git(root, "mv", "manuscripts/default/main.tex", "manuscripts/default/paper draft.tex");
    git(root, "add", "-A", "manuscripts/default");
    git(root, "commit", "-m", "Rename manuscript source");

    await fs.appendFile(path.join(manuscriptRoot, "paper draft.tex"), "% working tree change\n", "utf8");

    const history = await listManuscriptRevisions({ rootDir: root, projectId: "default" });
    assert.equal(history.available, true);
    assert.deepEqual(history.dirtyFiles, ["paper draft.tex"]);

    const renameRevision = history.revisions.find((revision) => revision.subject === "Rename manuscript source");
    assert.ok(renameRevision);
    assert.deepEqual(
      renameRevision.files.map((item) => item.file).sort(),
      ["main.tex", "paper draft.tex"],
    );
    assert.ok(renameRevision.added > 0);
    assert.ok(renameRevision.removed > 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
