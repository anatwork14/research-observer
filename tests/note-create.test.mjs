import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createResearchNote } from "../lib/research/note-create.mjs";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";

test("new notes are created in the selected folder-backed project and compiler-indexed", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-note-create-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = path.join(root, "progress", "Retrieval Study");
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
    progressDir: "progress",
    warnOnMissingId: true,
    strictVocabulary: true,
    allowedTypes: ["question", "note"],
    allowedStatuses: ["idea", "complete", "investigating"],
    allowedRelationshipTypes: [],
    allowedMediaExtensions: [".pdf"],
    maxAssetBytes: 1048576,
    researchProjects: [{ id: "default", label: "Main research" }],
    savedCollections: [],
  }));
  await fs.writeFile(path.join(project, "00_question.md"), [
    "---", "id: retrieval-question", "title: Retrieval question", "summary: Main project question.",
    "type: question", "status: investigating", "---", "", "# Retrieval question", "",
  ].join("\n"));

  const result = await createResearchNote({
    rootDir: root,
    title: "Follow-up method",
    summary: "Records the next method question.",
    type: "note",
    research: "retrieval-study",
    body: "Compare the candidate methods.",
  });
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const entry = workspace.entries.find((item) => item.slug === result.slug);
  assert.equal(result.filename, "Retrieval Study/01_follow-up-method.md");
  assert.equal(entry?.research, "retrieval-study");
  assert.equal(entry?.type, "note");
  assert.match(entry?.content ?? "", /# Follow-up method/);
  assert.match(entry?.content ?? "", /Compare the candidate methods\./);
});
