import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPdfAnnotation } from "../lib/research/pdf-annotations.mjs";
import {
  parsePdfAnnotationPromotionSnapshot,
  previewPdfAnnotationEvidence,
} from "../lib/research/pdf-evidence-review.mjs";

const hash = "a".repeat(64);

test("snapshot parser ignores earlier malformed lookalike fences and keeps the final valid snapshot", () => {
  const snapshot = {
    schemaVersion: 1,
    annotationId: "ann-security",
    annotationType: "figure",
    anchorKind: "region",
    page: 4,
    rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.3 }],
    documentSha256: hash,
    anchorDocumentSha256: hash,
  };
  const content = [
    "```observaire-pdf-annotation-v1",
    "{ not valid json",
    "```",
    "",
    "Reviewed source text can contain unrelated prose.",
    "",
    "```observaire-pdf-annotation-v1",
    JSON.stringify(snapshot, null, 2),
    "```",
  ].join("\n");
  assert.deepEqual(parsePdfAnnotationPromotionSnapshot(content), snapshot);
});

test("reviewed PDF Evidence rejects executable markers carried by annotation tags", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-pdf-evidence-security-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "progress", "papers"), { recursive: true });
  await fs.writeFile(path.join(root, "progress", "papers", "sample.pdf"), "%PDF-1.4\n%%EOF\n", "utf8");
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({ annotationDir: "annotations" }), "utf8");

  const created = await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: {
      type: "figure",
      page: 2,
      anchorKind: "region",
      quote: { exact: "" },
      rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.3 }],
      sourceText: { kind: "caption", text: "Figure 2. Reviewed source caption." },
      tags: ["javascript:alert(1)"],
    },
  });

  await assert.rejects(
    previewPdfAnnotationEvidence({ rootDir: root, paperPath: "papers/sample.pdf", id: created.annotation.id, expectedRevision: 1 }),
    /Embedded or executable content/,
  );
});
