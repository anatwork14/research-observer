import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvidenceNote } from "../lib/research/evidence-write.mjs";

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
  assert.match(content, /page: 3/);
  assert.match(content, /target: target-question/);
  assert.match(content, /> This is a verified fixture excerpt\./);
});
