import test from "node:test";
import assert from "node:assert/strict";
import { consensusMarkdownCitation, consensusReference } from "../lib/consensus/citation.mjs";

test("Consensus reference formatter prefers canonical DOI provenance", () => {
  const paper = {
    title: "Grounded generation",
    authors: ["Ada Researcher", "Bo Scientist"],
    year: 2026,
    journal: "Journal of Retrieval",
    doi: "doi: https://doi.org/10.1234/example",
    url: "https://consensus.app/papers/details/paper-1/",
  };

  assert.equal(
    consensusReference(paper),
    "Ada Researcher, Bo Scientist (2026). Grounded generation. Journal of Retrieval. https://doi.org/10.1234/example",
  );
  assert.equal(
    consensusMarkdownCitation(paper),
    "[Grounded generation](https://doi.org/10.1234/example) — Ada Researcher & Bo Scientist (2026).",
  );
});

test("Consensus citation formatter does not emit insecure source links", () => {
  const paper = {
    title: "Legacy source",
    authors: [],
    url: "http://legacy.example/paper",
  };
  assert.equal(consensusMarkdownCitation(paper), "Legacy source — Unknown authors (n.d.).");
  assert.equal(consensusReference(paper), "Unknown authors (n.d.). Legacy source.");
});
