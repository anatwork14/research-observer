import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ensureLatexCitation,
  listLatexCitationCandidates,
  resolveLatexCitationTokens,
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
title: "Evidence: sample p. 2"
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

test("citation token resolution searches visible project libraries and surfaces ambiguous or missing identities", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "progress", "papers", "unique.pdf"), "%PDF-1.4\n%%EOF\n", "utf8");
  await fs.writeFile(path.join(root, "progress", "02_unique.md"), `---
id: unique-source
title: Unique Source Study
type: literature
status: complete
authors:
  - Sam Lee
year: 2025
pdf: papers/unique.pdf
---

# Unique Source Study
`, "utf8");
  await fs.mkdir(path.join(root, "manuscripts", "default", "refs"), { recursive: true });
  await fs.writeFile(path.join(root, "manuscripts", "default", "main.tex"), "\\documentclass{article}\n\\begin{document}\n\\cite{unique2025source, shared2026source, absent}\n\\end{document}\n", "utf8");
  await fs.writeFile(path.join(root, "manuscripts", "default", "references.bib"), `@misc{shared2026source,
  doi = {10.1234/verified.2026},
  title = {Verified Retrieval Study},
  year = {2026}
}
`, "utf8");
  await fs.writeFile(path.join(root, "manuscripts", "default", "refs", "local.bib"), `@misc{unique2025source,
  file = {papers/unique.pdf},
  title = {Unique Source Study},
  year = {2025}
}
`, "utf8");

  const result = await resolveLatexCitationTokens({ rootDir: root, projectId: "default", file: "main.tex" });
  assert.deepEqual(result.citations.map(({ key, status }) => [key, status]), [
    ["unique2025source", "resolved"],
    ["shared2026source", "ambiguous"],
    ["absent", "missing"],
  ]);
  assert.equal(result.citations[0].choices[0].slug, "unique-source");
  assert.deepEqual(result.citations[0].bibFiles, ["refs/local.bib"]);
  assert.deepEqual(new Set(result.citations[1].choices.map(({ slug }) => slug)), new Set(["verified-paper", "promoted-evidence"]));
  assert.deepEqual(result.citations[2].choices, []);
  assert.equal(result.citations[0].end - result.citations[0].start, "unique2025source".length);

  const draft = await resolveLatexCitationTokens({
    rootDir: root,
    projectId: "default",
    file: "main.tex",
    content: "\\cite{unique2025source}",
  });
  assert.deepEqual(draft.citations.map(({ key, status }) => [key, status]), [["unique2025source", "resolved"]]);
});
