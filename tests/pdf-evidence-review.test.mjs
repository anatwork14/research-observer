import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";
import {
  createPdfAnnotation,
  updatePdfAnnotation,
} from "../lib/research/pdf-annotations.mjs";
import {
  applyPdfAnnotationEvidence,
  parsePdfAnnotationPromotionSnapshot,
  previewPdfAnnotationEvidence,
} from "../lib/research/pdf-evidence-review.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-pdf-evidence-review-"));
  await fs.mkdir(path.join(root, "progress", "papers"), { recursive: true });
  await fs.writeFile(path.join(root, "progress", "papers", "sample.pdf"), "%PDF-1.4\n%%EOF\n", "utf8");
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({ annotationDir: "annotations" }), "utf8");
  return root;
}

const rect = { x: 0.16, y: 0.22, width: 0.64, height: 0.42 };

async function createReviewedRegion(root) {
  return createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: {
      type: "figure",
      page: 5,
      anchorKind: "region",
      quote: { exact: "" },
      rects: [rect],
      sourceText: { kind: "caption", text: "Figure 3. Treatment improved response accuracy across measured sessions." },
      comment: "Compare the interaction with the replication study.",
      tags: ["figure", "interaction"],
    },
  });
}

test("PDF Evidence preview is read-only and freezes normalized region geometry", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const created = await createReviewedRegion(root);
  const before = await fs.readdir(path.join(root, "progress"), { recursive: true });

  const preview = await previewPdfAnnotationEvidence({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
  });
  const after = await fs.readdir(path.join(root, "progress"), { recursive: true });
  assert.deepEqual(after, before);
  assert.equal(preview.annotation.anchorKind, "region");
  assert.equal(preview.annotation.type, "figure");
  assert.equal(preview.annotation.page, 5);
  assert.deepEqual(preview.annotation.rects, [rect]);
  assert.match(preview.workspaceSignature, /^[0-9a-f]{64}$/);
  assert.match(preview.documentSha256, /^[0-9a-f]{64}$/);
  assert.match(preview.proposalHash, /^[0-9a-f]{64}$/);

  const snapshot = parsePdfAnnotationPromotionSnapshot(preview.file.content);
  assert.ok(snapshot);
  assert.equal(snapshot.annotationId, created.annotation.id);
  assert.equal(snapshot.annotationType, "figure");
  assert.equal(snapshot.anchorKind, "region");
  assert.equal(snapshot.page, 5);
  assert.deepEqual(snapshot.rects, [rect]);
  assert.equal(snapshot.documentSha256, preview.documentSha256);
  assert.equal(snapshot.sourceText?.kind, "caption");
  assert.match(snapshot.sourceText?.sha256 ?? "", /^[0-9a-f]{64}$/);
  assert.match(preview.file.content, /Observaire source annotation/);
  assert.match(preview.file.content, /observaire-pdf-annotation-v1/);
});

test("reviewed region Apply creates canonical Evidence whose spatial snapshot survives sidecar edits", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const created = await createReviewedRegion(root);
  const preview = await previewPdfAnnotationEvidence({ rootDir: root, paperPath: "papers/sample.pdf", id: created.annotation.id, expectedRevision: 1 });
  const applied = await applyPdfAnnotationEvidence({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: preview.annotationRevision,
    expectedWorkspaceSignature: preview.workspaceSignature,
    expectedDocumentSha256: preview.documentSha256,
    expectedProposalHash: preview.proposalHash,
  });

  const evidencePath = path.join(root, "progress", ...applied.filename.split("/"));
  const savedBefore = await fs.readFile(evidencePath, "utf8");
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const entry = workspace.entries.find((item) => item.slug === applied.slug);
  assert.equal(entry?.type, "evidence");
  assert.equal(entry?.source?.kind, "pdf");
  assert.equal(entry?.source?.pdf, "papers/sample.pdf");
  assert.equal(entry?.source?.page, 5);
  assert.deepEqual(parsePdfAnnotationPromotionSnapshot(entry?.content ?? "")?.rects, [rect]);

  await updatePdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
    patch: {
      type: "table",
      comment: "The private annotation changed after promotion.",
      sourceText: { kind: "transcription", text: "A later sidecar transcription that must not rewrite saved Evidence." },
    },
  });

  const savedAfter = await fs.readFile(evidencePath, "utf8");
  assert.equal(savedAfter, savedBefore);
  const frozen = parsePdfAnnotationPromotionSnapshot(savedAfter);
  assert.equal(frozen?.annotationType, "figure");
  assert.deepEqual(frozen?.rects, [rect]);
  assert.equal(frozen?.sourceText?.kind, "caption");

  const annotations = (await import("../lib/research/pdf-annotations.mjs")).listPdfAnnotations;
  const listed = await annotations({ rootDir: root, paperPath: "papers/sample.pdf" });
  assert.equal(listed.annotations[0].evidence?.slug, applied.slug);
});

test("PDF Evidence Apply rejects stale annotation revisions and changed PDF bytes", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const created = await createReviewedRegion(root);
  const preview = await previewPdfAnnotationEvidence({ rootDir: root, paperPath: "papers/sample.pdf", id: created.annotation.id, expectedRevision: 1 });

  await updatePdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
    patch: { comment: "Changed after review." },
  });
  await assert.rejects(
    applyPdfAnnotationEvidence({
      rootDir: root,
      paperPath: "papers/sample.pdf",
      id: created.annotation.id,
      expectedRevision: preview.annotationRevision,
      expectedWorkspaceSignature: preview.workspaceSignature,
      expectedDocumentSha256: preview.documentSha256,
      expectedProposalHash: preview.proposalHash,
    }),
    (error) => error?.code === "PDF_EVIDENCE_REVIEW_STALE",
  );

  const fresh = await previewPdfAnnotationEvidence({ rootDir: root, paperPath: "papers/sample.pdf", id: created.annotation.id, expectedRevision: 2 });
  await fs.writeFile(path.join(root, "progress", "papers", "sample.pdf"), "%PDF-1.4\n% changed bytes\n%%EOF\n", "utf8");
  await assert.rejects(
    applyPdfAnnotationEvidence({
      rootDir: root,
      paperPath: "papers/sample.pdf",
      id: created.annotation.id,
      expectedRevision: fresh.annotationRevision,
      expectedWorkspaceSignature: fresh.workspaceSignature,
      expectedDocumentSha256: fresh.documentSha256,
      expectedProposalHash: fresh.proposalHash,
    }),
    (error) => error?.code === "PDF_EVIDENCE_REVIEW_STALE",
  );
});

test("review service requires reviewed region source text while text annotations remain supported", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const region = await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: {
      type: "table",
      page: 2,
      anchorKind: "region",
      quote: { exact: "" },
      rects: [{ x: 0.1, y: 0.3, width: 0.7, height: 0.24 }],
    },
  });
  await assert.rejects(
    previewPdfAnnotationEvidence({ rootDir: root, paperPath: "papers/sample.pdf", id: region.annotation.id, expectedRevision: 1 }),
    /reviewed caption\/OCR\/transcription text/,
  );

  const text = await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 1,
    annotation: {
      type: "evidence",
      page: 1,
      anchorKind: "text",
      quote: { exact: "A directly selected source sentence." },
      rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.03 }],
    },
  });
  const preview = await previewPdfAnnotationEvidence({ rootDir: root, paperPath: "papers/sample.pdf", id: text.annotation.id, expectedRevision: 2 });
  assert.equal(preview.annotation.anchorKind, "text");
  assert.deepEqual(parsePdfAnnotationPromotionSnapshot(preview.file.content)?.rects, [{ x: 0.1, y: 0.2, width: 0.4, height: 0.03 }]);
  assert.equal(parsePdfAnnotationPromotionSnapshot("```observaire-pdf-annotation-v1\n{}\n```"), null);
});
