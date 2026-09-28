import assert from "node:assert/strict";
import test from "node:test";
import { findPdfReanchorCandidates } from "../lib/research/pdf-reanchor-candidates.mjs";

test("exact quote matches rank by surrounding context", () => {
  const pages = [
    { page: 2, text: "Background material. The intervention improved accuracy by 18 percent. General discussion follows." },
    { page: 7, text: "Primary results showed that the intervention improved accuracy by 18 percent. This effect persisted at follow-up." },
  ];
  const candidates = findPdfReanchorCandidates({
    pages,
    quote: "the intervention improved accuracy by 18 percent",
    prefix: "Primary results showed that",
    suffix: "This effect persisted at follow-up",
  });
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].page, 7);
  assert.equal(candidates[0].matchType, "exact");
  assert.ok(candidates[0].confidence > candidates[1].confidence);
});

test("fuzzy matching proposes a changed quote without mutating anything", () => {
  const candidates = findPdfReanchorCandidates({
    pages: [
      { page: 4, text: "The revised analysis found a statistically significant improvement in response accuracy across all sessions." },
      { page: 5, text: "A different experiment discussed response speed rather than accuracy." },
    ],
    quote: "The analysis found a significant improvement in response accuracy across sessions.",
  });
  assert.ok(candidates.length >= 1);
  assert.equal(candidates[0].page, 4);
  assert.equal(candidates[0].matchType, "fuzzy");
  assert.ok(candidates[0].confidence >= 0.56);
});

test("page and text-index hints break otherwise similar ties conservatively", () => {
  const repeated = "The treatment reduced the primary outcome compared with control.";
  const candidates = findPdfReanchorCandidates({
    pages: [
      { page: 3, text: `${repeated} Later text. ${repeated}` },
      { page: 8, text: `Methods. ${repeated} End.` },
    ],
    quote: repeated,
    hint: { page: 3, pageTextIndex: 75 },
  });
  assert.equal(candidates[0].page, 3);
  assert.equal(candidates[0].matchType, "exact");
});

test("matcher returns no candidate for too-short or unrelated text", () => {
  assert.deepEqual(findPdfReanchorCandidates({ pages: [{ page: 1, text: "anything" }], quote: "a" }), []);
  assert.deepEqual(findPdfReanchorCandidates({
    pages: [{ page: 1, text: "Completely unrelated methods and measurements." }],
    quote: "The treatment substantially improved long term retention in participants.",
  }), []);
});

test("candidate limits are bounded", () => {
  const quote = "Repeated source sentence for candidate matching.";
  const pages = Array.from({ length: 30 }, (_, index) => ({ page: index + 1, text: quote }));
  const candidates = findPdfReanchorCandidates({ pages, quote, limit: 1000 });
  assert.equal(candidates.length, 12);
});
