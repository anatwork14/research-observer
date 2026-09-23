import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvidenceNote } from "../lib/research/evidence-write.mjs";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";

test("evidence capture writes a validated Markdown evidence object", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "research-observer-evidence-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "progress", "papers"), { recursive: true });
  await fs.writeFile(
    path.join(root, "research-observer.config.json"),
    JSON.stringify({
      progressDir: "progress",
      warnOnMissingId: true,
      strictVocabulary: true,
      allowedTypes: ["question", "evidence"],
      allowedStatuses: ["investigating", "complete"],
      allowedRelationshipTypes: ["supports"],
      allowedMediaExtensions: [".pdf"],
      researchProjects: [
        { id: "default", label: "Main research" },
        { id: "retrieval", label: "Retrieval study" }
      ],
      maxAssetBytes: 1048576,
      savedCollections: []
    })
  );
  await fs.writeFile(
    path.join(root, "progress", "00_question.md"),
    [
      "---",
      "id: target-question",
      "type: question",
      "status: investigating",
      "research: retrieval",
      "---",
      "",
      "# Target question",
      ""
    ].join("\n")
  );
  await fs.writeFile(path.join(root, "progress", "papers", "fixture.pdf"), "%PDF-1.4\n");

  const created = await createEvidenceNote({
    rootDir: root,
    paperPath: "papers/fixture.pdf",
    page: 3,
    quote: "This is a verified fixture excerpt.",
    comment: "Useful for the target question.",
    relationship: { type: "supports", target: "target-question" }
  });

  assert.match(created.filename, /^01_evidence_fixture_p3_[a-f0-9]{8}\.md$/);
  const content = await fs.readFile(path.join(root, "progress", created.filename), "utf8");
  assert.match(content, /type: evidence/);
  assert.match(content, /research: retrieval/);
  assert.equal(created.research, "retrieval");
  assert.match(content, /page: 3/);
  assert.match(content, /target: target-question/);
  assert.match(content, /> This is a verified fixture excerpt\./);
});

test("PDF evidence stays inside an auto-indexed project folder with project-local order", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-folder-evidence-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectRoot = path.join(root, "progress", "Retrieval Folder");
  await fs.mkdir(path.join(projectRoot, "papers"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "00_question.md"),
    [
      "---",
      "id: folder-question",
      "title: Folder question",
      "summary: Folder-backed research question.",
      "type: question",
      "status: investigating",
      "---",
      "",
      "# Folder question",
      ""
    ].join("\n")
  );
  await fs.writeFile(
    path.join(projectRoot, "01_literature.md"),
    [
      "---",
      "id: folder-paper",
      "title: Folder paper",
      "summary: Local paper companion.",
      "type: literature",
      "status: investigating",
      "pdf: papers/fixture.pdf",
      "---",
      "",
      "# Folder paper",
      ""
    ].join("\n")
  );
  await fs.writeFile(path.join(projectRoot, "papers", "fixture.pdf"), "%PDF-1.4\n");

  const created = await createEvidenceNote({
    rootDir: root,
    paperPath: "Retrieval Folder/papers/fixture.pdf",
    page: 4,
    quote: "Folder-local evidence remains portable.",
    relationship: { type: "supports", target: "folder-question" },
  });

  assert.equal(created.research, "retrieval-folder");
  assert.match(created.filename, /^Retrieval Folder\/02_evidence_fixture_p4_[a-f0-9]{8}\.md$/);
  const content = await fs.readFile(path.join(root, "progress", ...created.filename.split("/")), "utf8");
  assert.doesNotMatch(content, /^research:/m);
  assert.match(content, /pdf: "papers\/fixture\.pdf"/);

  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const evidence = workspace.entries.find((entry) => entry.slug === created.slug);
  assert.equal(evidence?.research, "retrieval-folder");
  assert.equal(evidence?.source?.pdf, "Retrieval Folder/papers/fixture.pdf");
  assert.equal(workspace.diagnostics.some((item) => item.code === "order-duplicate" && item.file?.includes("Retrieval Folder")), false);
});
