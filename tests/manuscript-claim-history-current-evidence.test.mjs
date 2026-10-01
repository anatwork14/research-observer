import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadManuscriptClaimEvolution } from "../lib/research/manuscript-claim-history.mjs";

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("historical links mark current canonical Evidence only for one unique same-project Evidence object", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-claim-history-current-evidence-"));
  try {
    const manuscriptRoot = path.join(root, "manuscripts", "default");
    await fs.mkdir(manuscriptRoot, { recursive: true });
    await fs.writeFile(path.join(manuscriptRoot, "main.tex"), [
      "% observaire:claim result-a",
      "% observaire:claim-evidence result-a supports evidence-a",
      "Result A.",
      "",
    ].join("\n"));

    git(root, "init");
    git(root, "config", "user.name", "Observaire Test");
    git(root, "config", "user.email", "observaire@example.invalid");
    git(root, "add", "manuscripts/default/main.tex");
    git(root, "commit", "-m", "Add Claim relation");

    const unique = await loadManuscriptClaimEvolution({
      rootDir: root,
      projectId: "default",
      researchEntries: [
        { slug: "evidence-a", title: "Evidence A", research: "default", type: "evidence" },
      ],
    });
    assert.equal(unique.snapshots.at(-1).links[0].currentCanonical, true);
    assert.equal(unique.snapshots.at(-1).links[0].evidenceTitle, "Evidence A");

    const duplicate = await loadManuscriptClaimEvolution({
      rootDir: root,
      projectId: "default",
      researchEntries: [
        { slug: "evidence-a", title: "Evidence A one", research: "default", type: "evidence" },
        { slug: "evidence-a", title: "Evidence A two", research: "default", type: "evidence" },
      ],
    });
    assert.equal(duplicate.snapshots.at(-1).links[0].currentCanonical, false);
    assert.equal(duplicate.snapshots.at(-1).links[0].evidenceTitle, "evidence-a");

    const wrongType = await loadManuscriptClaimEvolution({
      rootDir: root,
      projectId: "default",
      researchEntries: [
        { slug: "evidence-a", title: "Literature A", research: "default", type: "literature" },
      ],
    });
    assert.equal(wrongType.snapshots.at(-1).links[0].currentCanonical, false);
    assert.equal(wrongType.snapshots.at(-1).links[0].evidenceTitle, "evidence-a");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
