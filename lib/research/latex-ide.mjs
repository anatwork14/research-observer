import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace } from "./compiler.mjs";

const EDITABLE_EXTENSIONS = new Set([".tex", ".bib", ".sty", ".cls", ".bst"]);
const RESOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".eps"]);
const ENGINES = new Set(["pdflatex", "xelatex", "lualatex"]);
const STATE_FILE = ".observaire-ide.json";
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_LOG_BYTES = 2 * 1024 * 1024;

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function safeConfiguredDir(root, value, fallback) {
  const configured = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const resolved = path.resolve(root, configured);
  if (resolved === root || !resolved.startsWith(root + path.sep)) throw new Error(`${fallback} directory must stay inside the repository.`);
  return resolved;
}

function safeRelativePath(value, { allowState = false } = {}) {
  const raw = String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!raw) throw new Error("A manuscript file path is required.");
  const normalized = path.posix.normalize(raw);
  if (
    normalized === "." || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized) ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
  ) throw new Error("Manuscript paths must stay inside the selected project.");
  if (!allowState && normalized === STATE_FILE) throw new Error("The IDE state file is managed by Observaire.");
  return normalized;
}

function cleanProjectId(value) {
  const id = String(value ?? "default").trim() || "default";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Project id must use lowercase kebab-case.");
  return id;
}

function cleanEngine(value) {
  const engine = String(value ?? "pdflatex").trim().toLowerCase();
  if (!ENGINES.has(engine)) throw new Error("Choose pdflatex, xelatex, or lualatex.");
  return engine;
}

function cleanContent(value) {
  const content = String(value ?? "").replace(/\r\n/g, "\n");
  if (Buffer.byteLength(content, "utf8") > MAX_SOURCE_BYTES) throw new Error("Manuscript source file is too large for browser editing.");
  return content;
}

async function resolveProject(rootDir, projectId, { create = false } = {}) {
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const id = cleanProjectId(projectId);
  const project = workspace.projects.find((item) => item.id === id);
  if (!project) throw new Error("Choose a research project that exists in this workspace.");
  const manuscriptsRoot = safeConfiguredDir(root, workspace.config.manuscriptsDir, "manuscripts");
  const projectRoot = path.join(manuscriptsRoot, id);
  if (create) await fs.mkdir(projectRoot, { recursive: true });
  return { root, workspace, project, projectRoot, statePath: path.join(projectRoot, STATE_FILE) };
}

async function readState(resolved) {
  try {
    const parsed = JSON.parse(await fs.readFile(resolved.statePath, "utf8"));
    return {
      schemaVersion: 1,
      mainFile: typeof parsed.mainFile === "string" ? parsed.mainFile : "",
      engine: ENGINES.has(parsed.engine) ? parsed.engine : "pdflatex",
      hiddenFiles: Array.isArray(parsed.hiddenFiles) ? [...new Set(parsed.hiddenFiles.filter((item) => typeof item === "string"))] : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { schemaVersion: 1, mainFile: "", engine: "pdflatex", hiddenFiles: [], updatedAt: null };
    throw new Error("Could not parse the manuscript IDE state file.");
  }
}

async function writeState(resolved, state) {
  await fs.mkdir(resolved.projectRoot, { recursive: true });
  const next = { ...state, schemaVersion: 1, updatedAt: new Date().toISOString() };
  const temp = `${resolved.statePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(next, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  await fs.rename(temp, resolved.statePath);
  return next;
}

async function walkFiles(root, current = root) {
  let entries;
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const out = [];
  for (const entry of entries) {
    if (entry.name === STATE_FILE || entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      out.push(...await walkFiles(root, absolute));
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!EDITABLE_EXTENSIONS.has(extension) && !RESOURCE_EXTENSIONS.has(extension)) continue;
    const stat = await fs.stat(absolute);
    out.push({
      path: relative,
      extension,
      bytes: stat.size,
      editable: EDITABLE_EXTENSIONS.has(extension),
      kind: EDITABLE_EXTENSIONS.has(extension) ? "source" : "resource",
    });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function detectMainFile(projectRoot, files, state) {
  if (state.mainFile && files.some((file) => file.path === state.mainFile && file.extension === ".tex")) return state.mainFile;
  if (files.some((file) => file.path === "main.tex")) return "main.tex";
  for (const file of files.filter((item) => item.extension === ".tex")) {
    try {
      const head = await fs.readFile(path.join(projectRoot, ...file.path.split("/")), "utf8");
      if (/\\documentclass(?:\[[^\]]*\])?\{/.test(head)) return file.path;
    } catch {
      // Continue to the next TeX source.
    }
  }
  return files.find((file) => file.extension === ".tex")?.path ?? "";
}

function publicWorkspace(resolved, files, state, mainFile) {
  const hidden = new Set(state.hiddenFiles);
  return {
    project: { id: resolved.project.id, label: resolved.project.label },
    files: files.map((file) => ({ ...file, hidden: hidden.has(file.path) })),
    mainFile,
    engine: state.engine,
    updatedAt: state.updatedAt,
  };
}

export async function listLatexWorkspace({ rootDir = process.cwd(), projectId = "default" } = {}) {
  const resolved = await resolveProject(rootDir, projectId);
  const [files, state] = await Promise.all([walkFiles(resolved.projectRoot), readState(resolved)]);
  const mainFile = await detectMainFile(resolved.projectRoot, files, state);
  return publicWorkspace(resolved, files, state, mainFile);
}

export async function readLatexSource({ rootDir = process.cwd(), projectId = "default", file } = {}) {
  const resolved = await resolveProject(rootDir, projectId);
  const relative = safeRelativePath(file);
  const extension = path.posix.extname(relative).toLowerCase();
  if (!EDITABLE_EXTENSIONS.has(extension)) throw new Error("This manuscript file is not editable as text.");
  const absolute = path.join(resolved.projectRoot, ...relative.split("/"));
  let content;
  try {
    content = await fs.readFile(absolute, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Manuscript file does not exist.");
    throw error;
  }
  if (Buffer.byteLength(content, "utf8") > MAX_SOURCE_BYTES) throw new Error("Manuscript source file is too large for browser editing.");
  return { file: relative, content, baseSha256: sha256(content) };
}

export async function createLatexSource({ rootDir = process.cwd(), projectId = "default", file, content = "" } = {}) {
  const resolved = await resolveProject(rootDir, projectId, { create: true });
  const relative = safeRelativePath(file);
  const extension = path.posix.extname(relative).toLowerCase();
  if (!EDITABLE_EXTENSIONS.has(extension)) throw new Error("New manuscript files must use .tex, .bib, .sty, .cls, or .bst.");
  const source = cleanContent(content);
  const absolute = path.join(resolved.projectRoot, ...relative.split("/"));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  try {
    await fs.writeFile(absolute, source, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("A manuscript file already exists at this path.");
    throw error;
  }
  const state = await readState(resolved);
  if (!state.mainFile && extension === ".tex") await writeState(resolved, { ...state, mainFile: relative });
  return readLatexSource({ rootDir, projectId, file: relative });
}

export async function saveLatexSource({ rootDir = process.cwd(), projectId = "default", file, content, baseSha256 } = {}) {
  const resolved = await resolveProject(rootDir, projectId);
  const relative = safeRelativePath(file);
  const extension = path.posix.extname(relative).toLowerCase();
  if (!EDITABLE_EXTENSIONS.has(extension)) throw new Error("This manuscript file is not editable as text.");
  const absolute = path.join(resolved.projectRoot, ...relative.split("/"));
  const current = await fs.readFile(absolute, "utf8");
  if (!baseSha256 || sha256(current) !== String(baseSha256)) {
    const error = new Error("This manuscript file changed after it was opened. Reload it before saving.");
    error.code = "LATEX_SOURCE_STALE";
    throw error;
  }
  const next = cleanContent(content);
  await fs.writeFile(absolute, next, "utf8");
  return { file: relative, content: next, baseSha256: sha256(next) };
}

export async function setLatexFileHidden({ rootDir = process.cwd(), projectId = "default", file, hidden = true } = {}) {
  const resolved = await resolveProject(rootDir, projectId);
  const relative = safeRelativePath(file);
  const absolute = path.join(resolved.projectRoot, ...relative.split("/"));
  const stat = await fs.stat(absolute).catch(() => null);
  if (!stat?.isFile()) throw new Error("Manuscript file does not exist.");
  const state = await readState(resolved);
  const hiddenFiles = new Set(state.hiddenFiles);
  if (hidden) hiddenFiles.add(relative); else hiddenFiles.delete(relative);
  const next = await writeState(resolved, {
    ...state,
    hiddenFiles: [...hiddenFiles].sort(),
    mainFile: hidden && state.mainFile === relative ? "" : state.mainFile,
  });
  const files = await walkFiles(resolved.projectRoot);
  const mainFile = await detectMainFile(resolved.projectRoot, files.filter((item) => !hiddenFiles.has(item.path)), next);
  return publicWorkspace(resolved, files, next, mainFile);
}

export async function configureLatexWorkspace({ rootDir = process.cwd(), projectId = "default", mainFile, engine } = {}) {
  const resolved = await resolveProject(rootDir, projectId, { create: true });
  const state = await readState(resolved);
  const files = await walkFiles(resolved.projectRoot);
  const hidden = new Set(state.hiddenFiles);
  const nextMain = mainFile === undefined ? state.mainFile : safeRelativePath(mainFile);
  if (nextMain && (!files.some((item) => item.path === nextMain && item.extension === ".tex") || hidden.has(nextMain))) {
    throw new Error("Main file must be a visible .tex source in this manuscript project.");
  }
  const next = await writeState(resolved, {
    ...state,
    mainFile: nextMain,
    engine: engine === undefined ? state.engine : cleanEngine(engine),
  });
  const detected = await detectMainFile(resolved.projectRoot, files.filter((item) => !hidden.has(item.path)), next);
  return publicWorkspace(resolved, files, next, detected);
}

export function latexWritesEnabled() {
  return process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";
}

export function latexCompileEnabled() {
  if (process.env.RESEARCH_OBSERVER_LATEX === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function runProcess(command, args, { cwd, env, timeoutMs = 90_000, maxBytes = MAX_LOG_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const append = (target, chunk) => {
      const next = target + chunk.toString("utf8");
      return Buffer.byteLength(next, "utf8") > maxBytes ? next.slice(-maxBytes) : next;
    };
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.once("error", reject);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: typeof code === "number" ? code : 1, signal, stdout, stderr, timedOut, durationMs: Date.now() - started });
    });
  });
}

async function executableStatus(command, args = ["--version"]) {
  try {
    const result = await runProcess(command, args, { timeoutMs: 5_000, maxBytes: 24_000 });
    const firstLine = (result.stdout || result.stderr).split(/\r?\n/).find(Boolean) ?? "";
    return { available: result.code === 0, version: firstLine.slice(0, 300) };
  } catch (error) {
    return { available: false, version: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function latexToolchainStatus() {
  const [latexmk, synctex] = await Promise.all([
    executableStatus("latexmk", ["-v"]),
    executableStatus("synctex", ["--version"]),
  ]);
  return { compileEnabled: latexCompileEnabled(), writesEnabled: latexWritesEnabled(), latexmk, synctex };
}

function latexmkArgs(engine, buildDir, sourcePath) {
  const common = "-interaction=nonstopmode -file-line-error -synctex=1 -halt-on-error -no-shell-escape %O %S";
  if (engine === "xelatex") {
    return ["-xelatex", "-cd", `-outdir=${buildDir}`, `-xelatex=xelatex ${common}`, sourcePath];
  }
  if (engine === "lualatex") {
    return ["-lualatex", "-cd", `-outdir=${buildDir}`, `-lualatex=lualatex ${common}`, sourcePath];
  }
  return ["-pdf", "-cd", `-outdir=${buildDir}`, `-pdflatex=pdflatex ${common}`, sourcePath];
}

function parseDiagnostics(log, manuscriptRoot) {
  const diagnostics = [];
  const seen = new Set();
  for (const rawLine of log.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const location = line.match(/^(.+?\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/i);
    if (location) {
      let file = location[1];
      if (path.isAbsolute(file)) {
        const relative = path.relative(manuscriptRoot, file);
        if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) file = relative.split(path.sep).join("/");
      }
      const message = location[3].trim();
      const severity = /warning/i.test(message) ? "warning" : "error";
      const key = `${severity}:${file}:${location[2]}:${message}`;
      if (!seen.has(key)) {
        diagnostics.push({ severity, file, line: Number(location[2]), message });
        seen.add(key);
      }
      continue;
    }
    if (line.startsWith("! ")) {
      const message = line.slice(2).trim();
      const key = `error:${message}`;
      if (!seen.has(key)) {
        diagnostics.push({ severity: "error", message });
        seen.add(key);
      }
      continue;
    }
    if (/^(LaTeX|Package .+) Warning:/i.test(line)) {
      const key = `warning:${line}`;
      if (!seen.has(key)) {
        diagnostics.push({ severity: "warning", message: line });
        seen.add(key);
      }
    }
  }
  return diagnostics.slice(0, 250);
}

function buildRootFor(root, projectId) {
  return path.join(root, ".research-observer", "latex-builds", projectId);
}

function cleanBuildId(value) {
  const id = String(value ?? "").trim();
  if (!/^[a-z0-9-]{8,80}$/.test(id)) throw new Error("Build id is invalid.");
  return id;
}

export async function compileLatexProject({ rootDir = process.cwd(), projectId = "default", mainFile, engine } = {}) {
  if (!latexCompileEnabled()) throw new Error("LaTeX compilation is disabled in this environment. Set RESEARCH_OBSERVER_LATEX=1 to enable it in production.");
  const resolved = await resolveProject(rootDir, projectId);
  const files = await walkFiles(resolved.projectRoot);
  const state = await readState(resolved);
  const hidden = new Set(state.hiddenFiles);
  const source = safeRelativePath(mainFile || await detectMainFile(resolved.projectRoot, files.filter((item) => !hidden.has(item.path)), state));
  if (hidden.has(source)) throw new Error("The selected main file is hidden. Restore it before compiling.");
  if (path.posix.extname(source).toLowerCase() !== ".tex") throw new Error("Choose a .tex main file before compiling.");
  const sourceAbsolute = path.join(resolved.projectRoot, ...source.split("/"));
  const sourceStat = await fs.stat(sourceAbsolute).catch(() => null);
  if (!sourceStat?.isFile()) throw new Error("The selected main TeX file does not exist.");
  const selectedEngine = cleanEngine(engine || state.engine);
  const toolchain = await latexToolchainStatus();
  if (!toolchain.latexmk.available) throw new Error("latexmk is not installed. Use the project Docker image or install a TeX Live distribution with latexmk.");

  const buildId = `${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
  const buildDir = path.join(buildRootFor(resolved.root, resolved.project.id), buildId);
  await fs.mkdir(buildDir, { recursive: true });
  const args = latexmkArgs(selectedEngine, buildDir, sourceAbsolute);
  const result = await runProcess("latexmk", args, {
    cwd: path.dirname(sourceAbsolute),
    env: {
      HOME: buildDir,
      TEXMFOUTPUT: buildDir,
      openout_any: "p",
      shell_escape: "0",
    },
  });
  const log = [result.stdout, result.stderr].filter(Boolean).join("\n").slice(-MAX_LOG_BYTES);
  const basename = path.basename(source, ".tex");
  const pdfPath = path.join(buildDir, `${basename}.pdf`);
  const synctexPath = path.join(buildDir, `${basename}.synctex.gz`);
  const pdfStat = await fs.stat(pdfPath).catch(() => null);
  const success = result.code === 0 && Boolean(pdfStat?.isFile());
  const diagnostics = parseDiagnostics(log, resolved.projectRoot);
  let pdfUrl = "";

  if (success) {
    const publicDir = path.join(resolved.root, "public", "_research", "latex", resolved.project.id, buildId);
    await fs.mkdir(publicDir, { recursive: true });
    await fs.copyFile(pdfPath, path.join(publicDir, `${basename}.pdf`));
    const syncStat = await fs.stat(synctexPath).catch(() => null);
    if (syncStat?.isFile()) await fs.copyFile(synctexPath, path.join(publicDir, `${basename}.synctex.gz`));
    pdfUrl = `/_research/latex/${encodeURIComponent(resolved.project.id)}/${encodeURIComponent(buildId)}/${encodeURIComponent(basename)}.pdf`;
  }

  const metadata = {
    schemaVersion: 1,
    id: buildId,
    project: resolved.project.id,
    mainFile: source,
    engine: selectedEngine,
    success,
    exitCode: result.code,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    pdf: success ? `${basename}.pdf` : null,
    synctex: await fs.stat(synctexPath).then(() => `${basename}.synctex.gz`).catch(() => null),
    pdfUrl,
    diagnostics,
    createdAt: new Date().toISOString(),
    log,
  };
  await fs.writeFile(path.join(buildDir, "build.json"), JSON.stringify(metadata, null, 2) + "\n", "utf8");
  return metadata;
}

async function loadBuild(rootDir, projectId, buildId) {
  const resolved = await resolveProject(rootDir, projectId);
  const id = cleanBuildId(buildId);
  const buildDir = path.join(buildRootFor(resolved.root, resolved.project.id), id);
  let metadata;
  try {
    metadata = JSON.parse(await fs.readFile(path.join(buildDir, "build.json"), "utf8"));
  } catch {
    throw new Error("LaTeX build does not exist or is no longer available.");
  }
  if (metadata.project !== resolved.project.id || metadata.id !== id) throw new Error("LaTeX build metadata is invalid.");
  const pdfPath = metadata.pdf ? path.join(buildDir, metadata.pdf) : "";
  return { resolved, buildDir, metadata, pdfPath };
}

export async function latestLatexBuild({ rootDir = process.cwd(), projectId = "default" } = {}) {
  const resolved = await resolveProject(rootDir, projectId);
  const root = buildRootFor(resolved.root, resolved.project.id);
  let names = [];
  try {
    names = await fs.readdir(root);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  for (const name of names.sort().reverse()) {
    try {
      const { metadata } = await loadBuild(rootDir, projectId, name);
      return metadata;
    } catch {
      // Skip incomplete build directories.
    }
  }
  return null;
}

function parseSyncResult(output) {
  const result = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    result[key] = value;
  }
  return result;
}

export async function forwardSyncLatex({ rootDir = process.cwd(), projectId = "default", buildId, file, line, column = 0 } = {}) {
  const { resolved, metadata, pdfPath } = await loadBuild(rootDir, projectId, buildId);
  if (!metadata.success || !pdfPath) throw new Error("Compile the manuscript successfully before using SyncTeX.");
  const relative = safeRelativePath(file);
  const absolute = path.join(resolved.projectRoot, ...relative.split("/"));
  const lineNumber = Number(line);
  const columnNumber = Number(column);
  if (!Number.isInteger(lineNumber) || lineNumber < 1 || !Number.isInteger(columnNumber) || columnNumber < 0) throw new Error("SyncTeX source position is invalid.");
  const result = await runProcess("synctex", ["view", "-i", `${lineNumber}:${columnNumber}:${absolute}`, "-o", pdfPath], { cwd: resolved.projectRoot, timeoutMs: 10_000, maxBytes: 128_000 });
  if (result.code !== 0) throw new Error((result.stderr || result.stdout || "SyncTeX forward search failed.").trim());
  const parsed = parseSyncResult(result.stdout);
  const page = Number(parsed.page);
  if (!Number.isFinite(page) || page < 1) throw new Error("SyncTeX could not map this source location into the PDF.");
  return {
    page,
    x: Number(parsed.x ?? parsed.h ?? 0),
    y: Number(parsed.y ?? parsed.v ?? 0),
    width: Number(parsed.w ?? parsed.width ?? 0),
    height: Number(parsed.h ?? parsed.height ?? 0),
    raw: result.stdout.slice(0, 12_000),
  };
}

export async function reverseSyncLatex({ rootDir = process.cwd(), projectId = "default", buildId, page, x, y } = {}) {
  const { resolved, metadata, pdfPath } = await loadBuild(rootDir, projectId, buildId);
  if (!metadata.success || !pdfPath) throw new Error("Compile the manuscript successfully before using SyncTeX.");
  const pageNumber = Number(page);
  const px = Number(x);
  const py = Number(y);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isFinite(px) || !Number.isFinite(py)) throw new Error("SyncTeX PDF position is invalid.");
  const result = await runProcess("synctex", ["edit", "-o", `${pageNumber}:${px}:${py}:${pdfPath}`], { cwd: resolved.projectRoot, timeoutMs: 10_000, maxBytes: 128_000 });
  if (result.code !== 0) throw new Error((result.stderr || result.stdout || "SyncTeX reverse search failed.").trim());
  const parsed = parseSyncResult(result.stdout);
  const input = parsed.input;
  const line = Number(parsed.line);
  const column = Number(parsed.column ?? 0);
  if (!input || !Number.isFinite(line) || line < 1) throw new Error("SyncTeX could not map this PDF location back to source.");
  const absolute = path.isAbsolute(input) ? path.normalize(input) : path.resolve(path.dirname(path.join(resolved.projectRoot, ...metadata.mainFile.split("/"))), input);
  const relative = path.relative(resolved.projectRoot, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("SyncTeX resolved to a source file outside this manuscript project.");
  return { file: relative.split(path.sep).join("/"), line, column: Number.isFinite(column) ? column : 0, raw: result.stdout.slice(0, 12_000) };
}

export const latexEditableExtensions = [...EDITABLE_EXTENSIONS];
export const latexEngines = [...ENGINES];
