import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { latexBuildRetention, pruneLatexBuilds } from "../lib/research/latex-retention.mjs";

async function mkdir(root, relative) {
  await fs.mkdir(path.join(root, ...relative.split("/")), { recursive: true });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

test("LaTeX retention clamps configuration to safe bounds", () => {
  assert.equal(latexBuildRetention(undefined), 12);
  assert.equal(latexBuildRetention("1"), 2);
  assert.equal(latexBuildRetention("7"), 7);
  assert.equal(latexBuildRetention("1000"), 100);
  assert.equal(latexBuildRetention("invalid"), 12);
});

test("LaTeX retention removes old transient and public build directories together", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-latex-retention-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const project = "default";
  const builds = [
    "20260928120000-a1111111",
    "20260928130000-b2222222",
    "20260928140000-c3333333",
    "20260928150000-d4444444",
  ];

  for (const build of builds) {
    await mkdir(root, `.research-observer/latex-builds/${project}/${build}`);
    await fs.writeFile(path.join(root, ".research-observer", "latex-builds", project, build, "build.json"), "{}\n", "utf8");
  }
  for (const build of builds.slice(0, 3)) {
    await mkdir(root, `public/_research/latex/${project}/${build}`);
    await fs.writeFile(path.join(root, "public", "_research", "latex", project, build, "main.pdf"), "%PDF\n", "utf8");
  }

  const result = await pruneLatexBuilds({ rootDir: root, projectId: project, keep: 2 });
  assert.deepEqual(result.retained, builds.slice(-2).reverse());
  assert.deepEqual(result.removed, builds.slice(0, 2).reverse());

  for (const build of builds.slice(0, 2)) {
    assert.equal(await exists(path.join(root, ".research-observer", "latex-builds", project, build)), false);
    assert.equal(await exists(path.join(root, "public", "_research", "latex", project, build)), false);
  }
  for (const build of builds.slice(-2)) {
    assert.equal(await exists(path.join(root, ".research-observer", "latex-builds", project, build)), true);
  }
});
