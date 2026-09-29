import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { allManuscriptPaths, collectManuscriptDiff, noHiddenManuscriptPaths } from "../lib/codex/worktree.mjs";

function git(cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({
      code: code ?? 1,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

async function repoFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-manuscript-scope-"));
  assert.equal((await git(root, ["init", "-q"])).code, 0);
  await git(root, ["config", "user.name", "Observaire Test"]);
  await git(root, ["config", "user.email", "test@example.invalid"]);
  await git(root, ["config", "commit.gpgsign", "false"]);
  await fs.mkdir(path.join(root, "manuscripts", "demo"), { recursive: true });
  await fs.writeFile(path.join(root, "manuscripts", "demo", "main.tex"), "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n", "utf8");
  await fs.writeFile(path.join(root, "README.md"), "fixture\n", "utf8");
  assert.equal((await git(root, ["add", "."])).code, 0);
  const commit = await git(root, ["commit", "-qm", "fixture"]);
  assert.equal(commit.code, 0, commit.stderr);
  return root;
}

test("manuscript proposal paths stay inside one project and only allow editable source", () => {
  assert.equal(allManuscriptPaths([
    "manuscripts/demo/main.tex",
    "manuscripts/demo/references.bib",
    "manuscripts/demo/styles/local.sty",
    "manuscripts/demo/class/custom.cls",
    "manuscripts/demo/bib/plain.bst",
  ], "manuscripts/demo"), true);

  assert.equal(allManuscriptPaths(["manuscripts/other/main.tex"], "manuscripts/demo"), false);
  assert.equal(allManuscriptPaths(["manuscripts/demo/.observaire-ide.json"], "manuscripts/demo"), false);
  assert.equal(allManuscriptPaths(["manuscripts/demo/AGENTS.md"], "manuscripts/demo"), false);
  assert.equal(allManuscriptPaths(["manuscripts/demo/figure.png"], "manuscripts/demo"), false);
  assert.throws(() => allManuscriptPaths(["../outside.tex"], "manuscripts/demo"), /inside the repository/);
  assert.equal(noHiddenManuscriptPaths(["manuscripts/demo/hidden.tex"], ["manuscripts/demo/hidden.tex"]), false);
  assert.equal(noHiddenManuscriptPaths(["manuscripts/demo/main.tex"], ["manuscripts/demo/hidden.tex"]), true);
});

test("reviewable manuscript diff supports source edits and additions", async (t) => {
  const root = await repoFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.writeFile(path.join(root, "manuscripts", "demo", "main.tex"), "\\documentclass{article}\n\\begin{document}\nRevised\n\\end{document}\n", "utf8");
  await fs.writeFile(path.join(root, "manuscripts", "demo", "references.bib"), "@misc{demo, title={Demo}}\n", "utf8");

  const diff = await collectManuscriptDiff(root, "manuscripts/demo");
  assert.equal(diff.allowed, true);
  assert.equal(diff.reviewable, true);
  assert.equal(diff.destructive, false);
  assert.equal(diff.binary, false);
  assert.deepEqual(new Set(diff.files), new Set([
    "manuscripts/demo/main.tex",
    "manuscripts/demo/references.bib",
  ]));
  assert.match(diff.patch, /Revised/);
});

test("physical manuscript deletion is visible but never reviewable", async (t) => {
  const root = await repoFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.rm(path.join(root, "manuscripts", "demo", "main.tex"));
  const diff = await collectManuscriptDiff(root, "manuscripts/demo");
  assert.equal(diff.allowed, true);
  assert.equal(diff.destructive, true);
  assert.equal(diff.reviewable, false);
  assert.match(diff.patch, /deleted file mode/);
});

test("a change outside the reviewed manuscript project invalidates the proposal", async (t) => {
  const root = await repoFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.writeFile(path.join(root, "README.md"), "changed outside manuscript scope\n", "utf8");
  const diff = await collectManuscriptDiff(root, "manuscripts/demo");
  assert.equal(diff.allowed, false);
  assert.equal(diff.files.includes("README.md"), true);
});
