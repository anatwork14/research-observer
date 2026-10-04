import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";
import {
  applyReviewedConsensusEvidence,
  previewReviewedConsensusEvidence,
} from "../lib/research/reviewed-evidence.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-reviewed-evidence-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
    progressDir: "progress",
    warnOnMissingId: true,
    strictVocabulary: true,
    allowedTypes: ["question", "hypothesis", "note", "evidence"],
    allowedStatuses: ["idea", "investigating", "complete"],
    allowedRelationshipTypes: ["supports", "contradicts", "answers"],
    allowedMediaExtensions: [".pdf"],
    maxAssetBytes: 1048576,
    researchProjects: [
      { id: "default", label: "Main research" },
      { id: "alpha", label: "Alpha" },
    ],
    savedCollections: [],
  }, null, 2));
  await fs.writeFile(path.join(root, "progress", "00_question.md"), [
    "---",
    "id: alpha-question",
    "title: Alpha question",
    "summary: Main question.",
    "type: question",
    "status: investigating",
    "research: alpha",
    "---",
    "",
    "# Alpha question",
    "",
    "What does the evidence say?",
    "",
  ].join("\n"));
  await fs.writeFile(path.join(root, "progress", "01_hypothesis.md"), [
    "---",
    "id: alpha-hypothesis",
    "title: Alpha hypothesis",
    "summary: Candidate explanation.",
    "type: hypothesis",
    "status: idea",
    "research: alpha",
    "---",
    "",
    "# Alpha hypothesis",
    "",
  ].join("\n"));
  return root;
}

function paper(overrides = {}) {
  return {
    id: "consensus-paper-1",
    title: "Reviewed external paper",
    authors: ["A. Author", "B. Author"],
    year: 2025,
    journal: "Journal of Reviewable Results",
    doi: "10.1234/reviewed.1",
    url: "https://example.org/paper",
    abstract: "This abstract is discovery context and not a full-text quotation.",
    takeaway: "Consensus metadata suggests this paper may be relevant.",
    studyType: "systematic review",
    citationCount: 17,
    fullTextChunks: [],
    ...overrides,
  };
}

test("preview is read-only and exact reviewed Apply creates canonical Evidence with authored semantics", async (t) => {
  const root = await fixture(t);
  const beforeFiles = await fs.readdir(path.join(root, "progress"));
  const preview = await previewReviewedConsensusEvidence({
    rootDir: root,
    paper: paper(),
    query: "alpha evidence review",
    research: "alpha",
    targetSlug: "alpha-question",
    relationType: "supports",
    comment: "Preserve for explicit review against the current question.",
  });

  assert.match(preview.workspaceSignature, /^[a-f0-9]{64}$/);
  assert.match(preview.proposalHash, /^[a-f0-9]{64}$/);
  assert.equal(preview.project.id, "alpha");
  assert.equal(preview.target?.slug, "alpha-question");
  assert.deepEqual(preview.relationship, { type: "supports", target: "alpha-question" });
  assert.match(preview.file.content, /type: evidence/);
  assert.match(preview.file.content, /research: alpha/);
  assert.match(preview.file.content, /kind: consensus/);
  assert.match(preview.file.content, /type: supports/);
  assert.match(preview.file.content, /target: alpha-question/);
  assert.deepEqual(await fs.readdir(path.join(root, "progress")), beforeFiles);

  const result = await applyReviewedConsensusEvidence({
    rootDir: root,
    paper: paper(),
    query: "alpha evidence review",
    research: "alpha",
    targetSlug: "alpha-question",
    relationType: "supports",
    comment: "Preserve for explicit review against the current question.",
    expectedWorkspaceSignature: preview.workspaceSignature,
    expectedProposalHash: preview.proposalHash,
  });

  assert.equal(result.research, "alpha");
  assert.equal(result.relationship?.type, "supports");
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const evidence = workspace.entries.find((entry) => entry.slug === result.slug);
  assert.equal(evidence?.type, "evidence");
  assert.equal(evidence?.source?.kind, "consensus");
  assert.ok(evidence?.relationships.some((relation) => relation.type === "supports" && relation.target === "alpha-question"));
});

test("review may save Evidence without a semantic edge while preserving the current project", async (t) => {
  const root = await fixture(t);
  const preview = await previewReviewedConsensusEvidence({
    rootDir: root,
    paper: paper({ id: "paper-no-edge", doi: "10.1234/no-edge" }),
    query: "background context",
    targetSlug: "alpha-question",
    relationType: "",
  });
  assert.equal(preview.project.id, "alpha");
  assert.equal(preview.relationship, null);
  assert.doesNotMatch(preview.file.content, /relationships:/);
});

test("stale workspace and changed reviewed draft are rejected before any write", async (t) => {
  const root = await fixture(t);
  const input = {
    rootDir: root,
    paper: paper({ id: "paper-stale", doi: "10.1234/stale" }),
    query: "stale review",
    targetSlug: "alpha-question",
    relationType: "contradicts",
    comment: "Initial comment.",
  };
  const preview = await previewReviewedConsensusEvidence(input);
  await fs.writeFile(path.join(root, "progress", "02_note.md"), [
    "---", "id: unrelated-note", "title: Unrelated note", "summary: Changes the canonical workspace.",
    "type: note", "status: idea", "research: alpha", "---", "", "# Unrelated note", "",
  ].join("\n"));

  await assert.rejects(
    () => applyReviewedConsensusEvidence({ ...input, expectedWorkspaceSignature: preview.workspaceSignature, expectedProposalHash: preview.proposalHash }),
    (error) => error?.code === "EVIDENCE_REVIEW_STALE",
  );
  assert.equal((await fs.readdir(path.join(root, "progress"))).filter((name) => name.includes("evidence_consensus")).length, 0);

  const fresh = await previewReviewedConsensusEvidence(input);
  await assert.rejects(
    () => applyReviewedConsensusEvidence({
      ...input,
      comment: "Changed after review.",
      expectedWorkspaceSignature: fresh.workspaceSignature,
      expectedProposalHash: fresh.proposalHash,
    }),
    (error) => error?.code === "EVIDENCE_REVIEW_CHANGED",
  );
  assert.equal((await fs.readdir(path.join(root, "progress"))).filter((name) => name.includes("evidence_consensus")).length, 0);
});

test("server rejects inferred or unsafe Evidence semantics", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    () => previewReviewedConsensusEvidence({
      rootDir: root,
      paper: paper(),
      targetSlug: "alpha-question",
      relationType: "derived_from",
    }),
    /only propose supports, contradicts, or answers/,
  );
  await assert.rejects(
    () => previewReviewedConsensusEvidence({
      rootDir: root,
      paper: paper(),
      targetSlug: "alpha-hypothesis",
      relationType: "answers",
    }),
    /must target a canonical question/,
  );
  await assert.rejects(
    () => previewReviewedConsensusEvidence({
      rootDir: root,
      paper: paper({ abstract: "<script>alert('x')</script>" }),
      targetSlug: "alpha-question",
    }),
    /embedded or executable content/,
  );
  await assert.rejects(
    () => previewReviewedConsensusEvidence({
      rootDir: root,
      paper: paper(),
      targetSlug: "alpha-question",
      comment: "javascript:alert(1)",
    }),
    /embedded or executable content/,
  );
});
