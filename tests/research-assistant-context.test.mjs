import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildResearchAssistantContext } from "../lib/research/assistant-context.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-assistant-context-"));
  const progress = path.join(root, "progress");
  await fs.mkdir(progress, { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
    schemaVersion: 1,
    progressDir: "progress",
    researchProjects: [
      {
        id: "alpha",
        label: "Alpha",
        orchestration: {
          status: "active",
          dependsOn: ["beta"],
          next: "Run the next Alpha experiment.",
          note: "Coordinate with Beta before finalizing conclusions."
        }
      },
      { id: "beta", label: "Beta", orchestration: { status: "queued" } }
    ]
  }, null, 2) + "\n", "utf8");

  const longBody = "CURRENT_ALPHA_MARKER\n" + "alpha context line. ".repeat(900);
  await fs.writeFile(path.join(progress, "00_question.md"), `---\nid: alpha-question\naliases:\n  - alpha-question-old\ntitle: Alpha primary question\nsummary: Does the proposed method improve the target outcome?\nresearch: alpha\ntype: question\nstatus: investigating\ndate: 2026-01-01\ntags:\n  - retrieval\n  - evaluation\n---\n# Alpha primary question\n\n${longBody}\n`, "utf8");

  await fs.writeFile(path.join(progress, "01_support.md"), `---\nid: alpha-evidence-support\ntitle: Supporting paper\nresearch: alpha\ntype: evidence\nstatus: complete\ndate: 2026-01-02\nsource:\n  kind: consensus\n  url: https://example.org/support\n  doi: 10.1234/support\nrelationships:\n  - type: supports\n    target: alpha-question\n    note: Reviewed support signal\n---\n# Supporting paper\n\nReviewed supporting evidence.\n`, "utf8");

  await fs.writeFile(path.join(progress, "02_contradict.md"), `---\nid: alpha-evidence-contradict\ntitle: Contradictory local paper\nresearch: alpha\ntype: evidence\nstatus: complete\ndate: 2026-01-03\nsource:\n  kind: pdf\n  pdf: papers/contradict.pdf\n  page: 7\nrelationships:\n  - type: contradicts\n    target: alpha-question\n---\n# Contradictory local paper\n\nReviewed contradictory evidence.\n`, "utf8");

  await fs.writeFile(path.join(progress, "03_non_evidence.md"), `---\nid: alpha-result\ntitle: Alpha result\nresearch: alpha\ntype: result\nstatus: complete\ndate: 2026-01-04\nrelationships:\n  - type: supports\n    target: alpha-question\n---\n# Alpha result\n\nThis is a general explicit relationship but not Evidence provenance.\n`, "utf8");

  await fs.writeFile(path.join(progress, "04_beta.md"), `---\nid: beta-note\ntitle: Beta note\nresearch: beta\ntype: note\nstatus: idea\ndate: 2026-01-05\n---\n# Beta note\n\nUNRELATED_BETA_BODY_MUST_NOT_ENTER_PROMPT\n`, "utf8");
  return root;
}

async function cleanup(root) {
  await fs.rm(root, { recursive: true, force: true });
}

test("assistant context uses explicit evidence semantics and project orchestration", async () => {
  const root = await fixture();
  try {
    const { context, promptText } = await buildResearchAssistantContext({ rootDir: root, slug: "alpha-question" });
    assert.equal(context.note.slug, "alpha-question");
    assert.equal(context.evidence.counts.supports, 1);
    assert.equal(context.evidence.counts.contradicts, 1);
    assert.equal(context.evidence.counts.answers, 0);
    assert.equal(context.evidence.incomingSignals.length, 2);
    assert.ok(context.relationships.incoming.some((item) => item.source?.slug === "alpha-result" && item.type === "supports"));
    assert.equal(context.evidence.incomingSignals.some((item) => item.source?.slug === "alpha-result"), false);
    assert.equal(context.project?.orchestration?.status, "active");
    assert.equal(context.project?.orchestration?.dependencyState, "waiting");
    assert.deepEqual(context.project?.orchestration?.waitingOn.map((item) => item.id), ["beta"]);
    assert.ok(context.health.current.some((item) => item.code === "unansweredQuestions"));
    assert.ok(context.suggestions.some((item) => item.includes("contradictory evidence")));
    assert.ok(context.suggestions.some((item) => item.includes("still needed to answer")));
    assert.ok(context.suggestions.some((item) => item.includes("waiting on Beta")));
    assert.ok(context.literatureQueries.some((item) => item.includes("contradictory evidence limitations")));
    assert.match(promptText, /CURRENT_ALPHA_MARKER/);
    assert.match(promptText, /10\.1234\/support/);
    assert.match(promptText, /papers\/contradict\.pdf/);
    assert.doesNotMatch(promptText, /UNRELATED_BETA_BODY_MUST_NOT_ENTER_PROMPT/);
    assert.equal(context.note.includedContentChars, 12000);
  } finally {
    await cleanup(root);
  }
});

test("assistant context resolves aliases to the canonical note", async () => {
  const root = await fixture();
  try {
    const canonical = await buildResearchAssistantContext({ rootDir: root, slug: "alpha-question" });
    const alias = await buildResearchAssistantContext({ rootDir: root, slug: "alpha-question-old" });
    assert.equal(alias.context.note.slug, "alpha-question");
    assert.equal(alias.context.workspaceSignature, canonical.context.workspaceSignature);
    assert.deepEqual(alias.context.evidence.counts, canonical.context.evidence.counts);
  } finally {
    await cleanup(root);
  }
});

test("assistant context rejects unknown notes without creating workspace files", async () => {
  const root = await fixture();
  try {
    const before = await fs.readdir(root);
    await assert.rejects(
      () => buildResearchAssistantContext({ rootDir: root, slug: "does-not-exist" }),
      (error) => error?.code === "ASSIST_CONTEXT_NOT_FOUND",
    );
    const after = await fs.readdir(root);
    assert.deepEqual(after.sort(), before.sort());
  } finally {
    await cleanup(root);
  }
});
