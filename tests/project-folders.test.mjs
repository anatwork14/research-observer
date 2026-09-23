import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compileResearchWorkspace } from "../lib/research/compiler.mjs";
import { importResearchProject } from "../lib/research/project-import.mjs";
import { PROJECT_MANIFEST } from "../lib/research/project-folders.mjs";

async function workspaceFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-projects-"));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
  return root;
}

async function write(root, relative, content) {
  const target = path.join(root, "progress", ...relative.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

const note = ({ id, title, body = "Research note.", research } = {}) => [
  "---",
  ...(id ? [`id: ${id}`] : []),
  ...(title ? [`title: ${JSON.stringify(title)}`] : []),
  "type: note",
  "status: investigating",
  ...(research ? [`research: ${research}`] : []),
  "---",
  "",
  `# ${title || id || "Note"}`,
  "",
  body,
  "",
].join("\n");

test("numbered Markdown folders auto-register as independent research projects", async (t) => {
  const root = await workspaceFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await write(root, "Alpha Study/00_question.md", note({ id: "alpha-question", title: "Alpha question", body: "See [method](01_method.md)." }));
  await write(root, "Alpha Study/01_method.md", note({ id: "alpha-method", title: "Alpha method" }));
  await write(root, "Beta Study/00_question.md", note({ id: "beta-question", title: "Beta question" }));
  // Root-level legacy aliases remain globally routable, but an explicit Markdown
  // filename inside a project must resolve to the project's relative sibling first.
  await write(root, "01_method.md", note({ id: "root-method", title: "Root method" }));
  await write(root, "figures/chart.md", "# Not ordered\n");

  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const alpha = workspace.projects.find((project) => project.id === "alpha-study");
  const beta = workspace.projects.find((project) => project.id === "beta-study");
  const alphaQuestion = workspace.entries.find((entry) => entry.slug === "alpha-question");

  assert.equal(alpha?.autoIndexed, true);
  assert.equal(alpha?.directory, "Alpha Study");
  assert.equal(alpha?.notes, 2);
  assert.equal(beta?.notes, 1);
  assert.equal(workspace.projects.some((project) => project.id === "figures"), false);
  assert.equal(alphaQuestion?.research, "alpha-study");
  assert.deepEqual(alphaQuestion?.linkedSlugs, ["alpha-method"]);
  assert.equal(alphaQuestion?.linkedSlugs.includes("root-method"), false);
  assert.equal(workspace.diagnostics.some((item) => item.code === "order-duplicate"), false);
});

test("folder manifest supplies stable project identity without central config edits", async (t) => {
  const root = await workspaceFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await write(root, `Human Folder/${PROJECT_MANIFEST}`, JSON.stringify({
    schemaVersion: 1,
    id: "stable-project",
    label: "Stable Project",
    description: "Folder-local metadata",
  }));
  await write(root, "Human Folder/00_note.md", note({ id: "stable-note", title: "Stable note", research: "wrong-project" }));

  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const project = workspace.projects.find((item) => item.id === "stable-project");
  const entry = workspace.entries.find((item) => item.slug === "stable-note");

  assert.equal(project?.label, "Stable Project");
  assert.equal(project?.description, "Folder-local metadata");
  assert.equal(entry?.research, "stable-project");
  assert.equal(workspace.diagnostics.some((item) => item.code === "research-folder-mismatch"), true);
  assert.equal(workspace.assets.some((asset) => asset.path.endsWith(PROJECT_MANIFEST)), false);
});

test("browser-style project import persists a folder and immediately indexes it", async (t) => {
  const root = await workspaceFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await importResearchProject({
    rootDir: root,
    projectName: "Imported Research",
    files: [
      {
        name: "00_question.md",
        relativePath: "Imported Research/00_question.md",
        data: Buffer.from(note({ id: "imported-question", title: "Imported question" })),
      },
      {
        name: "01_notes.md",
        relativePath: "Imported Research/01_notes.md",
        data: Buffer.from(note({ id: "imported-notes", title: "Imported notes" })),
      },
    ],
  });

  assert.equal(result.imported, true);
  assert.equal(result.project.id, "imported-research");
  assert.equal(result.project.notes, 2);
  assert.equal(result.storagePath, "progress/Imported Research");
  assert.equal(await fs.readFile(path.join(root, "progress", "Imported Research", "00_question.md"), "utf8").then(Boolean), true);
  assert.equal(await fs.readFile(path.join(root, "progress", "Imported Research", PROJECT_MANIFEST), "utf8").then((raw) => JSON.parse(raw).id), "imported-research");

  await assert.rejects(
    importResearchProject({
      rootDir: root,
      projectName: "Imported Research",
      files: [{ name: "00_other.md", relativePath: "Imported Research/00_other.md", data: Buffer.from("# other") }],
    }),
    (error) => error?.code === "PROJECT_IMPORT_EXISTS",
  );
});

test("project import rejects files from a different selected root", async (t) => {
  const root = await workspaceFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await assert.rejects(
    importResearchProject({
      rootDir: root,
      projectName: "Expected Project",
      files: [{
        name: "00_question.md",
        relativePath: "Other Project/00_question.md",
        data: Buffer.from(note({ id: "mixed-root-question", title: "Mixed root" })),
      }],
    }),
    /selected project folder/i,
  );
  await assert.rejects(fs.stat(path.join(root, "progress", "Expected Project")), { code: "ENOENT" });
});

test("project import rejects an identity already used by an existing populated project", async (t) => {
  const root = await workspaceFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, "research-observer.config.json"),
    JSON.stringify({
      researchProjects: [
        { id: "default", label: "Main research" },
        { id: "existing-study", label: "Existing configured study" },
      ],
    }),
  );
  await write(root, "00_existing.md", note({ id: "existing-note", title: "Existing note", research: "existing-study" }));

  await assert.rejects(
    importResearchProject({
      rootDir: root,
      projectName: "Different Folder Name",
      files: [
        {
          name: PROJECT_MANIFEST,
          relativePath: `Different Folder Name/${PROJECT_MANIFEST}`,
          data: Buffer.from(JSON.stringify({ schemaVersion: 1, id: "existing-study", label: "Collision" })),
        },
        {
          name: "00_question.md",
          relativePath: "Different Folder Name/00_question.md",
          data: Buffer.from(note({ id: "collision-question", title: "Collision question" })),
        },
      ],
    }),
    (error) => error?.code === "PROJECT_IMPORT_ID_CONFLICT",
  );
  await assert.rejects(fs.stat(path.join(root, "progress", "Different Folder Name")), { code: "ENOENT" });
});
