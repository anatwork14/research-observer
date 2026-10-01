import { spawn } from "node:child_process";
import path from "node:path";
import { listManuscriptRevisions, resolveManuscriptHistoryContext } from "./manuscript-history.mjs";
import { parseManuscriptClaimAnchors } from "./manuscript-claims.mjs";
import { parseManuscriptClaimEvidenceRelations } from "./manuscript-claim-relations.mjs";

const MAX_SNAPSHOTS = 40;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const STATE_FILE = ".observaire-ide.json";
const COMMIT_SHA = /^[0-9a-f]{40}$/i;

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

function cleanRevisionPath(projectPath, raw) {
  const normalized = String(raw ?? "").trim().replace(/\\/g, "/");
  if (!normalized.startsWith(`${projectPath}/`)) return null;
  const relative = normalized.slice(projectPath.length + 1);
  if (!relative || path.posix.isAbsolute(relative)) return null;
  const clean = path.posix.normalize(relative);
  if (clean === "." || clean === ".." || clean.startsWith("../") || clean.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))) return null;
  return clean;
}

function parseIdeState(buffer) {
  try {
    const parsed = JSON.parse(buffer.toString("utf8"));
    return {
      mainFile: typeof parsed.mainFile === "string" ? parsed.mainFile : "",
      hiddenFiles: new Set(Array.isArray(parsed.hiddenFiles) ? parsed.hiddenFiles.filter((item) => typeof item === "string") : []),
    };
  } catch {
    return { mainFile: "", hiddenFiles: new Set() };
  }
}

async function revisionSources(root, projectPath, commit) {
  if (!COMMIT_SHA.test(commit)) throw new Error("Revision history requires a full Git commit SHA.");
  const exists = await run("git", ["cat-file", "-e", `${commit}^{commit}`], root);
  if (exists.code !== 0) throw new Error("Manuscript revision does not exist in this repository.");

  const listed = await run("git", [
    "-c",
    "core.quotePath=false",
    "ls-tree",
    "-r",
    "--name-only",
    "-z",
    commit,
    "--",
    projectPath,
  ], root);
  if (listed.code !== 0) throw new Error("Could not list manuscript files for this revision.");

  const stateResult = await run("git", ["show", `${commit}:${projectPath}/${STATE_FILE}`], root);
  const state = stateResult.code === 0 ? parseIdeState(stateResult.stdout) : { mainFile: "", hiddenFiles: new Set() };
  const paths = listed.stdout.toString("utf8").split("\0").filter(Boolean)
    .map((item) => cleanRevisionPath(projectPath, item))
    .filter((item) => item && path.posix.extname(item).toLowerCase() === ".tex")
    .filter((item) => !state.hiddenFiles.has(item))
    .sort();

  const files = [];
  for (const file of paths) {
    const shown = await run("git", ["show", `${commit}:${projectPath}/${file}`], root);
    if (shown.code !== 0) continue;
    if (shown.stdout.length > MAX_SOURCE_BYTES) continue;
    files.push({ file, content: shown.stdout.toString("utf8") });
  }

  const mainFile = state.mainFile && paths.includes(state.mainFile)
    ? state.mainFile
    : paths.includes("main.tex")
      ? "main.tex"
      : paths[0] || "";
  return { files, mainFile };
}

function buildSnapshot({ projectId, revision, sources, researchEntries }) {
  const claimOccurrences = [];
  const relationOccurrences = [];
  const issues = [];

  for (const source of sources.files) {
    const parsedClaims = parseManuscriptClaimAnchors(source.content);
    claimOccurrences.push(...parsedClaims.claims.map((item) => ({ ...item, file: source.file })));
    issues.push(...parsedClaims.issues.map((item) => ({ ...item, file: source.file, category: "claim" })));

    const parsedRelations = parseManuscriptClaimEvidenceRelations(source.content);
    relationOccurrences.push(...parsedRelations.relations.map((item) => ({ ...item, file: source.file })));
    issues.push(...parsedRelations.issues.map((item) => ({ ...item, file: source.file, category: "claim-evidence" })));
  }

  const claimCounts = new Map();
  for (const claim of claimOccurrences) claimCounts.set(claim.claimId, (claimCounts.get(claim.claimId) || 0) + 1);
  const duplicateClaims = new Set([...claimCounts].filter(([, count]) => count > 1).map(([claimId]) => claimId));
  for (const claimId of duplicateClaims) {
    for (const claim of claimOccurrences.filter((item) => item.claimId === claimId)) {
      issues.push({
        type: "duplicate",
        category: "claim",
        claimId,
        file: claim.file,
        line: claim.markerLine,
        message: `Claim ID ${claimId} occurs more than once in this manuscript revision.`,
      });
    }
  }

  const claims = claimOccurrences
    .filter((claim) => !duplicateClaims.has(claim.claimId))
    .map((claim) => ({
      claimId: claim.claimId,
      file: claim.file,
      markerLine: claim.markerLine,
      line: claim.passage.lineStart,
      section: claim.passage.heading?.title || "",
      excerpt: claim.passage.excerpt,
    }))
    .sort((a, b) => a.claimId.localeCompare(b.claimId));
  const validClaims = new Set(claims.map((claim) => claim.claimId));

  const relationCounts = new Map();
  for (const item of relationOccurrences) {
    const key = `${item.claimId}\u0000${item.relation}\u0000${item.evidenceSlug}`;
    relationCounts.set(key, (relationCounts.get(key) || 0) + 1);
  }
  for (const [key, count] of relationCounts) {
    if (count < 2) continue;
    const [claimId, relation, evidenceSlug] = key.split("\u0000");
    issues.push({
      type: "duplicate-relation",
      category: "claim-evidence",
      claimId,
      relation,
      evidenceSlug,
      message: `Claim-evidence relation ${claimId} ${relation} ${evidenceSlug} occurs more than once in this manuscript revision.`,
    });
  }

  const entryBySlug = new Map((researchEntries || []).map((entry) => [entry.slug, entry]));
  const links = [];
  const emitted = new Set();
  for (const item of relationOccurrences) {
    if (!validClaims.has(item.claimId)) continue;
    const key = `${item.claimId}\u0000${item.relation}\u0000${item.evidenceSlug}`;
    if (emitted.has(key)) continue;
    emitted.add(key);
    const evidence = entryBySlug.get(item.evidenceSlug);
    links.push({
      claimId: item.claimId,
      relation: item.relation,
      evidenceSlug: item.evidenceSlug,
      evidenceTitle: evidence?.title || item.evidenceSlug,
      currentCanonical: Boolean(evidence && evidence.research === projectId && evidence.type === "evidence"),
      file: item.file,
      line: item.line,
    });
  }
  links.sort((a, b) => a.claimId.localeCompare(b.claimId) || a.evidenceSlug.localeCompare(b.evidenceSlug) || a.relation.localeCompare(b.relation));

  return {
    commit: revision.commit,
    shortCommit: revision.shortCommit,
    at: revision.at,
    author: revision.author,
    subject: revision.subject,
    files: revision.files.map((item) => item.file),
    stateChanged: Boolean(revision.stateChanged),
    mainFile: sources.mainFile,
    claims,
    links,
    issues,
    stats: {
      claims: claims.length,
      links: links.length,
      evidenceTargets: new Set(links.map((item) => `${item.claimId}\u0000${item.evidenceSlug}`)).size,
      issues: issues.length,
    },
  };
}

function linkKey(link) {
  return `${link.claimId}\u0000${link.relation}\u0000${link.evidenceSlug}`;
}

function targetKey(link) {
  return `${link.claimId}\u0000${link.evidenceSlug}`;
}

export function compareManuscriptClaimSnapshots(previous, current) {
  const events = [];
  const previousClaims = new Map(previous.claims.map((claim) => [claim.claimId, claim]));
  const currentClaims = new Map(current.claims.map((claim) => [claim.claimId, claim]));

  for (const [claimId, claim] of currentClaims) {
    const before = previousClaims.get(claimId);
    if (!before) {
      events.push({ type: "claim-added", claimId, after: claim.excerpt });
      continue;
    }
    if (before.excerpt !== claim.excerpt) events.push({ type: "claim-text-changed", claimId, before: before.excerpt, after: claim.excerpt });
    if (before.file !== claim.file || before.section !== claim.section) {
      events.push({ type: "claim-moved", claimId, before: [before.file, before.section].filter(Boolean).join(" · "), after: [claim.file, claim.section].filter(Boolean).join(" · ") });
    }
  }
  for (const [claimId, claim] of previousClaims) {
    if (!currentClaims.has(claimId)) events.push({ type: "claim-removed", claimId, before: claim.excerpt });
  }

  const previousLinks = new Map(previous.links.map((link) => [linkKey(link), link]));
  const currentLinks = new Map(current.links.map((link) => [linkKey(link), link]));
  const removed = previous.links.filter((link) => !currentLinks.has(linkKey(link)));
  const added = current.links.filter((link) => !previousLinks.has(linkKey(link)));
  const consumedRemoved = new Set();
  const consumedAdded = new Set();

  for (let addIndex = 0; addIndex < added.length; addIndex += 1) {
    const next = added[addIndex];
    const matches = removed.map((item, index) => ({ item, index })).filter(({ item }) => targetKey(item) === targetKey(next));
    if (matches.length !== 1) continue;
    const candidate = matches[0];
    const reverseMatches = added.filter((item) => targetKey(item) === targetKey(candidate.item));
    if (reverseMatches.length !== 1) continue;
    consumedAdded.add(addIndex);
    consumedRemoved.add(candidate.index);
    events.push({
      type: "relation-changed",
      claimId: next.claimId,
      evidenceSlug: next.evidenceSlug,
      beforeRelation: candidate.item.relation,
      afterRelation: next.relation,
    });
  }

  const previousTargets = new Set(previous.links.map(targetKey));
  const currentTargets = new Set(current.links.map(targetKey));
  for (const key of currentTargets) {
    if (previousTargets.has(key)) continue;
    const [claimId, evidenceSlug] = key.split("\u0000");
    events.push({ type: "evidence-target-added", claimId, evidenceSlug });
  }
  for (const key of previousTargets) {
    if (currentTargets.has(key)) continue;
    const [claimId, evidenceSlug] = key.split("\u0000");
    events.push({ type: "evidence-target-removed", claimId, evidenceSlug });
  }

  removed.forEach((link, index) => {
    if (!consumedRemoved.has(index)) events.push({ type: "relation-removed", claimId: link.claimId, evidenceSlug: link.evidenceSlug, relation: link.relation });
  });
  added.forEach((link, index) => {
    if (!consumedAdded.has(index)) events.push({ type: "relation-added", claimId: link.claimId, evidenceSlug: link.evidenceSlug, relation: link.relation });
  });

  const counts = {};
  for (const event of events) counts[event.type] = (counts[event.type] || 0) + 1;
  return {
    fromCommit: previous.commit,
    toCommit: current.commit,
    at: current.at,
    subject: current.subject,
    events,
    counts,
  };
}

export function buildManuscriptClaimEvolution({ projectId = "default", snapshots = [] } = {}) {
  const ordered = snapshots.slice();
  const transitions = [];
  for (let index = 1; index < ordered.length; index += 1) transitions.push(compareManuscriptClaimSnapshots(ordered[index - 1], ordered[index]));
  return {
    projectId,
    snapshots: ordered,
    transitions,
    stats: {
      revisions: ordered.length,
      transitions: transitions.length,
      events: transitions.reduce((sum, item) => sum + item.events.length, 0),
    },
  };
}

export async function loadManuscriptClaimEvolution({
  rootDir = process.cwd(),
  projectId = "default",
  researchEntries = [],
  maxSnapshots = MAX_SNAPSHOTS,
  history: providedHistory,
} = {}) {
  const root = path.resolve(rootDir);
  let history = providedHistory;
  if (history) {
    const context = await resolveManuscriptHistoryContext({ rootDir: root, projectId });
    if (history.projectId !== context.projectId || history.projectPath !== context.projectPath) {
      throw new Error("Provided manuscript history does not match the selected project path.");
    }
  } else {
    history = await listManuscriptRevisions({ rootDir: root, projectId, includeStateChanges: true });
  }
  const id = history.projectId;
  if (!history.available || !history.revisions.length) {
    return { projectId: id, snapshots: [], transitions: [], dirtyFiles: history.dirtyFiles || [], available: Boolean(history.available), stats: { revisions: 0, transitions: 0, events: 0 } };
  }

  const revisions = history.revisions.slice(0, Math.max(2, Math.min(MAX_SNAPSHOTS, Number(maxSnapshots) || MAX_SNAPSHOTS)));
  const newestFirstSnapshots = [];
  for (const revision of revisions) {
    try {
      const sources = await revisionSources(root, history.projectPath, revision.commit);
      newestFirstSnapshots.push(buildSnapshot({ projectId: id, revision, sources, researchEntries }));
    } catch {
      // A single unreadable revision should not make the whole historical view unavailable.
    }
  }
  const evolution = buildManuscriptClaimEvolution({ projectId: id, snapshots: newestFirstSnapshots.reverse() });
  return { ...evolution, dirtyFiles: history.dirtyFiles || [], available: true };
}
