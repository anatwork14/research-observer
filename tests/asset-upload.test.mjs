import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { uploadEvidence, uploadPaper } from "../lib/research/asset-upload.mjs";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";

test("paper and evidence uploads follow the selected project and remain indexed", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-asset-upload-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectRoot = path.join(root, "progress", "Retrieval Study");
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
    progressDir: "progress",
    warnOnMissingId: true,
    strictVocabulary: true,
    allowedTypes: ["question", "evidence"],
    allowedStatuses: ["idea", "complete", "investigating"],
    allowedRelationshipTypes: [],
    allowedMediaExtensions: [".pdf", ".png"],
    maxAssetBytes: 1048576,
    researchProjects: [{ id: "default", label: "Main research" }],
    savedCollections: [],
  }));
  await fs.writeFile(path.join(projectRoot, "00_question.md"), [
    "---", "id: retrieval-question", "title: Retrieval question", "summary: Main project question.",
    "type: question", "status: investigating", "---", "", "# Retrieval question", "",
  ].join("\n"));
  const pdf = new File([new TextEncoder().encode("%PDF-1.4\nfixture")], "source.pdf", { type: "application/pdf" });
  const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "figure.png", { type: "image/png" });

  const paper = await uploadPaper({ rootDir: root, file: pdf, research: "retrieval-study" });
  const evidence = await uploadEvidence({ rootDir: root, file: png, research: "retrieval-study", title: "Uploaded figure" });
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const evidenceEntry = workspace.entries.find((entry) => entry.slug === evidence.slug);
  assert.match(paper.path, /^Retrieval Study\/papers\/source-[a-f0-9]+\.pdf$/);
  assert.match(evidence.filename, /^Retrieval Study\/01_evidence_uploaded-figure_[a-f0-9]+\.md$/);
  assert.equal(evidenceEntry?.research, "retrieval-study");
  assert.ok(evidenceEntry?.assets.includes(evidence.assetPath));
  assert.equal(workspace.diagnostics.filter((item) => item.severity === "error").length, 0);
});
