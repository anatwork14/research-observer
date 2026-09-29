import assert from "node:assert/strict";
import test from "node:test";
import { locateManuscriptPassage, manuscriptPassageId } from "../lib/research/manuscript-passages.mjs";

const source = [
  "\\section{Introduction}",
  "This paragraph introduces the method and cites \\cite{alpha}. It continues on the same line.",
  "",
  "% \\section{Ignored comment heading}",
  "\\subsection{Evaluation}",
  "A second paragraph cites \\cite{beta} and explains the evaluation setup.",
  "",
  "Final uncited paragraph.",
].join("\n");

test("passage extraction returns literal paragraph, line, and nearest explicit heading", () => {
  const offset = source.indexOf("\\cite{beta}");
  const passage = locateManuscriptPassage(source, offset);
  assert.equal(passage.line, 6);
  assert.equal(passage.lineStart, 6);
  assert.equal(passage.lineEnd, 6);
  assert.equal(passage.heading?.level, "subsection");
  assert.equal(passage.heading?.title, "Evaluation");
  assert.match(passage.excerpt, /^A second paragraph cites/);
  assert.doesNotMatch(passage.excerpt, /subsection|Ignored comment|Final uncited paragraph/);
});

test("commented headings are not treated as manuscript structure", () => {
  const offset = source.indexOf("\\subsection{Evaluation}");
  const passage = locateManuscriptPassage(source, offset);
  assert.equal(passage.heading?.title, "Introduction");
});

test("citations in the same paragraph map to the same passage identity", () => {
  const text = "\\section{Related Work}\nOne paragraph cites \\cite{a} and later \\cite{b}.";
  const first = locateManuscriptPassage(text, text.indexOf("\\cite{a}"));
  const second = locateManuscriptPassage(text, text.indexOf("\\cite{b}"));
  assert.equal(first.start, second.start);
  assert.equal(first.end, second.end);
  assert.equal(first.lineStart, 2);
  assert.equal(
    manuscriptPassageId("default", "main.tex", first.start, first.end),
    manuscriptPassageId("default", "main.tex", second.start, second.end),
  );
});

test("passage extraction is bounded and stable at source edges", () => {
  const passage = locateManuscriptPassage("Single paragraph.", 9999);
  assert.equal(passage.start, 0);
  assert.equal(passage.end, "Single paragraph.".length);
  assert.equal(passage.line, 1);
  assert.equal(passage.column, "Single paragraph.".length);
});
