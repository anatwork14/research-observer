import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  configureLatexWorkspace,
  createLatexSource,
  listLatexWorkspace,
  readLatexSource,
  saveLatexSource,
  setLatexFileHidden,
} from "../lib/research/latex-ide.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-latex-"));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({ manuscriptsDir: "manuscripts" }), "utf8");
  return root;
}

test("LaTeX sources use stale-write protection and reversible file hiding", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const created = await createLatexSource({
    rootDir: root,
    projectId: "default",
    file: "main.tex",
    content: "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n",
  });
  assert.equal(created.file, "main.tex");
  assert.ok(created.baseSha256);

  const configured = await configureLatexWorkspace({
    rootDir: root,
    projectId: "default",
    mainFile: "main.tex",
    engine: "xelatex",
  });
  assert.equal(configured.mainFile, "main.tex");
  assert.equal(configured.engine, "xelatex");

  const saved = await saveLatexSource({
    rootDir: root,
    projectId: "default",
    file: "main.tex",
    content: created.content.replace("Hello", "Hello research"),
    baseSha256: created.baseSha256,
  });
  assert.match(saved.content, /Hello research/);
  assert.notEqual(saved.baseSha256, created.baseSha256);

  await assert.rejects(
    saveLatexSource({
      rootDir: root,
      projectId: "default",
      file: "main.tex",
      content: "stale",
      baseSha256: created.baseSha256,
    }),
    (error) => error?.code === "LATEX_SOURCE_STALE",
  );

  const hidden = await setLatexFileHidden({ rootDir: root, projectId: "default", file: "main.tex", hidden: true });
  assert.equal(hidden.files.find((file) => file.path === "main.tex")?.hidden, true);
  assert.equal(hidden.mainFile, "");
  await fs.access(path.join(root, "manuscripts", "default", "main.tex"));

  const restored = await setLatexFileHidden({ rootDir: root, projectId: "default", file: "main.tex", hidden: false });
  assert.equal(restored.files.find((file) => file.path === "main.tex")?.hidden, false);
  assert.equal(restored.mainFile, "main.tex");
  const reopened = await readLatexSource({ rootDir: root, projectId: "default", file: "main.tex" });
  assert.match(reopened.content, /Hello research/);
});

test("LaTeX manuscript files live outside the Markdown progress compiler", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await createLatexSource({ rootDir: root, projectId: "default", file: "chapters/results.tex", content: "Results\n" });
  const workspace = await listLatexWorkspace({ rootDir: root, projectId: "default" });
  assert.ok(workspace.files.some((file) => file.path === "chapters/results.tex"));
  await assert.rejects(fs.access(path.join(root, "progress", "chapters", "results.tex")));
  await fs.access(path.join(root, "manuscripts", "default", "chapters", "results.tex"));
});
