import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  applyDirectEdit,
  prepareDirectEdit,
  readDirectEditNote,
} from "../lib/research/direct-edit.mjs";

const exec = promisify(execFile);

async function git(root, args) {
  return exec("git", args, { cwd: root });
}

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-direct-edit-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  await fs.writeFile(path.join(root, "scripts", "research-doctor.mjs"), "process.exit(0);\n");
  await fs.writeFile(
    path.join(root, "research-observer.config.json"),
    JSON.stringify({
      progressDir: "progress",
      warnOnMissingId: true,
      strictVocabulary: true,
      allowedTypes: ["note"],
      allowedStatuses: ["investigating", "complete"],
      allowedRelationshipTypes: ["references"],
      allowedMediaExtensions: [".pdf"],
      researchProjects: [{ id: "default", label: "Main research" }],
      savedCollections: [],
      maxAssetBytes: 1048576
    })
  );
  await fs.writeFile(
    path.join(root, "progress", "00_note.md"),
    [
      "---",
      "id: editable-note",
      "title: Editable note",
      "type: note",
      "status: investigating",
      "---",
      "",
      "# Editable note",
      "",
      "Original paragraph.",
      ""
    ].join("\n")
  );

  await git(root, ["init"]);
  await git(root, ["add", "."]);
  await git(root, ["-c", "user.name=Observaire Test", "-c", "user.email=observaire@example.invalid", "commit", "-m", "fixture"]);
  return root;
}

test("Direct Edit reviews a patch before applying it to the live Markdown file", async (t) => {
  const root = await fixture(t);
  const opened = await readDirectEditNote({ rootDir: root, slug: "editable-note" });
  const draft = opened.content.replace("Original paragraph.", "Reviewed browser edit.");

  const reviewed = await prepareDirectEdit({
    rootDir: root,
    slug: opened.slug,
    content: draft,
    baseSha256: opened.baseSha256,
  });

  assert.equal(reviewed.valid, true);
  assert.equal(reviewed.reviewable, true);
  assert.equal(reviewed.proposal.kind, "direct-edit");
  assert.match(reviewed.patch, /-Original paragraph\./);
  assert.match(reviewed.patch, /\+Reviewed browser edit\./);

  const before = await fs.readFile(path.join(root, "progress", "00_note.md"), "utf8");
  assert.match(before, /Original paragraph\./, "review must not mutate the live file");

  const saved = await applyDirectEdit({ rootDir: root, id: reviewed.proposal.id });
  assert.equal(saved.applied, true);
  assert.equal(saved.slug, "editable-note");
  const after = await fs.readFile(path.join(root, "progress", "00_note.md"), "utf8");
  assert.match(after, /Reviewed browser edit\./);
  assert.doesNotMatch(after, /Original paragraph\./);
});

test("Direct Edit refuses to overwrite a note that changed after review", async (t) => {
  const root = await fixture(t);
  const opened = await readDirectEditNote({ rootDir: root, slug: "editable-note" });
  const reviewed = await prepareDirectEdit({
    rootDir: root,
    slug: opened.slug,
    content: opened.content.replace("Original paragraph.", "Browser draft."),
    baseSha256: opened.baseSha256,
  });

  const file = path.join(root, "progress", "00_note.md");
  await fs.writeFile(file, opened.content.replace("Original paragraph.", "External editor change."), "utf8");

  await assert.rejects(
    () => applyDirectEdit({ rootDir: root, id: reviewed.proposal.id }),
    /changed after review/i,
  );
  const current = await fs.readFile(file, "utf8");
  assert.match(current, /External editor change\./);
  assert.doesNotMatch(current, /Browser draft\./);
});
