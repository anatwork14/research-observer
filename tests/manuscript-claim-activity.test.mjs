import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  buildManuscriptClaimActivity,
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

test("Timeline integrates the activity overview without widening historical loading", async () => {
  const page = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  assert.match(page, /import \{ ManuscriptRevisionActivity \} from "@\/components\/ManuscriptRevisionActivity"/);
  assert.match(page, /<ManuscriptRevisionActivity[\s\S]*evolution=\{claimHistory\}[\s\S]*changedMode=\{filters\.historyChanged\}/);
  assert.equal(page.match(/loadManuscriptClaimEvolution\(/g)?.length, 1);
});

test("activity overview is bounded, document-contained, and coarse-pointer usable", async () => {
  const component = await fs.readFile(path.join(root, "components/ManuscriptRevisionActivity.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ManuscriptRevisionActivity.module.css"), "utf8");
  assert.match(component, /limit:\s*12/);
  assert.match(component, /strict AND semantics/);
  assert.match(component, /Changed-only remains a Base → Compare row-list mode and does not alter this multi-revision overview/);
  assert.match(component, /not a research-quality or confidence score/);
  assert.match(css, /\.shell\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*min-height:\s*44px/);
});
