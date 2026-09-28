import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_RETENTION = 12;
const MIN_RETENTION = 2;
const MAX_RETENTION = 100;

function cleanProjectId(value) {
  const id = String(value ?? "default").trim() || "default";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Project id must use lowercase kebab-case.");
  return id;
}

function cleanBuildId(value) {
  const id = String(value ?? "").trim();
  return /^[a-z0-9-]{8,80}$/.test(id) ? id : "";
}

export function latexBuildRetention(value = process.env.OBSERVAIRE_LATEX_BUILD_RETENTION) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION;
  return Math.max(MIN_RETENTION, Math.min(MAX_RETENTION, parsed));
}

async function directoryNames(root) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => cleanBuildId(entry.name))
      .filter(Boolean);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function pruneLatexBuilds({ rootDir = process.cwd(), projectId = "default", keep } = {}) {
  const root = path.resolve(rootDir);
  const project = cleanProjectId(projectId);
  const retention = latexBuildRetention(keep);
  const buildRoot = path.join(root, ".research-observer", "latex-builds", project);
  const publicRoot = path.join(root, "public", "_research", "latex", project);
  const [buildNames, publicNames] = await Promise.all([directoryNames(buildRoot), directoryNames(publicRoot)]);
  const ordered = [...new Set([...buildNames, ...publicNames])].sort().reverse();
  const retained = ordered.slice(0, retention);
  const removed = ordered.slice(retention);

  await Promise.all(removed.flatMap((buildId) => [
    fs.rm(path.join(buildRoot, buildId), { recursive: true, force: true }),
    fs.rm(path.join(publicRoot, buildId), { recursive: true, force: true }),
  ]));

  return { project, retention, retained, removed };
}
