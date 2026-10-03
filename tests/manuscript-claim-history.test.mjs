import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildManuscriptClaimEvolution,
  loadManuscriptClaimEvolution,
} from "../lib/research/manuscript-claim-history.mjs";

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function snapshot(commit, at, claims = [], links = []) {
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
    links,
    issues: [],
    stats: { claims: claims.length, links: links.length, evidenceTargets: links.length, issues: 0 },
  };
}

function claim(claimId, excerpt, file = "main.tex", section = "Results") {
  return { claimId, excerpt, file, section, markerLine: 2, line: 3 };
}

function link(claimId, relation, evidenceSlug) {
  return { claimId, relation, evidenceSlug, evidenceTitle: evidenceSlug, currentCanonical: true, file: "main.tex", line: 2 };
}

test("Claim evolution reports explicit additions, text edits, exact relation changes, Evidence-target changes, and removals", () => {
  const evolution = buildManuscriptClaimEvolution({
    projectId: "default",
    snapshots: [
      snapshot("a".repeat(40), "2026-01-01T00:00:00Z"),
      snapshot("b".repeat(40), "2026-01-02T00:00:00Z", [claim("result-a", "Initial result.")], [link("result-a", "supports", "evidence-a")]),
      snapshot("c".repeat(40), "2026-01-03T00:00:00Z", [claim("result-a", "Revised result.")], [link("result-a", "qualifies", "evidence-a"), link("result-a", "supports", "evidence-b")]),
      snapshot("d".repeat(40), "2026-01-04T00:00:00Z"),
    ],
  });

  assert.equal(evolution.transitions.length, 3);
  assert.deepEqual(evolution.transitions[0].events.map((event) => event.type).sort(), ["claim-added", "evidence-target-added", "relation-added"]);

  const middle = evolution.transitions[1].events;
  assert.ok(middle.some((event) => event.type === "claim-text-changed" && event.claimId === "result-a"));
  assert.ok(middle.some((event) => event.type === "relation-changed" && event.evidenceSlug === "evidence-a" && event.beforeRelation === "supports" && event.afterRelation === "qualifies"));
  assert.ok(middle.some((event) => event.type === "evidence-target-added" && event.evidenceSlug === "evidence-b"));
  assert.ok(middle.some((event) => event.type === "relation-added" && event.relation === "supports" && event.evidenceSlug === "evidence-b"));
  assert.ok(!middle.some((event) => event.type === "evidence-target-removed" && event.evidenceSlug === "evidence-a"));

  const final = evolution.transitions[2].events;
  assert.ok(final.some((event) => event.type === "claim-removed" && event.claimId === "result-a"));
  assert.ok(final.some((event) => event.type === "evidence-target-removed" && event.evidenceSlug === "evidence-a"));
  assert.ok(final.some((event) => event.type === "evidence-target-removed" && event.evidenceSlug === "evidence-b"));
});

test("ambiguous multi-relation changes are not invented as one relation transformation", () => {
  const evolution = buildManuscriptClaimEvolution({
    snapshots: [
      snapshot("a".repeat(40), "2026-01-01T00:00:00Z", [claim("result-a", "Same")], [link("result-a", "supports", "evidence-a"), link("result-a", "qualifies", "evidence-a")]),
      snapshot("b".repeat(40), "2026-01-02T00:00:00Z", [claim("result-a", "Same")], [link("result-a", "contradicts", "evidence-a"), link("result-a", "contextualizes", "evidence-a")]),
    ],
  });
  const events = evolution.transitions[0].events;
  assert.equal(events.some((event) => event.type === "relation-changed"), false);
  assert.equal(events.filter((event) => event.type === "relation-removed").length, 2);
  assert.equal(events.filter((event) => event.type === "relation-added").length, 2);
});

test("historical loader reads committed Claim bytes and visibility state, including state-only revisions, while ignoring dirty edits", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-claim-history-"));
  try {
    const manuscriptRoot = path.join(root, "manuscripts", "default");
    await fs.mkdir(manuscriptRoot, { recursive: true });
    git(root, "init");
    git(root, "config", "user.name", "Observaire Test");
    git(root, "config", "user.email", "observaire@example.invalid");

    await fs.writeFile(path.join(manuscriptRoot, "main.tex"), [
      "\\documentclass{article}",
      "% observaire:claim result-a",
      "% observaire:claim-evidence result-a supports evidence-a",
      "Initial result.",
      "",
    ].join("\n"));
    await fs.writeFile(path.join(manuscriptRoot, "hidden.tex"), [
      "% observaire:claim hidden-result",
      "Hidden result.",
      "",
    ].join("\n"));
    await fs.writeFile(path.join(manuscriptRoot, ".observaire-ide.json"), JSON.stringify({ schemaVersion: 1, mainFile: "main.tex", hiddenFiles: ["hidden.tex"] }, null, 2) + "\n");
    git(root, "add", "manuscripts/default");
    git(root, "commit", "-m", "Initial explicit Claim");

    await fs.writeFile(path.join(manuscriptRoot, "main.tex"), [
      "\\documentclass{article}",
      "% observaire:claim result-a",
      "% observaire:claim-evidence result-a qualifies evidence-a",
      "Revised result.",
      "",
    ].join("\n"));
    await fs.writeFile(path.join(manuscriptRoot, "hidden.tex"), [
      "% observaire:claim hidden-result",
      "Visible historical result.",
      "",
    ].join("\n"));
    await fs.writeFile(path.join(manuscriptRoot, ".observaire-ide.json"), JSON.stringify({ schemaVersion: 1, mainFile: "main.tex", hiddenFiles: [] }, null, 2) + "\n");
    git(root, "add", "manuscripts/default");
    git(root, "commit", "-m", "Revise Claim semantics");

    await fs.writeFile(path.join(manuscriptRoot, ".observaire-ide.json"), JSON.stringify({ schemaVersion: 1, mainFile: "main.tex", hiddenFiles: ["hidden.tex"] }, null, 2) + "\n");
    git(root, "add", "manuscripts/default/.observaire-ide.json");
    git(root, "commit", "-m", "Hide historical appendix source");

    await fs.appendFile(path.join(manuscriptRoot, "main.tex"), "% observaire:claim dirty-only\nDirty text.\n");

    const evolution = await loadManuscriptClaimEvolution({
      rootDir: root,
      projectId: "default",
      researchEntries: [{ slug: "evidence-a", title: "Evidence A", research: "default", type: "evidence" }],
    });

    assert.equal(evolution.available, true);
    assert.equal(evolution.snapshots.length, 3);
    assert.deepEqual(evolution.dirtyFiles, ["main.tex"]);

    const [initial, revised, hiddenAgain] = evolution.snapshots;
    assert.deepEqual(initial.claims.map((item) => item.claimId), ["result-a"]);
    assert.deepEqual(revised.claims.map((item) => item.claimId), ["hidden-result", "result-a"]);
    assert.deepEqual(hiddenAgain.claims.map((item) => item.claimId), ["result-a"]);
    assert.equal(hiddenAgain.stateChanged, true);
    assert.equal(hiddenAgain.files.length, 0);
    assert.equal(hiddenAgain.claims.some((item) => item.claimId === "dirty-only"), false);
    assert.equal(initial.links[0].relation, "supports");
    assert.equal(revised.links.find((item) => item.claimId === "result-a")?.relation, "qualifies");
    assert.equal(revised.links[0].currentCanonical, true);

    const semanticTransition = evolution.transitions[0];
    assert.ok(semanticTransition.events.some((event) => event.type === "claim-text-changed" && event.claimId === "result-a"));
    assert.ok(semanticTransition.events.some((event) => event.type === "relation-changed" && event.beforeRelation === "supports" && event.afterRelation === "qualifies"));
    assert.ok(semanticTransition.events.some((event) => event.type === "claim-added" && event.claimId === "hidden-result"));

    const visibilityTransition = evolution.transitions[1];
    assert.ok(visibilityTransition.events.some((event) => event.type === "claim-removed" && event.claimId === "hidden-result"));
    assert.equal(visibilityTransition.events.some((event) => event.claimId === "dirty-only"), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("reused manuscript history must match the configured selected-project path", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-claim-history-path-"));
  try {
    const manuscriptRoot = path.join(root, "manuscripts", "default");
    await fs.mkdir(manuscriptRoot, { recursive: true });
    await fs.writeFile(path.join(manuscriptRoot, "main.tex"), "\\documentclass{article}\n", "utf8");
    git(root, "init");
    git(root, "config", "user.name", "Observaire Test");
    git(root, "config", "user.email", "observaire@example.invalid");
    git(root, "add", "manuscripts/default/main.tex");
    git(root, "commit", "-m", "Initial manuscript");
    const commit = git(root, "rev-parse", "HEAD");

    await assert.rejects(
      loadManuscriptClaimEvolution({
        rootDir: root,
        projectId: "default",
        history: {
          projectId: "default",
          projectPath: "other/default",
          revisions: [{
            commit,
            shortCommit: commit.slice(0, 10),
            at: "2026-01-01T00:00:00Z",
            author: "Test",
            subject: "Forged history",
            files: [{ file: "main.tex", added: 1, removed: 0 }],
            added: 1,
            removed: 0,
            stateChanged: false,
          }],
          dirtyFiles: [],
          stateDirty: false,
          available: true,
        },
      }),
      /does not match the selected project path/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
