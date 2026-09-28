import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPdfAnnotation,
  listPdfAnnotations,
  promotePdfAnnotationToEvidence,
  restorePdfAnnotation,
  softDeletePdfAnnotation,
  updatePdfAnnotation,
} from "../lib/research/pdf-annotations.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-annotations-"));
  await fs.mkdir(path.join(root, "progress", "papers"), { recursive: true });
  await fs.writeFile(path.join(root, "progress", "papers", "sample.pdf"), "%PDF-1.4\n%%EOF\n", "utf8");
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({ annotationDir: "annotations" }), "utf8");
  return root;
}

const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.04 };

test("PDF annotations persist as structured sidecars and soft delete remains recoverable", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const created = await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: {
      type: "evidence",
      page: 2,
      quote: { exact: "A useful result", prefix: "before", suffix: "after" },
      rects: [rect],
      comment: "Check this against the replication paper.",
      tags: ["replication"],
      color: "#58c98d",
    },
  });

  assert.equal(created.revision, 1);
  assert.equal(created.annotation.page, 2);
  assert.equal(created.annotation.type, "evidence");
  assert.equal(created.annotation.deletedAt, null);

  const active = await listPdfAnnotations({ rootDir: root, paperPath: "papers/sample.pdf" });
  assert.equal(active.annotations.length, 1);
  assert.equal(active.hiddenCount, 0);

  const hidden = await softDeletePdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
  });
  assert.equal(hidden.revision, 2);
  assert.ok(hidden.annotation.deletedAt);

  const afterDelete = await listPdfAnnotations({ rootDir: root, paperPath: "papers/sample.pdf" });
  assert.equal(afterDelete.annotations.length, 0);
  assert.equal(afterDelete.hiddenCount, 1);
  const withHidden = await listPdfAnnotations({ rootDir: root, paperPath: "papers/sample.pdf", includeDeleted: true });
  assert.equal(withHidden.annotations.length, 1);
  assert.ok(withHidden.annotations[0].deletedAt);

  const restored = await restorePdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 2,
  });
  assert.equal(restored.revision, 3);
  assert.equal(restored.annotation.deletedAt, null);
});

test("annotation mutations reject stale revisions", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: { type: "highlight", page: 1, quote: { exact: "first" }, rects: [rect] },
  });

  await assert.rejects(
    createPdfAnnotation({
      rootDir: root,
      paperPath: "papers/sample.pdf",
      expectedRevision: 0,
      annotation: { type: "highlight", page: 1, quote: { exact: "stale" }, rects: [rect] },
    }),
    (error) => error?.code === "ANNOTATION_STALE",
  );
});

test("annotation metadata edits preserve the original source anchor", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const created = await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: {
      type: "highlight",
      page: 3,
      quote: { exact: "Anchored source text", prefix: "before", suffix: "after" },
      rects: [rect],
      comment: "Initial note",
      tags: ["draft"],
      color: "#f4c95d",
    },
  });

  const updated = await updatePdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
    patch: {
      type: "question",
      comment: "Does this generalize to the validation cohort?",
      tags: ["follow-up", "validation"],
      color: "#65a8ff",
    },
  });

  assert.equal(updated.revision, 2);
  assert.equal(updated.annotation.type, "question");
  assert.equal(updated.annotation.comment, "Does this generalize to the validation cohort?");
  assert.deepEqual(updated.annotation.tags, ["follow-up", "validation"]);
  assert.deepEqual(updated.annotation.quote, created.annotation.quote);
  assert.deepEqual(updated.annotation.rects, created.annotation.rects);
  assert.equal(updated.annotation.page, created.annotation.page);
});

test("annotation promotion creates one durable evidence note and remains idempotent", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const created = await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: {
      type: "limitation",
      page: 4,
      quote: { exact: "The sample was limited to twenty participants." },
      rects: [rect],
      comment: "Important limitation for the synthesis.",
      tags: ["sample-size", "limitations"],
    },
  });

  const promoted = await promotePdfAnnotationToEvidence({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
  });
  assert.equal(promoted.existing, false);
  assert.ok(promoted.evidence.slug.startsWith("evidence-"));
  assert.equal(promoted.revision, 1, "promotion should not mutate annotation geometry/state revision");

  const notePath = path.join(root, "progress", ...promoted.evidence.filename.split("/"));
  const note = await fs.readFile(notePath, "utf8");
  assert.match(note, /The sample was limited to twenty participants\./);
  assert.ok(note.includes("**Observaire source annotation:** `" + created.annotation.id + "`"));
  assert.match(note, /Annotation type:\*\* limitation/);

  const listed = await listPdfAnnotations({ rootDir: root, paperPath: "papers/sample.pdf" });
  assert.equal(listed.annotations[0].evidence?.slug, promoted.evidence.slug);

  const repeated = await promotePdfAnnotationToEvidence({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
  });
  assert.equal(repeated.existing, true);
  assert.equal(repeated.evidence.slug, promoted.evidence.slug);

  const progressFiles = await fs.readdir(path.join(root, "progress"));
  assert.equal(progressFiles.filter((file) => /_evidence_.*\.md$/i.test(file)).length, 1);
});
