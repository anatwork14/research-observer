import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "../lib/research/compiler.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "research-observer-"));
  await fs.mkdir(path.join(root, "progress", "figures"), { recursive: true });
  await fs.writeFile(
    path.join(root, "research-observer.config.json"),
    JSON.stringify({
      progressDir: "progress",
      warnOnMissingId: true,
      allowedTypes: ["note", "question", "experiment", "result"],
      allowedStatuses: ["investigating", "validating", "complete"],
      allowedMediaExtensions: [".svg", ".png"],
      maxAssetBytes: 1048576,
      strictVocabulary: true
    })
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("compiler creates stable routes, relationships, assets and static indexes", async (t) => {
  const root = await fixture(t);

  const question = [
    "---",
    "id: retrieval-question",
    "title: Retrieval question",
    "type: question",
    "status: investigating",
    "tags:",
    "  - retrieval",
    "---",
    "",
    "# Retrieval question",
    "",
    "See [the result](01_result.md).",
    "",
    "![Recall curve](figures/recall.svg)",
    ""
  ].join("\n");

  const result = [
    "---",
    "id: retrieval-result",
    "title: Retrieval result",
    "type: result",
    "status: complete",
    "---",
    "",
    "# Retrieval result",
    "",
    "The result is recorded here.",
    ""
  ].join("\n");

  await Promise.all([
    fs.writeFile(path.join(root, "progress", "00_question.md"), question),
    fs.writeFile(path.join(root, "progress", "01_result.md"), result),
    fs.writeFile(path.join(root, "progress", "figures", "recall.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")
  ]);

  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  assert.equal(workspace.stats.errors, 0);
  assert.equal(workspace.entries.length, 2);

  const first = workspace.entries[0];
  const second = workspace.entries[1];
  assert.equal(first.slug, "retrieval-question");
  assert.ok(first.aliases.includes("00_question"));
  assert.deepEqual(first.linkedSlugs, ["retrieval-result"]);
  assert.deepEqual(second.backlinks, ["retrieval-question"]);
  assert.deepEqual(first.assets, ["figures/recall.svg"]);

  await writeResearchArtifacts({ rootDir: root, fresh: true });
  const index = JSON.parse(await fs.readFile(path.join(root, "public", "_research", "search.json"), "utf8"));
  assert.equal(index.entries[0].slug, "retrieval-question");
  assert.match(index.entries[0].text, /See the result/);
});

test("doctor diagnostics catch invalid metadata, broken links and missing assets", async (t) => {
  const root = await fixture(t);

  const invalid = [
    "---",
    "id: Invalid ID",
    "type: experiment",
    "status: finished-ish",
    "date: someday",
    "---",
    "",
    "# Broken experiment",
    "",
    "See [missing work](99_missing.md).",
    "",
    "![Missing figure](figures/missing.png)",
    ""
  ].join("\n");

  await fs.writeFile(path.join(root, "progress", "00_broken.md"), invalid);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const codes = new Set(workspace.diagnostics.filter((item) => item.severity === "error").map((item) => item.code));

  assert.ok(codes.has("id-invalid"));
  assert.ok(codes.has("status-unknown"));
  assert.ok(codes.has("date-invalid"));
  assert.ok(codes.has("link-broken"));
  assert.ok(codes.has("asset-missing"));
  assert.ok(workspace.stats.errors >= 5);
});
