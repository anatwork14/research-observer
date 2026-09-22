import test from "node:test";
import assert from "node:assert/strict";
import { filterResearchEntries, parseResearchQuery } from "../lib/research/query.mjs";

const entries = [
  {
    slug: "exp",
    title: "Reranking experiment",
    summary: "Latency validation",
    text: "cross encoder retrieval",
    type: "experiment",
    status: "validating",
    research: "retrieval",
    tags: ["retrieval"],
    authors: [],
    relationships: [{ type: "produces", target: "result" }],
    incomingRelationships: [],
    assets: [],
  },
  {
    slug: "paper",
    title: "Smith paper",
    summary: "Prior work",
    text: "reranking paper",
    type: "literature",
    status: "complete",
    research: "retrieval",
    tags: ["retrieval"],
    authors: ["Jane Smith"],
    doi: "10.1234/example",
    pdf: "papers/smith.pdf",
    relationships: [],
    incomingRelationships: [],
    assets: ["papers/smith.pdf"],
  },
  {
    slug: "evidence",
    title: "Contradicting evidence",
    summary: "PDF excerpt",
    text: "latency grows",
    type: "evidence",
    status: "complete",
    research: "evaluation",
    tags: [],
    authors: [],
    source: { pdf: "papers/smith.pdf", page: 4 },
    relationships: [{ type: "contradicts", target: "exp" }],
    incomingRelationships: [],
    assets: ["papers/smith.pdf"],
  },
];

test("advanced research query filters deterministic fields", () => {
  assert.equal(filterResearchEntries(entries, "type:experiment status:validating").length, 1);
  assert.equal(filterResearchEntries(entries, "tag:retrieval -status:complete").length, 1);
  assert.equal(filterResearchEntries(entries, "type:literature has:pdf author:smith").length, 1);
  assert.equal(filterResearchEntries(entries, "type:evidence has:source relationship:contradicts").length, 1);
  assert.equal(filterResearchEntries(entries, "relationship:produces").length, 1);
  assert.equal(filterResearchEntries(entries, "research:retrieval").length, 2);
  assert.equal(filterResearchEntries(entries, "project:evaluation").length, 1);
  assert.equal(parseResearchQuery('"cross encoder" -status:archived').length, 2);
});
