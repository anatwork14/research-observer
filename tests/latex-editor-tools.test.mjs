import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeLatexDocument,
  insertLatexEnvironment,
  insertLatexSection,
  insertObservaireClaimAnchor,
  toggleLatexLineComments,
  wrapLatexSelection,
} from "../lib/research/latex-editor-tools.mjs";

test("LaTeX analysis extracts sections and labels while ignoring commented commands", () => {
  const source = `\\documentclass{article}
\\begin{document}
\\section{Introduction}
\\label{sec:intro}
% \\section{Commented}
\\subsection{Method}
\\end{document}
`;
  const result = analyzeLatexDocument(source);
  assert.deepEqual(result.outline.filter((item) => item.kind === "section").map((item) => item.title), ["Introduction", "Method"]);
  assert.deepEqual(result.labels.map((item) => item.label), ["sec:intro"]);
  assert.equal(result.diagnostics.length, 0);
});

test("LaTeX analysis reports mismatched environments, duplicate labels, and braces", () => {
  const source = `\\documentclass{article}
\\begin{document}
\\label{dup}
\\begin{align}
{x
\\label{dup}
\\end{equation}
`;
  const result = analyzeLatexDocument(source);
  const codes = new Set(result.diagnostics.map((item) => item.code));
  assert.ok(codes.has("latex-environment-mismatch"));
  assert.ok(codes.has("latex-unclosed-environment"));
  assert.ok(codes.has("latex-unclosed-brace"));
  assert.ok(codes.has("latex-duplicate-label"));
  assert.ok(codes.has("latex-missing-end-document"));
});

test("LaTeX analysis surfaces malformed claim anchors but accepts a valid explicit claim", () => {
  const invalid = analyzeLatexDocument("% observaire:claim claim-id\nA placeholder claim.");
  assert.ok(invalid.diagnostics.some((item) => item.code === "observaire-claim-invalid-id"));

  const valid = analyzeLatexDocument("% observaire:claim robust-under-shift\nA deliberate claim.");
  assert.equal(valid.diagnostics.some((item) => item.code.startsWith("observaire-claim-")), false);
});

test("toggle line comments preserves indentation and reverses cleanly", () => {
  const source = "alpha\n  beta\ngamma";
  const commented = toggleLatexLineComments(source, 0, source.indexOf("gamma") - 1);
  assert.equal(commented.content, "% alpha\n  % beta\ngamma");
  const restored = toggleLatexLineComments(commented.content, commented.selectionStart, commented.selectionEnd);
  assert.equal(restored.content, source);
});

test("selection wrappers preserve selected text", () => {
  const source = "A useful result";
  const start = 2;
  const end = 8;
  const wrapped = wrapLatexSelection(source, start, end, "textbf");
  assert.equal(wrapped.content, "A \\textbf{useful} result");
  assert.equal(wrapped.content.slice(wrapped.selectionStart, wrapped.selectionEnd), "useful");
});

test("environment and section insertions expose editable inner ranges", () => {
  const env = insertLatexEnvironment("", 0, 0, "equation");
  assert.equal(env.content, "\\begin{equation}\n\n\\end{equation}");
  assert.equal(env.selectionStart, env.selectionEnd);

  const section = insertLatexSection("", 0, 0, "section");
  assert.equal(section.content, "\\section{Title}");
  assert.equal(section.content.slice(section.selectionStart, section.selectionEnd), "Title");
});

test("claim anchor insertion is compile-safe and requires the author to replace the explicit ID", () => {
  const source = "\\section{Results}\nThe result is robust.";
  const cursor = source.indexOf("The result");
  const inserted = insertObservaireClaimAnchor(source, cursor);
  assert.equal(inserted.content, "\\section{Results}\n% observaire:claim claim-id\nThe result is robust.");
  assert.equal(inserted.content.slice(inserted.selectionStart, inserted.selectionEnd), "claim-id");
});

test("unsupported editor transforms are rejected", () => {
  assert.throws(() => wrapLatexSelection("x", 0, 1, "unsafe"), /Unsupported/);
  assert.throws(() => insertLatexEnvironment("x", 0, 1, "shellescape"), /Unsupported/);
  assert.throws(() => insertLatexSection("x", 0, 1, "unknown"), /Unsupported/);
});
