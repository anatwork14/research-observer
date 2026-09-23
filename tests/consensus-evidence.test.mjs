import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createConsensusEvidenceNote } from "../lib/research/evidence-write.mjs";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";

test("Consensus paper results can be saved as validated external evidence", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-consensus-evidence-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
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

  const created = await createConsensusEvidenceNote({
    rootDir: root,
    query: "retrieval evaluation systematic review",
    research: "retrieval",
    relationship: { type: "supports", target: "target-question" },
    paper: {
      id: "paper-123",
      title: "A systematic review of retrieval evaluation",
      authors: ["Ada Researcher", "Lin Scholar"],
      year: 2025,
      journal: "Journal of Retrieval Studies",
      doi: "10.1000/example",
      url: "https://example.org/paper-123",
      studyType: "Systematic Review",
      citationCount: 42,
      takeaway: "Retrieval quality depends on evaluation design.",
      fullTextChunks: [
        { section: "Results", text: "Evaluation design materially affected reported retrieval quality." }
      ]
    }
  });

  assert.equal(created.sourceKind, "consensus");
  assert.equal(created.research, "retrieval");
  const content = await fs.readFile(path.join(root, "progress", created.filename), "utf8");
  assert.match(content, /kind: consensus/);
  assert.match(content, /paper_id: "paper-123"/);
  assert.match(content, /doi: "10\.1000\/example"/);
  assert.match(content, /query: "retrieval evaluation systematic review"/);
  assert.match(content, /> Evaluation design materially affected reported retrieval quality\./);
  assert.match(content, /target: target-question/);

  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const entry = workspace.entries.find((item) => item.slug === created.slug);
  assert.equal(entry?.source?.kind, "consensus");
  assert.equal(entry?.source?.url, "https://example.org/paper-123");
  assert.equal(entry?.source?.paperId, "paper-123");
  assert.ok(!workspace.health.evidenceMissingSource.includes(created.slug));
});
