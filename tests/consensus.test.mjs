import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConsensusSearchParams,
  normalizeConsensusSearch,
} from "../lib/consensus/client.mjs";

test("Consensus search normalization preserves citation provenance", () => {
  const normalized = normalizeConsensusSearch({
    query: "retrieval augmented generation",
    total_results: 1,
    papers: [{
      id: "paper-1",
      title: "Grounded generation",
      authors: [{ name: "Ada Researcher" }, "Bo Scientist"],
      year: 2026,
      journal_name: "Journal of Retrieval",
      doi: "10.1234/example",
      url: "https://consensus.app/papers/details/paper-1/",
      abstract: "A verified abstract.",
      takeaway: "Grounding improved factuality.",
      citation_count: 42,
      semantic_score: 0.91,
      full_text_chunks: [{ section: "Results", text: "Relevant result passage." }],
    }],
  });

  assert.equal(normalized.totalResults, 1);
  assert.equal(normalized.papers[0].title, "Grounded generation");
  assert.deepEqual(normalized.papers[0].authors, ["Ada Researcher", "Bo Scientist"]);
  assert.equal(normalized.papers[0].doi, "10.1234/example");
  assert.equal(normalized.papers[0].citationCount, 42);
  assert.equal(normalized.papers[0].fullTextChunks[0].section, "Results");
});

test("Consensus keeps DOI-only scholarly results and normalizes unsafe optional source fields", () => {
  const normalized = normalizeConsensusSearch({
    papers: [{
      title: "DOI-only result",
      authors: ["Researcher"],
      doi: "https://doi.org/10.1234/doi-only",
      url: "http://legacy.example/paper",
    }],
  });

  assert.equal(normalized.papers.length, 1);
  assert.equal(normalized.papers[0].title, "DOI-only result");
  assert.equal(normalized.papers[0].doi, "10.1234/doi-only");
  assert.equal(normalized.papers[0].url, "");
});

test("Consensus drops results that have no durable scholarly identifier", () => {
  const normalized = normalizeConsensusSearch({
    papers: [{ title: "No source identity", authors: ["Researcher"] }],
  });
  assert.equal(normalized.papers.length, 0);
});

test("Consensus query builder bounds result count and applies research filters", () => {
  const params = buildConsensusSearchParams({
    query: "clinical retrieval",
    pageSize: 999,
    yearMin: 2020,
    yearMax: 2026,
    citationMin: 10,
    studyTypes: ["meta-analysis", "systematic review"],
    excludePreprints: true,
    openAccess: true,
    human: true,
    medicalMode: true,
    includeFullText: true,
  });

  assert.equal(params.get("page_size"), "50");
  assert.equal(params.get("year_min"), "2020");
  assert.equal(params.get("year_max"), "2026");
  assert.equal(params.get("citation_min"), "10");
  assert.equal(params.get("exclude_preprints"), "true");
  assert.equal(params.get("open_access"), "true");
  assert.equal(params.get("human"), "true");
  assert.equal(params.get("medical_mode"), "true");
  assert.equal(params.get("include_full_text_chunks"), "true");
  assert.deepEqual(params.getAll("study_types"), ["meta-analysis", "systematic review"]);
});

test("Consensus normalizer accepts nested data result shapes", () => {
  const normalized = normalizeConsensusSearch({
    data: {
      results: [{
        id: "nested-1",
        title: "Nested result",
        authors: ["Researcher"],
        url: "https://consensus.app/papers/details/nested-1/",
      }],
    },
  });

  assert.equal(normalized.papers.length, 1);
  assert.equal(normalized.papers[0].id, "nested-1");
});
