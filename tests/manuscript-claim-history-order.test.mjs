import assert from "node:assert/strict";
import test from "node:test";
import { buildManuscriptClaimEvolution } from "../lib/research/manuscript-claim-history.mjs";

function snapshot(commit, at, claims = []) {
  return {
    commit,
    shortCommit: commit.slice(0, 10),
    at,
    author: "Test",
    subject: commit,
    files: ["main.tex"],
    stateChanged: false,
    mainFile: "main.tex",
    claims,
    links: [],
    issues: [],
    stats: { claims: claims.length, links: 0, evidenceTargets: 0, issues: 0 },
  };
}

function claim(claimId, excerpt) {
  return { claimId, excerpt, file: "main.tex", section: "Results", markerLine: 2, line: 3 };
}

test("Claim evolution respects supplied Git revision order even when author timestamps are misleading", () => {
  const first = snapshot("a".repeat(40), "2026-05-03T00:00:00Z");
  const second = snapshot("b".repeat(40), "2026-05-01T00:00:00Z", [claim("result-a", "Initial")]);
  const third = snapshot("c".repeat(40), "2026-05-02T00:00:00Z", [claim("result-a", "Revised")]);
  const evolution = buildManuscriptClaimEvolution({ snapshots: [first, second, third] });

  assert.deepEqual(evolution.snapshots.map((item) => item.commit), [first.commit, second.commit, third.commit]);
  assert.equal(evolution.transitions[0].fromCommit, first.commit);
  assert.equal(evolution.transitions[0].toCommit, second.commit);
  assert.ok(evolution.transitions[0].events.some((event) => event.type === "claim-added" && event.claimId === "result-a"));
  assert.equal(evolution.transitions[1].fromCommit, second.commit);
  assert.equal(evolution.transitions[1].toCommit, third.commit);
  assert.ok(evolution.transitions[1].events.some((event) => event.type === "claim-text-changed" && event.claimId === "result-a"));
});
