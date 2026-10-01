import { spawn } from "node:child_process";
import path from "node:path";
import { compileResearchWorkspace } from "./compiler.mjs";

const MAX_REVISIONS = 80;
const EDITABLE_EXTENSIONS = new Set([".tex", ".bib", ".sty", ".cls", ".bst"]);
const STATE_FILE = ".observaire-ide.json";

function safeConfiguredDir(root, value, fallback) {
  const configured = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const resolved = path.resolve(root, configured);
  if (resolved === root || !resolved.startsWith(root + path.sep)) throw new Error(`${fallback} directory must stay inside the repository.`);
  return resolved;
}

function cleanProjectId(value) {
  const id = String(value ?? "default").trim() || "default";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Project id must use lowercase kebab-case.");
  return id;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => resolve({
      code: code ?? 1,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

function relativeRepoPath(root, projectRoot) {
  const relative = path.relative(root, projectRoot);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Manuscript project must stay inside the repository.");
  return relative.split(path.sep).join("/");
}

export async function resolveManuscriptHistoryContext({ rootDir = process.cwd(), projectId = "default" } = {}) {
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const id = cleanProjectId(projectId);
  if (!workspace.projects.some((project) => project.id === id)) throw new Error("Choose a research project that exists in this workspace.");
  const manuscriptsRoot = safeConfiguredDir(root, workspace.config.manuscriptsDir, "manuscripts");
  const projectRoot = path.join(manuscriptsRoot, id);
  const projectPath = relativeRepoPath(root, projectRoot);
  return { root, projectId: id, projectPath };
}

function projectRelativePath(projectPath, raw) {
  const normalized = String(raw ?? "").trim().replace(/\\/g, "/");
  if (!normalized || !(normalized === projectPath || normalized.startsWith(`${projectPath}/`))) return null;
  return normalized.slice(projectPath.length).replace(/^\//, "") || null;
}

function cleanTouchedFile(projectPath, raw) {
  const projectRelative = projectRelativePath(projectPath, raw);
  if (!projectRelative || !EDITABLE_EXTENSIONS.has(path.posix.extname(projectRelative).toLowerCase())) return null;
  return projectRelative;
}

function parseHistory(output, projectPath, { includeStateChanges = false } = {}) {
  const revisions = [];
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("@@@")) {
      const [commit, at, author, ...subjectParts] = line.slice(3).split("\t");
      if (!commit || !at) {
        current = null;
        continue;
      }
      current = {
        commit,
        shortCommit: commit.slice(0, 10),
        at,
        author: author || "",
        subject: subjectParts.join("\t"),
        files: [],
        added: 0,
        removed: 0,
        stateChanged: false,
      };
      revisions.push(current);
      continue;
    }
    if (!current || !line.trim()) continue;
    const [addedRaw, removedRaw, ...fileParts] = line.split("\t");
    const rawFile = fileParts.join("\t");
    const relative = projectRelativePath(projectPath, rawFile);
    if (relative === STATE_FILE) {
      current.stateChanged = true;
      continue;
    }
    const file = cleanTouchedFile(projectPath, rawFile);
    if (!file) continue;
    const added = /^\d+$/.test(addedRaw) ? Number(addedRaw) : 0;
    const removed = /^\d+$/.test(removedRaw) ? Number(removedRaw) : 0;
    current.files.push({ file, added, removed });
    current.added += added;
    current.removed += removed;
  }
  return revisions
    .filter((revision) => revision.files.length > 0 || (includeStateChanges && revision.stateChanged))
    .slice(0, MAX_REVISIONS);
}

function parseStatus(output, projectPath) {
  const files = new Set();
  let stateDirty = false;
  for (const record of output.split("\0").filter(Boolean)) {
    if (record.length < 3) continue;
    const rawFile = record.slice(3);
    const relative = projectRelativePath(projectPath, rawFile);
    if (relative === STATE_FILE) {
      stateDirty = true;
      continue;
    }
    const file = cleanTouchedFile(projectPath, rawFile);
    if (file) files.add(file);
  }
  return { dirtyFiles: [...files].sort(), stateDirty };
}

async function workingTreeState(root, projectPath) {
  const status = await run("git", [
    "-c",
    "core.quotePath=false",
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--no-renames",
    "--",
    projectPath,
  ], root);
  return status.code === 0 ? parseStatus(status.stdout, projectPath) : { dirtyFiles: [], stateDirty: false };
}

export async function listManuscriptRevisions({ rootDir = process.cwd(), projectId = "default", includeStateChanges = false } = {}) {
  const { root, projectId: id, projectPath } = await resolveManuscriptHistoryContext({ rootDir, projectId });

  const inside = await run("git", ["rev-parse", "--is-inside-work-tree"], root);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") {
    return { projectId: id, projectPath, revisions: [], dirtyFiles: [], stateDirty: false, available: false };
  }

  const working = await workingTreeState(root, projectPath);
  const head = await run("git", ["rev-parse", "--verify", "HEAD"], root);
  if (head.code !== 0) {
    return { projectId: id, projectPath, revisions: [], dirtyFiles: working.dirtyFiles, stateDirty: working.stateDirty, available: true };
  }

  const history = await run("git", [
    "-c",
    "core.quotePath=false",
    "log",
    `--max-count=${MAX_REVISIONS}`,
    "--date=iso-strict",
    "--format=@@@%H%x09%aI%x09%an%x09%s",
    "--numstat",
    "--no-renames",
    "--no-textconv",
    "--",
    projectPath,
  ], root);
  if (history.code !== 0) {
    return { projectId: id, projectPath, revisions: [], dirtyFiles: working.dirtyFiles, stateDirty: working.stateDirty, available: false };
  }

  return {
    projectId: id,
    projectPath,
    revisions: parseHistory(history.stdout, projectPath, { includeStateChanges }),
    dirtyFiles: working.dirtyFiles,
    stateDirty: working.stateDirty,
    available: true,
  };
}
