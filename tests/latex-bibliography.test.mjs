import assert from "node:assert/strict";
import test from "node:test";
import {
  configureLatexBibliographySource,
  mapLatexOffsetThroughInsertions,
} from "../lib/research/latex-bibliography.mjs";

const basic = `\\documentclass{article}
\\begin{document}
Text with a citation.
\\end{document}
`;

test("basic BibTeX setup inserts a plain style and bibliography before end document", () => {
  const result = configureLatexBibliographySource(basic, "references.bib");
  assert.equal(result.mode, "bibtex");
  assert.equal(result.changed, true);
  assert.match(result.content, /\\bibliographystyle\{plain\}/);
  assert.match(result.content, /\\bibliography\{references\}/);
  assert.ok(result.content.indexOf("\\bibliography{references}") < result.content.indexOf("\\end{document}"));
});

test("existing BibTeX style is preserved and duplicate setup is not inserted", () => {
  const withStyle = basic.replace("\\end{document}", "\\bibliographystyle{unsrt}\n\\end{document}");
  const first = configureLatexBibliographySource(withStyle, "refs/library.bib");
  assert.equal(first.changed, true);
  assert.match(first.content, /\\bibliographystyle\{unsrt\}/);
  assert.doesNotMatch(first.content, /\\bibliographystyle\{plain\}/);
  assert.match(first.content, /\\bibliography\{refs\/library\}/);

  const repeated = configureLatexBibliographySource(first.content, "refs/library.bib");
  assert.equal(repeated.changed, false);
  assert.equal(repeated.mode, "bibtex-existing");
});

test("biblatex setup adds selected resource and printbibliography without adding BibTeX commands", () => {
  const source = `\\documentclass{article}
\\usepackage[backend=biber]{biblatex}
\\begin{document}
Hello
\\end{document}
`;
  const result = configureLatexBibliographySource(source, "references.bib");
  assert.equal(result.mode, "biblatex");
  assert.equal(result.changed, true);
  assert.match(result.content, /\\addbibresource\{references\.bib\}/);
  assert.match(result.content, /\\printbibliography/);
  assert.doesNotMatch(result.content, /\\bibliographystyle/);
});

test("bibliography setup preserves cursor offsets when insertions occur before the cursor", () => {
  const source = `\\documentclass{article}
\\usepackage{biblatex}
\\begin{document}
Cursor here
\\end{document}
`;
  const cursor = source.indexOf("Cursor") + 3;
  const result = configureLatexBibliographySource(source, "refs.bib");
  const mapped = mapLatexOffsetThroughInsertions(cursor, result.edits);
  assert.equal(result.content.slice(mapped - 3, mapped + 3), "Cursor");
});

test("unsafe bibliography paths and non-document sources are rejected", () => {
  assert.throws(() => configureLatexBibliographySource(basic, "../outside.bib"), /project-relative/);
  assert.throws(() => configureLatexBibliographySource("fragment only", "references.bib"), /document environment/);
});
