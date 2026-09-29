import path from "node:path";
import { compileResearchWorkspace } from "./compiler.mjs";
import {
  createLatexSource,
  listLatexWorkspace,
  readLatexSource,
  saveLatexSource,
} from "./latex-ide.mjs";

const MAX_RESULTS = 80;

function clean(value, max = 4000) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function normalizeDoi(value) {
  return clean(value, 500)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function normalizeUrl(value) {
  const url = clean(value, 3000);
  if (!/^https:\/\//i.test(url)) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeTitle(value) {
  return clean(value, 1200)
    .replace(/^Evidence:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeAssetCandidate(raw) {
  const input = clean(raw, 2000).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!input || path.posix.isAbsolute(input)) return "";
  const normalized = path.posix.normalize(input);
  if (normalized === ".." || normalized.startsWith("../")) return "";
  return normalized;
}

function resolveEntryPdf(workspace, entry) {
  const raw = entry.pdf || (entry.source?.kind === "pdf" ? entry.source.pdf : "");
  const candidate = safeAssetCandidate(raw);
  if (!candidate) return "";
  const assetPaths = new Set(workspace.assets.filter((asset) => asset.extension === ".pdf").map((asset) => asset.path));
  if (assetPaths.has(candidate)) return candidate;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(entry.filename), candidate));
  return assetPaths.has(joined) ? joined : "";
}

function metadataCompleteness(entry) {
  let score = 0;
  if (Array.isArray(entry.authors) && entry.authors.length) score += 3;
  if (Number.isInteger(entry.year)) score += 3;
  if (normalizeDoi(entry.doi || entry.source?.doi)) score += 4;
  if (normalizeUrl(entry.source?.url)) score += 2;
  if (normalizeTitle(entry.title)) score += 1;
  return score;
}

function bestLiteratureForPdf(workspace, research, pdfPath) {
  if (!pdfPath) return null;
  return workspace.entries
    .filter((entry) =>
      entry.research === research &&
      entry.type === "literature" &&
      resolveEntryPdf(workspace, entry) === pdfPath,
    )
    .sort((a, b) => metadataCompleteness(b) - metadataCompleteness(a))[0] ?? null;
}

function hrefForPdf(pdfPath) {
  if (!pdfPath) return null;
  return `/papers/${pdfPath.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function candidateFromEntry(workspace, entry) {
  const pdfPath = resolveEntryPdf(workspace, entry);
  const literature = entry.type === "evidence" ? bestLiteratureForPdf(workspace, entry.research, pdfPath) : null;
  const metadata = literature ?? entry;
  const title = normalizeTitle(metadata.title || entry.title);
  const authors = Array.isArray(metadata.authors) ? metadata.authors.filter(Boolean).slice(0, 80) : [];
  const year = Number.isInteger(metadata.year) ? metadata.year : undefined;
  const doi = normalizeDoi(metadata.doi || metadata.source?.doi || entry.source?.doi);
  const url = normalizeUrl(metadata.source?.url || entry.source?.url);
  const sourceKind = entry.source?.kind || (pdfPath ? "pdf" : "research");
  const missing = [];
  if (!authors.length) missing.push("authors");
  if (!year) missing.push("year");
  if (!doi && !url && !pdfPath) missing.push("source identifier");
  const citationReady = Boolean(title && authors.length && year && (doi || url || pdfPath));
  const searchText = [entry.title, entry.summary, metadata.title, ...authors, year, doi, url, ...(entry.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    slug: entry.slug,
    title: entry.title,
    bibliographicTitle: title,
    type: entry.type || "note",
    sourceKind,
    authors,
    year,
    doi: doi || undefined,
    url: url || undefined,
    pdfPath: pdfPath || undefined,
    metadataSlug: metadata.slug,
    metadataTitle: metadata.title,
    citationReady,
    missing,
    researchHref: `/progress/${encodeURIComponent(entry.slug)}`,
    paperHref: hrefForPdf(pdfPath),
    searchText,
  };
}

function publicCandidate(candidate) {
  const copy = { ...candidate };
  delete copy.searchText;
  return copy;
}

function selectCandidates(workspace, projectId, query) {
  const needle = clean(query, 400).toLowerCase();
  return workspace.entries
    .filter((entry) => entry.research === projectId && (entry.type === "literature" || entry.type === "evidence"))
    .map((entry) => candidateFromEntry(workspace, entry))
    .filter((candidate) => !needle || candidate.searchText.includes(needle))
    .sort((a, b) => {
      if (a.citationReady !== b.citationReady) return a.citationReady ? -1 : 1;
      const yearA = a.year ?? 0;
      const yearB = b.year ?? 0;
      if (yearA !== yearB) return yearB - yearA;
      return a.title.localeCompare(b.title);
    })
    .slice(0, MAX_RESULTS)
    .map(publicCandidate);
}

function asciiKeyPart(value, fallback) {
  const normalized = clean(value, 300)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return normalized || fallback;
}

function authorKey(authors) {
  const first = clean(authors?.[0], 300);
  if (!first) return "source";
  const family = first.includes(",") ? first.split(",")[0] : first.split(/\s+/).at(-1);
  return asciiKeyPart(family, "source");
}

function titleKey(title) {
  const words = normalizeTitle(title).split(/\s+/).filter((word) => word.length > 3);
  return asciiKeyPart(words[0] || title, "work").slice(0, 16);
}

function bibEscape(value) {
  return clean(value, 8000)
    .replace(/([{}])/g, "\\$1")
    .replace(/\r?\n/g, " ");
}

function bibtexFor(candidate, key) {
  const fields = [
    ["author", candidate.authors.join(" and ")],
    ["title", candidate.bibliographicTitle],
    ["year", candidate.year ? String(candidate.year) : ""],
    ["doi", candidate.doi || ""],
    ["url", candidate.url || ""],
    ["file", candidate.pdfPath || ""],
    ["note", `Research Observer source: ${candidate.slug}`],
  ].filter(([, value]) => value);
  return `@misc{${key},\n${fields.map(([name, value]) => `  ${name} = {${bibEscape(value)}},`).join("\n")}\n}`;
}

function parseBibEntries(content) {
  const entries = [];
  let cursor = 0;
  while (cursor < content.length) {
    const at = content.indexOf("@", cursor);
    if (at < 0) break;
    const open = content.indexOf("{", at);
    if (open < 0) break;
    const header = content.slice(at, open).trim();
    if (!/^@[a-z]+$/i.test(header)) {
      cursor = at + 1;
      continue;
    }
    let depth = 1;
    let index = open + 1;
    for (; index < content.length && depth > 0; index += 1) {
      const char = content[index];
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
    }
    if (depth !== 0) break;
    const block = content.slice(at, index);
    const keyMatch = block.match(/^@[a-z]+\s*{\s*([^,\s]+)\s*,/i);
    if (keyMatch) {
      const field = (name) => {
        const match = block.match(new RegExp(`\\b${name}\\s*=\\s*[{"]([^}"]+)`, "i"));
        return match?.[1]?.trim() || "";
      };
      entries.push({
        key: keyMatch[1],
        doi: normalizeDoi(field("doi")),
        url: normalizeUrl(field("url")),
        file: safeAssetCandidate(field("file")),
        title: normalizeTitle(field("title")).toLowerCase(),
        year: field("year").replace(/\D/g, ""),
      });
    }
    cursor = index;
  }
  return entries;
}

function matchingBibEntry(entries, candidate) {
  if (candidate.doi) {
    const byDoi = entries.find((entry) => entry.doi && entry.doi === candidate.doi);
    if (byDoi) return byDoi;
  }
  if (candidate.url) {
    const byUrl = entries.find((entry) => entry.url && entry.url === candidate.url);
    if (byUrl) return byUrl;
  }
  if (candidate.pdfPath) {
    const byFile = entries.find((entry) => entry.file && entry.file === candidate.pdfPath);
    if (byFile) return byFile;
  }
  const title = normalizeTitle(candidate.bibliographicTitle).toLowerCase();
  const year = candidate.year ? String(candidate.year) : "";
  return entries.find((entry) => entry.title === title && (!year || entry.year === year)) ?? null;
}

function uniqueCitationKey(entries, candidate) {
  const base = `${authorKey(candidate.authors)}${candidate.year || "nd"}${titleKey(candidate.bibliographicTitle)}`.slice(0, 56);
  const keys = new Set(entries.map((entry) => entry.key.toLowerCase()));
  if (!keys.has(base.toLowerCase())) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidateKey = `${base}${index}`;
    if (!keys.has(candidateKey.toLowerCase())) return candidateKey;
  }
  throw new Error("Could not generate a unique citation key.");
}

async function resolveProject(rootDir, projectId) {
  const workspace = await compileResearchWorkspace({ rootDir, fresh: true });
  const project = workspace.projects.find((item) => item.id === projectId);
  if (!project) throw new Error("Choose a research project that exists in this workspace.");
  return { workspace, project };
}

export async function listLatexCitationCandidates({ rootDir = process.cwd(), projectId = "default", query = "" } = {}) {
  const [{ workspace, project }, manuscript] = await Promise.all([
    resolveProject(rootDir, projectId),
    listLatexWorkspace({ rootDir, projectId }),
  ]);
  const bibFiles = manuscript.files.filter((file) => file.extension === ".bib" && !file.hidden).map((file) => file.path);
  return {
    project: { id: project.id, label: project.label },
    items: selectCandidates(workspace, project.id, query),
    bibFiles,
    defaultBibFile: bibFiles[0] || "references.bib",
  };
}

function bibIdentityMatches(candidate, entry) {
  if (entry.doi) return candidate.doi === entry.doi;
  if (entry.url) return candidate.url === entry.url;
  if (entry.file) return candidate.pdfPath === entry.file;
  return Boolean(entry.title && entry.year &&
    normalizeTitle(candidate.bibliographicTitle).toLowerCase() === entry.title &&
    String(candidate.year || "") === entry.year);
}

export async function resolveLatexCitationTokens({ rootDir = process.cwd(), projectId = "default", file, content } = {}) {
  const [{ workspace, project }, manuscript] = await Promise.all([
    resolveProject(rootDir, projectId),
    listLatexWorkspace({ rootDir, projectId }),
  ]);
  const persistedSource = await readLatexSource({ rootDir, projectId, file });
  if (typeof content === "string" && Buffer.byteLength(content, "utf8") > 2 * 1024 * 1024) {
    throw new Error("Manuscript source file is too large to resolve citation references.");
  }
  const source = typeof content === "string" ? { ...persistedSource, content } : persistedSource;
  const bibFiles = manuscript.files
    .filter((item) => item.extension === ".bib" && !item.hidden)
    .map((item) => item.path);
  const bibliography = await Promise.all(bibFiles.map(async (bibFile) => {
    const bib = await readLatexSource({ rootDir, projectId, file: bibFile });
    return { bibFile, entries: parseBibEntries(bib.content) };
  }));
  const candidates = workspace.entries
    .filter((entry) => entry.research === project.id && (entry.type === "literature" || entry.type === "evidence"))
    .map((entry) => candidateFromEntry(workspace, entry));
  const byKey = new Map();
  for (const { bibFile, entries } of bibliography) {
    for (const entry of entries) {
      const key = entry.key.toLowerCase();
      const choices = candidates.filter((candidate) => bibIdentityMatches(candidate, entry));
      const group = byKey.get(key) ?? { key: entry.key, bibFiles: [], choices: new Map() };
      if (!group.bibFiles.includes(bibFile)) group.bibFiles.push(bibFile);
      for (const choice of choices) group.choices.set(choice.slug, publicCandidate(choice));
      byKey.set(key, group);
    }
  }

  const results = [];
  const pattern = /\\cite[a-zA-Z*]*\s*(?:\[[^\]]*\]\s*)*\{([^}]+)\}/g;
  for (const match of source.content.matchAll(pattern)) {
    const tokenStart = match.index ?? 0;
    const bodyStart = tokenStart + match[0].lastIndexOf("{") + 1;
    for (const rawKey of match[1].split(",")) {
      const key = rawKey.trim();
      if (!key) continue;
      const keyStart = bodyStart + match[1].indexOf(rawKey) + rawKey.search(/\S|$/);
      const group = byKey.get(key.toLowerCase());
      const choices = group ? [...group.choices.values()] : [];
      results.push({
        key,
        file: source.file,
        start: keyStart,
        end: keyStart + key.length,
        bibFiles: group?.bibFiles ?? [],
        status: choices.length === 1 ? "resolved" : choices.length > 1 ? "ambiguous" : "missing",
        choices,
      });
    }
  }
  return { file: source.file, citations: results };
}

async function readOrCreateBib({ rootDir, projectId, bibFile }) {
  try {
    return { source: await readLatexSource({ rootDir, projectId, file: bibFile }), created: false };
  } catch (error) {
    if (!/does not exist/i.test(error instanceof Error ? error.message : String(error))) throw error;
    try {
      return { source: await createLatexSource({ rootDir, projectId, file: bibFile, content: "" }), created: true };
    } catch (createError) {
      if (!/already exists/i.test(createError instanceof Error ? createError.message : String(createError))) throw createError;
      return { source: await readLatexSource({ rootDir, projectId, file: bibFile }), created: false };
    }
  }
}

export async function ensureLatexCitation({ rootDir = process.cwd(), projectId = "default", slug, bibFile = "references.bib" } = {}) {
  const { workspace, project } = await resolveProject(rootDir, projectId);
  const origin = workspace.entries.find((entry) => entry.research === project.id && entry.slug === clean(slug, 300));
  if (!origin || (origin.type !== "literature" && origin.type !== "evidence")) throw new Error("Citation source must be project literature or evidence.");
  const candidate = candidateFromEntry(workspace, origin);
  if (!candidate.citationReady) {
    throw new Error(`Citation metadata is incomplete. Add verified ${candidate.missing.join(", ")} before inserting this source.`);
  }

  const manuscript = await listLatexWorkspace({ rootDir, projectId });
  const requestedBib = clean(bibFile, 500).replace(/\\/g, "/") || "references.bib";
  if (!requestedBib.toLowerCase().endsWith(".bib")) throw new Error("Citation library must be a .bib manuscript file.");
  const hidden = manuscript.files.find((file) => file.path === requestedBib)?.hidden;
  if (hidden) throw new Error("Restore the selected .bib file before adding citations.");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { source, created } = await readOrCreateBib({ rootDir, projectId, bibFile: requestedBib });
    const parsed = parseBibEntries(source.content);
    const existing = matchingBibEntry(parsed, candidate);
    if (existing) {
      return {
        created: false,
        bibFileCreated: created,
        key: existing.key,
        bibFile: requestedBib,
        candidate: publicCandidate(candidate),
      };
    }
    const key = uniqueCitationKey(parsed, candidate);
    const bibtex = bibtexFor(candidate, key);
    const nextContent = `${source.content.trimEnd()}${source.content.trim() ? "\n\n" : ""}${bibtex}\n`;
    try {
      await saveLatexSource({
        rootDir,
        projectId,
        file: requestedBib,
        content: nextContent,
        baseSha256: source.baseSha256,
      });
      return {
        created: true,
        bibFileCreated: created,
        key,
        bibFile: requestedBib,
        bibtex,
        candidate: publicCandidate(candidate),
      };
    } catch (error) {
      if (attempt === 0 && error?.code === "LATEX_SOURCE_STALE") continue;
      throw error;
    }
  }
  throw new Error("Citation library changed during insertion. Retry the citation action.");
}
