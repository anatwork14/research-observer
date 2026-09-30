import assert from "node:assert/strict";
import test from "node:test";
import { pdfPageHref } from "../lib/research/pdf-page-navigation.mjs";

test("PDF page navigation preserves the selected research project", () => {
  assert.equal(
    pdfPageHref("/papers/source.pdf", "research=qa-project&panel=notes", 3),
    "/papers/source.pdf?research=qa-project&panel=notes&page=3",
  );
});

test("PDF page navigation replaces only the page parameter", () => {
  assert.equal(
    pdfPageHref("/papers/source.pdf", "research=qa-project&page=2", 4),
    "/papers/source.pdf?research=qa-project&page=4",
  );
});
