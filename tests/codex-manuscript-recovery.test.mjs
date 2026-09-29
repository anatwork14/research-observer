import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createManuscriptRecoverySnapshot,
  deleteManuscriptRecoverySnapshot,
  restoreManuscriptRecoverySnapshot,
} from "../lib/codex/manuscript-recovery.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-manuscript-recovery-"));
  await fs.mkdir(path.join(root, "manuscripts", "demo", "sections"), { recursive: true });
  return root;
}

test("manuscript recovery restores exact previous bytes for an existing source", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const proposalId = "11111111-1111-4111-8111-111111111111";
  const file = "manuscripts/demo/main.tex";
  const original = Buffer.from("\\documentclass{article}\n\\begin{document}\nOriginal\n\\end{document}\n", "utf8");
  await fs.writeFile(path.join(root, ...file.split("/")), original);

  await createManuscriptRecoverySnapshot({ root, proposalId, files: [file] });
  await fs.writeFile(path.join(root, ...file.split("/")), "mutated after apply\n", "utf8");

  const restored = await restoreManuscriptRecoverySnapshot({ root, proposalId });
  assert.deepEqual(restored.restored, [file]);
  assert.deepEqual(await fs.readFile(path.join(root, ...file.split("/"))), original);

  await deleteManuscriptRecoverySnapshot({ root, proposalId });
  await assert.rejects(fs.access(path.join(root, ".research-observer", "codex-recovery", proposalId)));
});

test("manuscript recovery removes files that did not exist before apply", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const proposalId = "22222222-2222-4222-8222-222222222222";
  const file = "manuscripts/demo/sections/methods.tex";

  const manifest = await createManuscriptRecoverySnapshot({ root, proposalId, files: [file] });
  assert.equal(manifest.files[0].existed, false);

  const absolute = path.join(root, ...file.split("/"));
  await fs.writeFile(absolute, "new source created by apply\n", "utf8");
  await restoreManuscriptRecoverySnapshot({ root, proposalId });
  await assert.rejects(fs.access(absolute));
});

test("manuscript recovery does not overwrite a retained snapshot for the same proposal", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const proposalId = "44444444-4444-4444-8444-444444444444";
  const file = "manuscripts/demo/main.tex";
  const original = "first recovery image\n";
  await fs.writeFile(path.join(root, ...file.split("/")), original, "utf8");

  await createManuscriptRecoverySnapshot({ root, proposalId, files: [file] });
  await fs.writeFile(path.join(root, ...file.split("/")), "changed after snapshot\n", "utf8");
  await assert.rejects(
    createManuscriptRecoverySnapshot({ root, proposalId, files: [file] }),
    /snapshot already exists/i,
  );

  await restoreManuscriptRecoverySnapshot({ root, proposalId });
  assert.equal(await fs.readFile(path.join(root, ...file.split("/")), "utf8"), original);
});

test("manuscript recovery refuses symlinked parent paths", async (t) => {
  const root = await fixture();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-manuscript-recovery-outside-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  const proposalId = "33333333-3333-4333-8333-333333333333";
  await fs.symlink(outside, path.join(root, "manuscripts", "demo", "linked"), "dir");

  await assert.rejects(
    createManuscriptRecoverySnapshot({
      root,
      proposalId,
      files: ["manuscripts/demo/linked/main.tex"],
    }),
    /unsafe parent path/i,
  );
});

test("a failed snapshot restoration retains the snapshot for manual recovery", async (t) => {
  const root = await fixture();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-manuscript-recovery-restore-outside-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  const proposalId = "55555555-5555-4555-8555-555555555555";
  const file = "manuscripts/demo/main.tex";
  const sourceRoot = path.join(root, "manuscripts", "demo");
  await fs.writeFile(path.join(sourceRoot, "main.tex"), "original source\n", "utf8");
  await createManuscriptRecoverySnapshot({ root, proposalId, files: [file] });

  await fs.rename(sourceRoot, path.join(root, "manuscripts", "demo-original"));
  await fs.symlink(outside, sourceRoot, "dir");
  await assert.rejects(
    restoreManuscriptRecoverySnapshot({ root, proposalId }),
    /unsafe parent path/i,
  );
  await fs.access(path.join(root, ".research-observer", "codex-recovery", proposalId, "manifest.json"));
});
