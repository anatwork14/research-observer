import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { allManuscriptPaths } from "../lib/codex/worktree.mjs";
import {
  createLatexSource,
  listLatexWorkspace,
  readLatexSource,
  setLatexFileHidden,
} from "../lib/research/latex-ide.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-latex-custom-root-"));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
  await fs.writeFile(
    path.join(root, "research-observer.config.json"),
    JSON.stringify({ manuscriptsDir: "workspace/authored-manuscripts" }),
    "utf8",
  );
  return root;
}

test("LaTeX IDE honors a nested custom manuscriptsDir", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const created = await createLatexSource({
    rootDir: root,
    projectId: "default",
    file: "chapters/results.tex",
    content: "Results from custom root.\n",
  });
  assert.equal(created.file, "chapters/results.tex");

  const customFile = path.join(root, "workspace", "authored-manuscripts", "default", "chapters", "results.tex");
  await fs.access(customFile);
  await assert.rejects(fs.access(path.join(root, "manuscripts", "default", "chapters", "results.tex")));

  const workspace = await listLatexWorkspace({ rootDir: root, projectId: "default" });
  assert.ok(workspace.files.some((file) => file.path === "chapters/results.tex" && !file.hidden));

  const hidden = await setLatexFileHidden({
    rootDir: root,
    projectId: "default",
    file: "chapters/results.tex",
    hidden: true,
  });
  assert.equal(hidden.files.find((file) => file.path === "chapters/results.tex")?.hidden, true);
  await fs.access(customFile);

  await setLatexFileHidden({ rootDir: root, projectId: "default", file: "chapters/results.tex", hidden: false });
  const reopened = await readLatexSource({ rootDir: root, projectId: "default", file: "chapters/results.tex" });
  assert.equal(reopened.content, "Results from custom root.\n");
});

test("Codex manuscript scope guards support the configured nested root without widening scope", () => {
  const manuscriptPath = "workspace/authored-manuscripts/default";
  assert.equal(allManuscriptPaths([
    "workspace/authored-manuscripts/default/main.tex",
    "workspace/authored-manuscripts/default/references.bib",
  ], manuscriptPath), true);
  assert.equal(allManuscriptPaths([
    "workspace/authored-manuscripts/other/main.tex",
  ], manuscriptPath), false);
  assert.equal(allManuscriptPaths([
    "workspace/authored-manuscripts/default/figure.png",
  ], manuscriptPath), false);
});
