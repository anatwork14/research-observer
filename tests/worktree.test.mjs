import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  allResearchPaths,
  captureTreeFileStates,
  changedFileStates,
  collectResearchDiff,
  runGit,
} from "../lib/codex/worktree.mjs";

async function git(root, args) {
  const result = await runGit(root, args);
  assert.equal(result.code, 0, result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-worktree-"));
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "observaire@example.test"]);
  await git(root, ["config", "user.name", "Observaire Test"]);
  await fs.mkdir(path.join(root, "research-data"), { recursive: true });
  await fs.writeFile(path.join(root, "research-data", "base.md"), "head base\n", "utf8");
  await fs.writeFile(path.join(root, "README.md"), "fixture\n", "utf8");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "fixture"]);
  return root;
}

test("research path validation follows the configured repository-relative source root", () => {
  assert.equal(allResearchPaths(["research-data/00_note.md"], "research-data"), true);
  assert.equal(allResearchPaths(["research-data/nested/01_note.md"], "research-data"), true);
  assert.equal(allResearchPaths(["research-data/AGENTS.md"], "research-data"), false);
  assert.equal(allResearchPaths(["README.md"], "research-data"), false);
});

test("Codex diff compares against the staged live research snapshot rather than HEAD", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  // This represents the filesystem-first state at the moment Act starts: one
  // tracked note is locally edited and one imported note is still untracked.
  await fs.writeFile(path.join(root, "research-data", "base.md"), "live baseline\n", "utf8");
  await fs.writeFile(path.join(root, "research-data", "imported.md"), "imported baseline\n", "utf8");
  await git(root, ["add", "-A", "--", "research-data"]);
  const baselineTree = await git(root, ["write-tree"]);

  const baseline = await captureTreeFileStates(root, baselineTree, [
    "research-data/base.md",
    "research-data/imported.md",
    "research-data/new.md",
  ]);
  assert.match(baseline["research-data/base.md"] ?? "", /^[0-9a-f]{40,64}$/i);
  assert.match(baseline["research-data/imported.md"] ?? "", /^[0-9a-f]{40,64}$/i);
  assert.equal(baseline["research-data/new.md"], null);

  // Simulate Codex edits, including an accidental git add. Act restores the
  // frozen baseline index before collecting the human-review patch.
  await fs.writeFile(path.join(root, "research-data", "base.md"), "codex base\n", "utf8");
  await fs.writeFile(path.join(root, "research-data", "imported.md"), "codex imported\n", "utf8");
  await fs.writeFile(path.join(root, "research-data", "new.md"), "codex new\n", "utf8");
  await git(root, ["add", "--", "research-data/base.md"]);
  await git(root, ["read-tree", baselineTree]);

  const diff = await collectResearchDiff(root, "research-data");
  assert.equal(diff.allowed, true);
  assert.equal(diff.reviewable, true);
  assert.deepEqual([...diff.files].sort(), [
    "research-data/base.md",
    "research-data/imported.md",
    "research-data/new.md",
  ]);
  assert.match(diff.patch, /-live baseline/);
  assert.match(diff.patch, /\+codex base/);
  assert.match(diff.patch, /-imported baseline/);
  assert.match(diff.patch, /\+codex imported/);
  assert.match(diff.patch, /\+codex new/);
  assert.doesNotMatch(diff.patch, /-head base/);

  // Apply conflict detection accepts the exact reviewed baseline even though it
  // differs from HEAD, then detects only changes made after review.
  await git(root, ["checkout", "--", "research-data/base.md", "research-data/imported.md"]);
  await fs.rm(path.join(root, "research-data", "new.md"), { force: true });
  assert.deepEqual(await changedFileStates(root, baseline), []);

  await fs.writeFile(path.join(root, "research-data", "base.md"), "changed after review\n", "utf8");
  await fs.writeFile(path.join(root, "research-data", "new.md"), "occupied after review\n", "utf8");
  assert.deepEqual((await changedFileStates(root, baseline)).sort(), [
    "research-data/base.md",
    "research-data/new.md",
  ]);
});
