import assert from "node:assert/strict";
import test from "node:test";
import { buildManuscriptCitationProjection } from "../lib/research/evolution.mjs";
import { traceEvolutionNeighborhood } from "../lib/research/evolution-trace.mjs";

function citation(key, start, status = "resolved", slug = `evidence-${key}`) {
  return {
    key,
    file: "main.tex",
    start,
    end: start + key.length + 7,
    bibFiles: ["references.bib"],
    status,
    choices: status === "resolved" ? [{ slug }] : [],
  };
}

test("citation projection creates one literal passage node per cited paragraph", () => {
  const content = [
    "\\section{Introduction}",
    "The first paragraph cites \\cite{alpha} and later \\cite{beta}.",
    "",
    "\\section{Results}",
    "A separate paragraph cites \\cite{gamma}.",
  ].join("\n");
  const alpha = content.indexOf("\\cite{alpha}");
  const beta = content.indexOf("\\cite{beta}");
  const gamma = content.indexOf("\\cite{gamma}");

  const projection = buildManuscriptCitationProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [{
      file: "main.tex",
      content,
      citations: [citation("alpha", alpha), citation("beta", beta), citation("gamma", gamma)],
    }],
  });

  const passages = projection.nodes.filter((node) => node.kind === "passage");
  assert.equal(passages.length, 2);
  assert.equal(projection.stats.passages, 2);
  assert.equal(projection.stats.citations, 3);
  assert.equal(passages[0].section, "Introduction");
  assert.equal(passages[1].section, "Results");
  assert.match(passages[0].excerpt, /alpha/);
  assert.match(passages[0].href, /file=main\.tex/);
  assert.match(passages[0].href, /line=/);

  const located = projection.edges.filter((edge) => edge.type === "located_in");
  const memberships = projection.edges.filter((edge) => edge.type === "part_of");
  assert.equal(located.length, 3);
  assert.equal(memberships.length, 2);
  assert.equal(new Set(located.slice(0, 2).map((edge) => edge.target)).size, 1);
});

test("unresolved citations retain literal file, line, and section without guessed research edges", () => {
  const content = "\\section{Methods}\nWe mention \\cite{unknown}.";
  const start = content.indexOf("\\cite{unknown}");
  const projection = buildManuscriptCitationProjection({
    projectId: "default",
    mainFile: "main.tex",
    files: [{ file: "main.tex", content, citations: [citation("unknown", start, "missing")] }],
  });

  assert.equal(projection.unresolved.length, 1);
  assert.equal(projection.unresolved[0].line, 2);
  assert.equal(projection.unresolved[0].section, "Methods");
  assert.equal(projection.edges.filter((edge) => edge.type === "cited_as").length, 0);
  assert.equal(projection.nodes.filter((node) => node.kind === "passage").length, 1);
});

test("six-hop trace reaches revision through passage-aware provenance", () => {
  const ids = {
    paper: "paper:p",
    annotation: "annotation:a",
    research: "research:r",
    citation: "citation:c",
    passage: "passage:p",
    manuscript: "manuscript:m",
    revision: "revision:v",
  };
  const edges = [
    [ids.paper, ids.annotation],
    [ids.annotation, ids.research],
    [ids.research, ids.citation],
    [ids.citation, ids.passage],
    [ids.passage, ids.manuscript],
    [ids.manuscript, ids.revision],
  ].map(([source, target], index) => ({ id: `e${index}`, source, target, type: "trace", layer: "citation", explicit: true }));

  const traced = traceEvolutionNeighborhood(edges, ids.paper, 6);
  assert.equal(traced.size, 7);
  assert.ok(traced.has(ids.revision));
  const shallow = traceEvolutionNeighborhood(edges, ids.paper, 5);
  assert.ok(!shallow.has(ids.revision));
});
