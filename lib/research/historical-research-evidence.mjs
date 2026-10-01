import { spawn } from "node:child_process";
import path from "node:path";
import matter from "gray-matter";
import { PROJECT_IMPORT_PREFIX, projectDirectoryForFile, projectIdFromFolder } from "./project-folders.mjs";

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NOTE = /^\d+_.*\.md$/i;
const PROJECT_MANIFEST = ".observaire-project.json";
const MAX_NOTES = 1000;
const MAX_NOTE_BYTES = 2 * 1024 * 1024;
const MAX_PARALLEL_READS = 8;
const MAX_INDEX_CACHE = 12;
const indexCache = new Map();

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
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

function cleanRepoDir(root, value, fallback = "progress") {
  const configured = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const resolved = path.resolve(root, configured);
  if (resolved === root || !resolved.startsWith(root + path.sep)) return fallback;
  const relative = path.relative(root, resolved).split(path.sep).join("/");
  const normalized = path.posix.normalize(relative).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) return fallback;
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))) return fallback;
  return normalized;
}

function relativeProgressPath(progressPath, raw) {
  const normalized = String(raw ?? "").trim().replace(/\\/g, "/");
  if (!normalized.startsWith(`${progressPath}/`)) return null;
  const relative = normalized.slice(progressPath.length + 1);
  if (!relative || path.posix.isAbsolute(relative)) return null;
  const clean = path.posix.normalize(relative);
  if (clean === "." || clean === ".." || clean.startsWith("../") || clean.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))) return null;
  return clean;
}

function isCompilerVisiblePath(relative) {
  return !relative.split("/").some((segment) => segment.startsWith(PROJECT_IMPORT_PREFIX));
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function firstHeading(value) {
  return String(value ?? "").match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function titleFromFile(value) {
  return value.replace(/\.md$/i, "").replace(/^\d+_/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validManifest(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    value.schemaVersion === 1 && typeof value.id === "string" && ID.test(value.id) &&
    typeof value.label === "string" && Boolean(value.label.trim()) &&
    (value.description === undefined || typeof value.description === "string");
}

async function show(root, commit, file) {
  return run("git", ["show", `${commit}:${file}`], root);
}

async function historicalProgressPath(root, commit) {
  const configResult = await show(root, commit, "research-observer.config.json");
  if (configResult.code !== 0) return "progress";
  try {
    const parsed = JSON.parse(configResult.stdout.toString("utf8"));
    return cleanRepoDir(root, parsed?.progressDir, "progress");
  } catch {
    return "progress";
  }
}

async function folderProjects(root, commit, progressPath, notePaths) {
  const directories = [...new Set(notePaths
    .map((file) => projectDirectoryForFile(file))
    .filter((directory) => directory && !directory.startsWith(".")))].sort();
  const byDirectory = new Map();
  await Promise.all(directories.map(async (directory) => {
    let id = projectIdFromFolder(directory);
    const manifest = await show(root, commit, `${progressPath}/${directory}/${PROJECT_MANIFEST}`);
    if (manifest.code === 0) {
      try {
        const parsed = JSON.parse(manifest.stdout.toString("utf8"));
        if (validManifest(parsed)) id = parsed.id;
      } catch {
        // The live compiler falls back to the folder-derived project id when a manifest is invalid.
      }
    }
    byDirectory.set(directory, id);
  }));
  return byDirectory;
}

function fallbackSlug(projectId, fileSlug, folderBacked) {
  return folderBacked ? `${projectId}-${fileSlug}` : fileSlug;
}

function parseHistoricalNote(raw, relativeFile, folderProjectId) {
  const basename = path.posix.basename(relativeFile);
  const fileSlug = basename.replace(/\.md$/i, "");
  let parsed;
  try {
    parsed = matter(raw);
  } catch {
    parsed = { data: {}, content: raw };
  }
  const data = parsed.data || {};
  let id = stringValue(data.id);
  if (id && !ID.test(id)) id = undefined;
  const requestedResearch = stringValue(data.research);
  let research = folderProjectId || requestedResearch || "default";
  if (!ID.test(research)) research = folderProjectId || "default";
  const slug = id || fallbackSlug(research, fileSlug, Boolean(folderProjectId));
  return {
    slug,
    research,
    type: stringValue(data.type),
    title: stringValue(data.title) || firstHeading(parsed.content) || titleFromFile(basename),
    file: relativeFile,
  };
}

async function readHistoricalNotes(root, commit, progressPath, notePaths, projects) {
  const results = new Array(notePaths.length);
  let cursor = 0;
  let complete = true;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= notePaths.length) return;
      const relativeFile = notePaths[index];
      let shown;
      try {
        shown = await show(root, commit, `${progressPath}/${relativeFile}`);
      } catch {
        complete = false;
        continue;
      }
      if (shown.code !== 0 || shown.stdout.length > MAX_NOTE_BYTES) {
        complete = false;
        continue;
      }
      const directory = projectDirectoryForFile(relativeFile);
      results[index] = parseHistoricalNote(shown.stdout.toString("utf8"), relativeFile, directory ? projects.get(directory) : undefined);
    }
  }
  const workers = Math.min(MAX_PARALLEL_READS, notePaths.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { entries: results.filter(Boolean), complete };
}

function cacheKey(root, commit, projectId) {
  return `${root}\u0000${commit}\u0000${projectId}`;
}

function remember(key, promise) {
  indexCache.delete(key);
  indexCache.set(key, promise);
  while (indexCache.size > MAX_INDEX_CACHE) indexCache.delete(indexCache.keys().next().value);
}

async function buildHistoricalResearchEvidenceIndex({ root, commit, projectId }) {
  const exists = await run("git", ["cat-file", "-e", `${commit}^{commit}`], root);
  if (exists.code !== 0) return { commit, projectId, progressPath: "", available: false, complete: false, reason: "commit-unavailable", entries: [], bySlug: {} };

  const progressPath = await historicalProgressPath(root, commit);
  const listed = await run("git", [
    "-c",
    "core.quotePath=false",
    "ls-tree",
    "-r",
    "--name-only",
    "-z",
    commit,
    "--",
    progressPath,
  ], root);
  if (listed.code !== 0) return { commit, projectId, progressPath, available: false, complete: false, reason: "progress-unavailable", entries: [], bySlug: {} };

  const relativePaths = listed.stdout.toString("utf8").split("\0").filter(Boolean)
    .map((item) => relativeProgressPath(progressPath, item))
    .filter((item) => item && isCompilerVisiblePath(item));
  const notePaths = relativePaths.filter((item) => NOTE.test(path.posix.basename(item))).sort();
  if (notePaths.length > MAX_NOTES) {
    return { commit, projectId, progressPath, available: true, complete: false, reason: "note-limit", entries: [], bySlug: {}, stats: { notes: notePaths.length, parsed: 0 } };
  }

  const projects = await folderProjects(root, commit, progressPath, notePaths);
  const read = await readHistoricalNotes(root, commit, progressPath, notePaths, projects);
  const bySlug = {};
  for (const entry of read.entries) {
    if (!bySlug[entry.slug]) bySlug[entry.slug] = [];
    bySlug[entry.slug].push(entry);
  }
  return {
    commit,
    projectId,
    progressPath,
    available: true,
    complete: read.complete,
    reason: read.complete ? undefined : "incomplete-note-scan",
    entries: read.entries,
    bySlug,
    stats: { notes: notePaths.length, parsed: read.entries.length },
  };
}

export async function loadHistoricalResearchEvidenceIndex({ rootDir = process.cwd(), commit, projectId = "default" } = {}) {
  const root = path.resolve(rootDir);
  const id = String(projectId ?? "default").trim() || "default";
  if (!ID.test(id)) throw new Error("Project id must use lowercase kebab-case.");
  if (!COMMIT_SHA.test(String(commit ?? ""))) throw new Error("Historical Evidence validation requires a full Git commit SHA.");

  const key = cacheKey(root, commit, id);
  const cached = indexCache.get(key);
  if (cached) {
    indexCache.delete(key);
    indexCache.set(key, cached);
    return cached;
  }

  const pending = buildHistoricalResearchEvidenceIndex({ root, commit, projectId: id });
  remember(key, pending);
  try {
    const result = await pending;
    if (!result.available) indexCache.delete(key);
    return result;
  } catch (error) {
    indexCache.delete(key);
    throw error;
  }
}

export function resolveHistoricalEvidenceSlug(index, slug, { projectId = index?.projectId } = {}) {
  const target = String(slug ?? "").trim();
  if (!index?.available || !index?.complete) return { slug: target, status: "unavailable", reason: index?.reason || "historical-index-unavailable" };
  const matches = Array.isArray(index.bySlug?.[target]) ? index.bySlug[target] : [];
  if (!matches.length) return { slug: target, status: "missing" };
  if (matches.length !== 1) return { slug: target, status: "ambiguous", matches: matches.map((entry) => ({ file: entry.file, research: entry.research, type: entry.type })) };
  const entry = matches[0];
  if (entry.research !== projectId) return { slug: target, status: "cross-project", research: entry.research, type: entry.type, title: entry.title, file: entry.file };
  if (entry.type !== "evidence") return { slug: target, status: "wrong-type", research: entry.research, type: entry.type, title: entry.title, file: entry.file };
  return { slug: target, status: "valid", research: entry.research, type: entry.type, title: entry.title, file: entry.file };
}
