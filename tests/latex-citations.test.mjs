import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ensureLatexCitation,
  listLatexCitationCandidates,
} from "../lib/research/latex-citations.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-citations-"));
  await fs.mkdir(path.join(root, "progress", "papers"), { recursive: true });
  await fs.mkdir(path.join(root, "manuscripts", "default"), { recursive: true });
  await fs.writeFile(path.join(root, "progress", "papers", "sample.pdf"), "%PDF-1.4\n%%EOF\n", "utf8");
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({ manuscriptsDir: "manuscripts" }), "utf8");
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

Verified metadata for the local paper.
`, "utf8");
  await fs.writeFile(path.join(root, "progress", "01_evidence.md"), `---
id: promoted-evidence
title: Evidence: sample p. 2
type: evidence
status: complete
source:
  kind: pdf
  pdf: papers/sample.pdf
  page: 2
---

# Evidence: sample p. 2

> A verified excerpt.
`, "utf8");
  return root;
}

test("citation candidates let evidence reuse verified literature metadata", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await listLatexCitationCandidates({ rootDir: root, projectId: "default" });
  const literature = result.items.find((item) => item.slug === "verified-paper");
  const evidence = result.items.find((item) => item.slug === "promoted-evidence");

  assert.ok(literature?.citationReady);
  assert.equal(literature?.doi, "10.1234/verified.2026");
  assert.ok(evidence?.citationReady);
  assert.equal(evidence?.metadataSlug, "verified-paper");
  assert.deepEqual(evidence?.authors, ["Jane Doe", "Alex Nguyen"]);
  assert.equal(evidence?.year, 2026);
  assert.equal(evidence?.pdfPath, "papers/sample.pdf");
  assert.equal(result.defaultBibFile, "references.bib");
});

test("citation insertion creates one BibTeX record and deduplicates evidence/literature by DOI", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const first = await ensureLatexCitation({
    rootDir: root,
    projectId: "default",
    slug: "verified-paper",
    bibFile: "references.bib",
  });
  assert.equal(first.created, true);
  assert.equal(first.bibFileCreated, true);
  assert.match(first.key, /^doe2026/i);

  const second = await ensureLatexCitation({
    rootDir: root,
    projectId: "default",
    slug: "promoted-evidence",
    bibFile: "references.bib",
  });
  assert.equal(second.created, false);
  assert.equal(second.key, first.key);

  const bib = await fs.readFile(path.join(root, "manuscripts", "default", "references.bib"), "utf8");
  assert.equal((bib.match(/@misc\{/g) ?? []).length, 1);
  assert.match(bib, /author = \{Jane Doe and Alex Nguyen\}/);
  assert.match(bib, /year = \{2026\}/);
  assert.match(bib, /doi = \{10\.1234\/verified\.2026\}/);
  assert.match(bib, /file = \{papers\/sample\.pdf\}/);
});

test("citation insertion refuses incomplete metadata instead of inventing it", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "progress", "02_incomplete.md"), `---
id: incomplete-source
title: Incomplete source
type: literature
status: complete
pdf: papers/sample.pdf
---

# Incomplete source
`, "utf8");

  await assert.rejects(
    ensureLatexCitation({ rootDir: root, projectId: "default", slug: "incomplete-source" }),
    /Citation metadata is incomplete/,
  );
});
