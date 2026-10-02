import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  MANUSCRIPT_CLAIM_HISTORY_EVENT_LABELS,
  buildManuscriptClaimActivity,
  buildManuscriptClaimActivityMatrix,
  buildManuscriptClaimEventComposition,
  filterManuscriptClaimHistoryEvents,
} from "../lib/research/manuscript-claim-activity.mjs";

const root = process.cwd();
const transition = {
  fromCommit: "a".repeat(40),
  toCommit: "b".repeat(40),
  at: "2026-09-30T12:00:00.000Z",
  subject: "revise claim semantics",
  counts: {},
  events: [
    { type: "claim-text-changed", claimId: "claim-a", before: "old", after: "new" },
    { type: "evidence-target-added", claimId: "claim-a", evidenceSlug: "evidence-a" },
    { type: "relation-changed", claimId: "claim-a", evidenceSlug: "evidence-a", beforeRelation: "supports", afterRelation: "qualifies" },
    { type: "relation-added", claimId: "claim-b", evidenceSlug: "evidence-b", relation: "contradicts" },
  ],
};

test("activity derives factual category counts from explicit transition events", () => {
  const activity = buildManuscriptClaimActivity([transition]);
  assert.equal(activity.stats.events, 4);
  assert.equal(activity.stats.claims, 2);
  assert.equal(activity.stats.maxEvents, 4);
  assert.deepEqual(activity.rows[0], {
    fromCommit: transition.fromCommit,
    toCommit: transition.toCommit,
    at: transition.at,
    subject: transition.subject,
    events: 4,
    claimState: 1,
    evidenceTargets: 1,
    relations: 2,
    claimIds: ["claim-a", "claim-b"],
  });
});

test("activity filters combine with strict AND semantics and exact authored identities", () => {
  const activity = buildManuscriptClaimActivity([transition], {
    claimId: "claim-a",
    evidenceSlug: "evidence-a",
    relationType: "qualifies",
  });
  assert.equal(activity.stats.events, 1);
  assert.equal(activity.rows[0].relations, 1);
  assert.deepEqual(activity.rows[0].claimIds, ["claim-a"]);

  const noSubstringMatch = buildManuscriptClaimActivity([transition], { evidenceSlug: "evidence" });
  assert.equal(noSubstringMatch.stats.events, 0);
  assert.equal(noSubstringMatch.rows.length, 1);
});

test("relation filters match explicit relation transitions on either authored side", () => {
  const supports = filterManuscriptClaimHistoryEvents(transition.events, { relationType: "supports" });
  const qualifies = filterManuscriptClaimHistoryEvents(transition.events, { relationType: "qualifies" });
  assert.equal(supports.length, 1);
  assert.equal(qualifies.length, 1);
  assert.equal(supports[0].type, "relation-changed");
  assert.equal(qualifies[0].type, "relation-changed");
});

test("selected-pair composition reuses exact filters and canonical event labels", () => {
  const composition = buildManuscriptClaimEventComposition(transition.events, {
    claimId: "claim-a",
    evidenceSlug: "evidence-a",
  });

  assert.equal(composition.stats.events, 2);
  assert.equal(composition.stats.eventTypes, 2);
  assert.equal(composition.stats.maxCount, 1);
  assert.deepEqual(composition.categories, { claimState: 0, evidenceTargets: 1, relations: 1 });
  assert.deepEqual(composition.rows.map((row) => [row.type, row.label, row.count]), [
    ["evidence-target-added", MANUSCRIPT_CLAIM_HISTORY_EVENT_LABELS["evidence-target-added"], 1],
    ["relation-changed", MANUSCRIPT_CLAIM_HISTORY_EVENT_LABELS["relation-changed"], 1],
  ]);

  const relationOnly = buildManuscriptClaimEventComposition(transition.events, {
    relationType: "supports",
  });
  assert.equal(relationOnly.stats.events, 1);
  assert.equal(relationOnly.rows[0].type, "relation-changed");
});

test("activity keeps the latest bounded transition window in Git sequence order", () => {
  const transitions = Array.from({ length: 16 }, (_, index) => ({
    ...transition,
    fromCommit: `from-${index}`,
    toCommit: `to-${index}`,
    subject: `revision ${index}`,
  }));
  const activity = buildManuscriptClaimActivity(transitions, { limit: 12 });
  assert.equal(activity.rows.length, 12);
  assert.equal(activity.rows[0].fromCommit, "from-4");
  assert.equal(activity.rows.at(-1).toCommit, "to-15");
});

test("activity matrix maps exact Claim IDs across adjacent revision pairs", () => {
  const secondTransition = {
    ...transition,
    fromCommit: transition.toCommit,
    toCommit: "c".repeat(40),
    subject: "follow-up revision",
    events: [
      { type: "claim-moved", claimId: "claim-b", before: "a.tex", after: "b.tex" },
      { type: "relation-removed", claimId: "claim-a", evidenceSlug: "evidence-a", relation: "qualifies" },
    ],
  };
  const matrix = buildManuscriptClaimActivityMatrix([transition, secondTransition]);

  assert.deepEqual(matrix.rows.map((row) => row.claimId), ["claim-a", "claim-b"]);
  assert.deepEqual(matrix.rows[0].cells.map((cell) => cell.events), [3, 1]);
  assert.deepEqual(matrix.rows[1].cells.map((cell) => cell.events), [1, 1]);
  assert.equal(matrix.rows[0].cells[0].claimState, 1);
  assert.equal(matrix.rows[0].cells[0].evidenceTargets, 1);
  assert.equal(matrix.rows[0].cells[0].relations, 1);
  assert.equal(matrix.stats.changedCells, 4);
  assert.equal(matrix.stats.maxCellEvents, 3);
});

test("activity matrix keeps exact strict filters and relation-transition semantics", () => {
  const matrix = buildManuscriptClaimActivityMatrix([transition], {
    evidenceSlug: "evidence-a",
    relationType: "supports",
  });
  assert.equal(matrix.rows.length, 1);
  assert.equal(matrix.rows[0].claimId, "claim-a");
  assert.equal(matrix.rows[0].cells[0].events, 1);
  assert.equal(matrix.rows[0].cells[0].relations, 1);

  const noSubstringMatch = buildManuscriptClaimActivityMatrix([transition], { claimId: "claim" });
  assert.equal(noSubstringMatch.rows.length, 0);
  assert.equal(noSubstringMatch.stats.totalClaims, 0);
});

test("activity matrix bounds revision pairs and Claim rows while preserving Git order", () => {
  const transitions = Array.from({ length: 16 }, (_, index) => ({
    ...transition,
    fromCommit: `from-${index}`,
    toCommit: `to-${index}`,
    subject: `revision ${index}`,
    events: Array.from({ length: 24 }, (__, claimIndex) => ({
      type: "claim-text-changed",
      claimId: `claim-${String(claimIndex).padStart(2, "0")}`,
      before: "old",
      after: "new",
    })),
  }));
  const matrix = buildManuscriptClaimActivityMatrix(transitions, { transitionLimit: 12, claimLimit: 20 });

  assert.equal(matrix.columns.length, 12);
  assert.equal(matrix.columns[0].fromCommit, "from-4");
  assert.equal(matrix.columns.at(-1).toCommit, "to-15");
  assert.equal(matrix.rows.length, 20);
  assert.equal(matrix.stats.totalClaims, 24);
  assert.equal(matrix.stats.truncatedClaims, 4);
  assert.equal(matrix.rows[0].cells.length, 12);
});

test("Timeline integrates the activity overview without widening historical loading", async () => {
  const page = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  assert.match(page, /import \{ ManuscriptRevisionActivity \} from "@\/components\/ManuscriptRevisionActivity"/);
  assert.match(page, /<ManuscriptRevisionActivity[\s\S]*evolution=\{claimHistory\}[\s\S]*changedMode=\{filters\.historyChanged\}/);
  assert.equal(page.match(/loadManuscriptClaimEvolution\(/g)?.length, 1);
});

test("activity overview, pair composition, and heatmap remain factual and touch usable", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptRevisionActivity.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptRevisionActivity.module.css"), "utf8");
  assert.match(component, /limit:\s*12/);
  assert.match(component, /buildManuscriptClaimEventComposition/);
  assert.match(component, /compareManuscriptClaimSnapshots\(resolvedBase, resolvedCompare\)/);
  assert.match(component, /Event composition/);
  assert.match(component, /Bar length is relative only to the largest matching event-type count in this selected pair; it is not a score/);
  assert.match(component, /buildManuscriptClaimActivityMatrix/);
  assert.match(component, /transitionLimit:\s*12/);
  assert.match(component, /claimLimit:\s*20/);
  assert.match(component, /Claim × revision map/);
  assert.match(component, /additional matching Claims are omitted by the 20-Claim presentation bound/);
  assert.match(component, /strict AND semantics/);
  assert.match(component, /Changed-only remains a Base → Compare row-list mode and does not alter this multi-revision overview/);
  assert.match(component, /not a research-quality or confidence score/);
  assert.match(css, /\.shell\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.matrixScroll\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.heatmap tr > :first-child\s*\{[^}]*position:\s*sticky[^}]*left:\s*0/s);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*\.compositionRow[\s\S]*\.heatCell[\s\S]*min-height:\s*44px/);
});
