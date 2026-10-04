import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MEDIA_STATE_SCHEMA = 1;
const COPY_CONCURRENCY = 8;

function safeRelative(value) {
  const raw = String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  const normalized = path.posix.normalize(raw);
  if (
    !raw ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized) ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
  ) {
    throw new Error(`Generated media path must remain inside the media root: ${raw || "(empty)"}`);
  }
  return normalized;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, run));
  return results;
}

export function applyReverseResearchIndexes(entries) {
  const backlinks = new Map();
  const incoming = new Map();

  for (const source of entries) {
    for (const target of source.linkedSlugs ?? []) {
      const list = backlinks.get(target) ?? [];
      list.push(source.slug);
      backlinks.set(target, list);
    }
    for (const relation of source.relationships ?? []) {
      const list = incoming.get(relation.target) ?? [];
      list.push({
        type: relation.type,
        source: source.slug,
        ...(relation.note ? { note: relation.note } : {}),
      });
      incoming.set(relation.target, list);
    }
  }

  for (const entry of entries) {
    entry.backlinks = backlinks.get(entry.slug) ?? [];
    entry.incomingRelationships = incoming.get(entry.slug) ?? [];
  }

  return entries;
}

async function readMediaState(statePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, "utf8"));
    if (!parsed || parsed.schemaVersion !== MEDIA_STATE_SCHEMA || !parsed.assets || typeof parsed.assets !== "object" || Array.isArray(parsed.assets)) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return null;
  }
}

async function destinationMatches(destination, fingerprint) {
  try {
    const stat = await fs.stat(destination);
    return stat.isFile() && stat.size === fingerprint.size;
  } catch {
    return false;
  }
}

async function writeStateAtomic(statePath, state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    await fs.rename(temporary, statePath);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => null);
  }
}

export async function syncGeneratedResearchMedia({
  progressRoot,
  mediaDir,
  statePath,
  assets,
  allowedExtensions,
  copyConcurrency = COPY_CONCURRENCY,
} = {}) {
  if (!progressRoot || !mediaDir || !statePath) throw new Error("Generated media sync requires progressRoot, mediaDir, and statePath.");
  const allowed = allowedExtensions instanceof Set ? allowedExtensions : new Set(allowedExtensions ?? []);
  const desired = (assets ?? [])
    .filter((asset) => allowed.has(asset.extension))
    .map((asset) => ({ ...asset, path: safeRelative(asset.path) }));

  const prior = await readMediaState(statePath);
  if (!prior) {
    await fs.rm(mediaDir, { recursive: true, force: true });
  }
  await fs.mkdir(mediaDir, { recursive: true });

  const fingerprints = await mapLimit(desired, copyConcurrency, async (asset) => {
    const source = path.join(progressRoot, ...asset.path.split("/"));
    const stat = await fs.stat(source);
    if (!stat.isFile()) throw new Error(`Research asset is not a regular file: ${asset.path}`);
    return {
      asset,
      source,
      fingerprint: { size: stat.size, mtimeMs: stat.mtimeMs },
    };
  });

  let copied = 0;
  let skipped = 0;
  await mapLimit(fingerprints, copyConcurrency, async ({ asset, source, fingerprint }) => {
    const destination = path.join(mediaDir, ...asset.path.split("/"));
    const previous = prior?.assets?.[asset.path];
    const unchanged = previous && previous.size === fingerprint.size && previous.mtimeMs === fingerprint.mtimeMs;
    if (unchanged && await destinationMatches(destination, fingerprint)) {
      skipped += 1;
      return;
    }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    copied += 1;
  });

  const desiredPaths = new Set(fingerprints.map(({ asset }) => asset.path));
  let removed = 0;
  for (const priorPath of Object.keys(prior?.assets ?? {})) {
    if (desiredPaths.has(priorPath)) continue;
    const safe = safeRelative(priorPath);
    await fs.rm(path.join(mediaDir, ...safe.split("/")), { force: true });
    removed += 1;
  }

  const nextState = {
    schemaVersion: MEDIA_STATE_SCHEMA,
    assets: Object.fromEntries(fingerprints.map(({ asset, fingerprint }) => [asset.path, fingerprint])),
  };
  await writeStateAtomic(statePath, nextState);

  return { total: desired.length, copied, skipped, removed, fullRebuild: prior === null };
}
