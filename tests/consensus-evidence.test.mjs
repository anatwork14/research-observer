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
      doi: "https://doi.org/10.1000/example",
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
  assert.doesNotMatch(content, /doi: "https:\/\/doi\.org\//);
  assert.match(content, /query: "retrieval evaluation systematic review"/);
  assert.match(content, /> Evaluation design materially affected reported retrieval quality\./);
  assert.match(content, /target: target-question/);

  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const entry = workspace.entries.find((item) => item.slug === created.slug);
  assert.equal(entry?.source?.kind, "consensus");
  assert.equal(entry?.source?.url, "https://example.org/paper-123");
  assert.equal(entry?.source?.doi, "10.1000/example");
  assert.equal(entry?.source?.paperId, "paper-123");
  assert.ok(!workspace.health.evidenceMissingSource.includes(created.slug));
});

test("Consensus evidence requested for an auto-indexed project stays in that project folder", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-consensus-folder-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const projectRoot = path.join(root, "progress", "Agent Memory Study");
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "00_question.md"),
    [
      "---",
      "id: memory-question",
      "title: Agent memory question",
      "summary: Tests a folder-backed research flow.",
      "type: question",
      "status: investigating",
      "---",
      "",
      "# Agent memory question",
      ""
    ].join("\n")
  );

  const created = await createConsensusEvidenceNote({
    rootDir: root,
    query: "agent memory evaluation",
    research: "agent-memory-study",
    paper: {
      id: "memory-paper",
      title: "Evaluating memory in software agents",
      doi: "10.1000/memory",
      takeaway: "A discovery-context summary.",
    },
  });

  assert.equal(created.research, "agent-memory-study");
  assert.match(created.filename, /^Agent Memory Study\/01_evidence_consensus_evaluating-memory-in-software-agents_[a-f0-9]{8}\.md$/);
  const content = await fs.readFile(path.join(root, "progress", ...created.filename.split("/")), "utf8");
  assert.doesNotMatch(content, /^research:/m);
  assert.match(content, /kind: consensus/);

  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const project = workspace.projects.find((item) => item.id === "agent-memory-study");
  assert.equal(project?.notes, 2);
  assert.equal(workspace.entries.find((item) => item.slug === created.slug)?.research, "agent-memory-study");
});
