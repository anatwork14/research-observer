import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPdfAnnotation,
  listPdfAnnotations,
  promotePdfAnnotationToEvidence,
} from "../lib/research/pdf-annotations.mjs";
import {
  ensureLatexCitation,
  resolveLatexCitationTokens,
} from "../lib/research/latex-citations.mjs";
import { configureLatexBibliographySource } from "../lib/research/latex-bibliography.mjs";
import {
  createLatexSource,
  readLatexSource,
  saveLatexSource,
} from "../lib/research/latex-ide.mjs";

const rect = { x: 0.14, y: 0.24, width: 0.52, height: 0.04 };

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-research-manuscript-flow-"));
  await fs.mkdir(path.join(root, "progress", "papers"), { recursive: true });
  await fs.writeFile(
    path.join(root, "research-observer.config.json"),
    JSON.stringify({ manuscriptsDir: "manuscripts", annotationDir: "annotations" }),
    "utf8",
  );
  await fs.writeFile(path.join(root, "progress", "papers", "sample.pdf"), "%PDF-1.4\n% Observaire acceptance fixture\n%%EOF\n", "utf8");
  await fs.writeFile(path.join(root, "progress", "00_literature.md"), `---
id: verified-paper
title: Verified Retrieval Study
type: literature
status: complete
authors:
  - Jane Doe
  - Alex Nguyen
year: 2026
doi: 10.1234/verified.2026
pdf: papers/sample.pdf
---

# Verified Retrieval Study

Verified metadata for the local paper used by the acceptance flow.
`, "utf8");
  return root;
}

test("durable research flows from PDF annotation through evidence and citation into a stale-safe manuscript", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const created = await createPdfAnnotation({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    expectedRevision: 0,
    annotation: {
      type: "evidence",
      page: 2,
      quote: {
        exact: "Retrieval quality improved after reranking the candidate set.",
        prefix: "The experiment reported that ",
        suffix: " under the fixed latency budget.",
      },
      rects: [rect],
      comment: "Use this result in the manuscript evidence chain.",
      tags: ["retrieval", "reranking"],
    },
  });
  assert.equal(created.annotation.anchorStatus, "current");
  assert.equal(created.revision, 1);

  const promoted = await promotePdfAnnotationToEvidence({
    rootDir: root,
    paperPath: "papers/sample.pdf",
    id: created.annotation.id,
    expectedRevision: 1,
  });
  assert.equal(promoted.existing, false);
  assert.ok(promoted.evidence.slug.startsWith("evidence-"));

  const listed = await listPdfAnnotations({ rootDir: root, paperPath: "papers/sample.pdf" });
  assert.equal(listed.annotations[0].evidence?.slug, promoted.evidence.slug);

  const evidenceCitation = await ensureLatexCitation({
    rootDir: root,
    projectId: "default",
    slug: promoted.evidence.slug,
    bibFile: "references.bib",
  });
  assert.equal(evidenceCitation.created, true);
  assert.equal(evidenceCitation.candidate.metadataSlug, "verified-paper");
  assert.equal(evidenceCitation.candidate.doi, "10.1234/verified.2026");

  const literatureCitation = await ensureLatexCitation({
    rootDir: root,
    projectId: "default",
    slug: "verified-paper",
    bibFile: "references.bib",
  });
  assert.equal(literatureCitation.created, false, "evidence and literature should deduplicate to one source identity");
  assert.equal(literatureCitation.key, evidenceCitation.key);

  const bibliography = await fs.readFile(path.join(root, "manuscripts", "default", "references.bib"), "utf8");
  assert.equal((bibliography.match(/@misc\{/g) ?? []).length, 1);
  assert.match(bibliography, /doi = \{10\.1234\/verified\.2026\}/);
  assert.match(bibliography, /file = \{papers\/sample\.pdf\}/);

  const createdSource = await createLatexSource({
    rootDir: root,
    projectId: "default",
    file: "main.tex",
    content: "\\documentclass{article}\n\\begin{document}\nDraft pending citation.\n\\end{document}\n",
  });

  const withCitation = `\\documentclass{article}\n\\begin{document}\nThe reranking result is supported by reviewed evidence~\\cite{${evidenceCitation.key}}.\n\\end{document}\n`;
  const configured = configureLatexBibliographySource(withCitation, "references.bib");
  assert.equal(configured.changed, true);
  assert.equal(configured.mode, "bibtex");
  assert.match(configured.content, /\\bibliographystyle\{plain\}/);
  assert.match(configured.content, /\\bibliography\{references\}/);

  const saved = await saveLatexSource({
    rootDir: root,
    projectId: "default",
    file: "main.tex",
    content: configured.content,
    baseSha256: createdSource.baseSha256,
  });
  assert.notEqual(saved.baseSha256, createdSource.baseSha256);

  const resolved = await resolveLatexCitationTokens({
    rootDir: root,
    projectId: "default",
    file: "main.tex",
  });
  assert.equal(resolved.citations.length, 1);
  assert.equal(resolved.citations[0].key, evidenceCitation.key);
  assert.equal(resolved.citations[0].status, "ambiguous", "one BibTeX identity intentionally maps to both literature and promoted evidence");
  assert.deepEqual(
    new Set(resolved.citations[0].choices.map((choice) => choice.slug)),
    new Set(["verified-paper", promoted.evidence.slug]),
  );

  const reopened = await readLatexSource({ rootDir: root, projectId: "default", file: "main.tex" });
  assert.equal(reopened.content, configured.content);
  assert.ok(reopened.baseSha256);

  await assert.rejects(
    saveLatexSource({
      rootDir: root,
      projectId: "default",
      file: "main.tex",
      content: `${configured.content}\n% stale overwrite attempt\n`,
      baseSha256: createdSource.baseSha256,
    }),
    (error) => error?.code === "LATEX_SOURCE_STALE",
  );
});
