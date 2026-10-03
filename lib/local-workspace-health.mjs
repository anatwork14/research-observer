import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { codexLoginStatus } from "./settings/codex-auth.mjs";
import { consensusIntegrationStatus } from "./settings/integrations.mjs";
import { compileResearchWorkspace, writeResearchArtifacts } from "./research/compiler.mjs";
import { preparePdfRuntime } from "./research/pdf-runtime.mjs";

const DEFAULT_PATHS = {
  progressDir: "progress",
  annotationDir: "annotations",
  manuscriptsDir: "manuscripts",
};

const EXPECTED_ARTIFACTS = ["manifest.json", "search.json", "graph.json", "health.json"];
const EXPECTED_PDF_RUNTIME = ["pdf.worker.min.mjs", "cmaps", "standard_fonts", "wasm"];

function clean(value) {
  return String(value ?? "").replace(/\u001b\[[0-9;]*m/g, "").replace(/\r/g, "").trim();
}

function safeConfiguredPath(root, value, fallback) {
  const configured = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const resolved = path.resolve(root, configured);
  if (resolved === root || !resolved.startsWith(root + path.sep)) {
    return { path: path.join(root, fallback), valid: false, configured };
  }
  return { path: resolved, valid: true, configured };
}

export function resolveLocalWorkspacePaths(root = process.cwd(), config = {}) {
  const progress = safeConfiguredPath(root, config.progressDir, DEFAULT_PATHS.progressDir);
  const annotations = safeConfiguredPath(root, config.annotationDir, DEFAULT_PATHS.annotationDir);
  const manuscripts = safeConfiguredPath(root, config.manuscriptsDir, DEFAULT_PATHS.manuscriptsDir);
  return {
    progress,
    annotations,
    manuscripts,
    generated: { path: path.join(root, "public", "_research"), valid: true, configured: "public/_research" },
    pdfRuntime: { path: path.join(root, "public", "_research", "pdfjs"), valid: true, configured: "public/_research/pdfjs" },
    codexHome: process.env.CODEX_HOME ? { path: path.resolve(process.env.CODEX_HOME), valid: true, configured: process.env.CODEX_HOME } : null,
  };
}

export function classifyNodeRuntime(version = process.versions.node) {
  const [major = 0, minor = 0] = String(version).split(".").map((value) => Number(value));
  const supported = (major === 22 && minor >= 13) || major === 23 || major === 24;
  return {
    state: supported ? "ready" : "attention",
    detail: supported
      ? `Node ${version} matches the declared >=22.13 <25 runtime range.`
      : `Node ${version} is outside the declared >=22.13 <25 runtime range.`,
  };
}

export function localMaintenanceEnabled(env = process.env, nodeEnv = process.env.NODE_ENV) {
  return nodeEnv !== "production" || env.RESEARCH_OBSERVER_WRITES === "1" || env.OBSERVAIRE_LOCAL_MAINTENANCE === "1";
}

export function summarizeLocalHealth(checks = []) {
  const summary = { ready: 0, attention: 0, unavailable: 0 };
  for (const check of checks) {
    if (check?.state === "ready") summary.ready += 1;
    else if (check?.state === "unavailable") summary.unavailable += 1;
    else summary.attention += 1;
  }
  return {
    ...summary,
    overall: summary.attention > 0 ? "attention" : summary.unavailable > 0 ? "partial" : "ready",
  };
}

async function readConfig(root) {
  try {
    const raw = await fs.readFile(path.join(root, "research-observer.config.json"), "utf8");
    return { config: JSON.parse(raw), error: null };
  } catch (error) {
    if (error?.code === "ENOENT") return { config: {}, error: null };
    return { config: {}, error: "research-observer.config.json could not be parsed." };
  }
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args = [], { timeout = 3500 } = {}) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: process.cwd(),
        env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
        timeout,
        maxBuffer: 512 * 1024,
        shell: process.platform === "win32",
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          missing: error?.code === "ENOENT",
          output: clean(`${stdout ?? ""}\n${stderr ?? ""}`),
        });
      },
    );
  });
}

function relativeLabel(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith("..") ? relative.split(path.sep).join("/") : target;
}

async function storageCheck(id, title, root, entry) {
  const exists = await pathExists(entry.path);
  if (!entry.valid) {
    return {
      id,
      group: "Storage",
      title,
      state: "attention",
      detail: `Configured path ${entry.configured} escapes the repository; Observaire will not use it.`,
      meta: relativeLabel(root, entry.path),
    };
  }
  return {
    id,
    group: "Storage",
    title,
    state: exists ? "ready" : "attention",
    detail: exists ? "Durable local source directory is available." : "Configured durable source directory is missing.",
    meta: relativeLabel(root, entry.path),
  };
}

async function generatedArtifactsCheck(root, generatedPath) {
  const present = await Promise.all(EXPECTED_ARTIFACTS.map((name) => pathExists(path.join(generatedPath, name))));
  const missing = EXPECTED_ARTIFACTS.filter((_, index) => !present[index]);
  return {
    id: "research-artifacts",
    group: "Generated runtime",
    title: "Research artifacts",
    state: missing.length ? "attention" : "ready",
    detail: missing.length
      ? `Missing ${missing.join(", ")}. Rebuild generated research artifacts.`
      : "Manifest, search, graph, and health artifacts are present.",
    meta: relativeLabel(root, generatedPath),
    repair: "rebuild-research",
  };
}

async function pdfRuntimeCheck(root, pdfRuntimePath) {
  const present = await Promise.all(EXPECTED_PDF_RUNTIME.map((name) => pathExists(path.join(pdfRuntimePath, name))));
  const missing = EXPECTED_PDF_RUNTIME.filter((_, index) => !present[index]);
  return {
    id: "pdf-runtime",
    group: "Generated runtime",
    title: "Local PDF.js runtime",
    state: missing.length ? "attention" : "ready",
    detail: missing.length
      ? `PDF.js runtime is incomplete (${missing.join(", ")}).`
      : "Worker, cMaps, standard fonts, and WASM assets are available locally.",
    meta: relativeLabel(root, pdfRuntimePath),
    repair: "prepare-pdf-runtime",
  };
}

async function gitCheck() {
  const repo = await runCommand("git", ["rev-parse", "--is-inside-work-tree"]);
  if (!repo.ok || !/true/i.test(repo.output)) {
    return {
      id: "git",
      group: "Toolchain",
      title: "Git workspace",
      state: "unavailable",
      detail: repo.missing ? "Git is not installed or not on PATH." : "The app is not running inside a Git worktree.",
    };
  }
  const branch = await runCommand("git", ["branch", "--show-current"]);
  return {
    id: "git",
    group: "Toolchain",
    title: "Git workspace",
    state: "ready",
    detail: "Git review/history features can resolve the local repository.",
    meta: branch.ok && branch.output ? branch.output : "detached HEAD",
  };
}

async function texCheck() {
  const [latexmk, pdf, xe, lua] = await Promise.all([
    runCommand("latexmk", ["-v"]),
    runCommand("pdflatex", ["--version"]),
    runCommand("xelatex", ["--version"]),
    runCommand("lualatex", ["--version"]),
  ]);
  const engines = [pdf.ok && "pdfLaTeX", xe.ok && "XeLaTeX", lua.ok && "LuaLaTeX"].filter(Boolean);
  if (!latexmk.ok) {
    return {
      id: "tex",
      group: "Toolchain",
      title: "LaTeX toolchain",
      state: "unavailable",
      detail: "latexmk is unavailable; manuscript editing still works but local compilation is disabled.",
      meta: engines.length ? `${engines.join(" · ")} detected` : undefined,
    };
  }
  return {
    id: "tex",
    group: "Toolchain",
    title: "LaTeX toolchain",
    state: engines.length ? "ready" : "attention",
    detail: engines.length
      ? "latexmk and at least one supported TeX engine are available."
      : "latexmk is available, but no supported TeX engine was detected.",
    meta: engines.length ? engines.join(" · ") : "latexmk only",
  };
}

async function compilerCheck() {
  try {
    const workspace = await compileResearchWorkspace();
    return {
      id: "compiler",
      group: "Core",
      title: "Research compiler",
      state: workspace.stats.errors > 0 ? "attention" : "ready",
      detail: workspace.stats.errors > 0
        ? `${workspace.stats.errors} compiler error(s) require attention.`
        : "Canonical research workspace compiles without integrity errors.",
      meta: `${workspace.stats.notes} notes · ${workspace.stats.warnings} warnings`,
    };
  } catch (error) {
    return {
      id: "compiler",
      group: "Core",
      title: "Research compiler",
      state: "attention",
      detail: error instanceof Error ? error.message : "Research compiler could not run.",
    };
  }
}

async function integrationChecks() {
  const [codexResult, consensusResult] = await Promise.allSettled([
    codexLoginStatus(),
    consensusIntegrationStatus(),
  ]);

  const codex = codexResult.status === "fulfilled" ? codexResult.value : null;
  const consensus = consensusResult.status === "fulfilled" ? consensusResult.value : null;

  return [
    codex
      ? {
          id: "codex",
          group: "Integrations",
          title: "Codex CLI",
          state: codex.authenticated ? "ready" : "unavailable",
          detail: codex.reason || (codex.authenticated ? "Codex is authenticated." : "Codex is optional and not authenticated."),
          meta: codex.mode ? `Auth: ${codex.mode}` : undefined,
        }
      : {
          id: "codex",
          group: "Integrations",
          title: "Codex CLI",
          state: "unavailable",
          detail: "Could not determine Codex CLI status.",
        },
    consensus
      ? {
          id: "consensus",
          group: "Integrations",
          title: "Consensus",
          state: consensus.configured ? "ready" : "unavailable",
          detail: consensus.configured
            ? "Consensus credentials are configured for Research Assist."
            : "Consensus is optional and no API key is configured.",
          meta: consensus.source ? `Source: ${consensus.source}` : undefined,
        }
      : {
          id: "consensus",
          group: "Integrations",
          title: "Consensus",
          state: "unavailable",
          detail: "Could not determine Consensus configuration status.",
        },
  ];
}

export async function collectLocalWorkspaceHealth({ root = process.cwd() } = {}) {
  const { config, error: configError } = await readConfig(root);
  const paths = resolveLocalWorkspacePaths(root, config);
  const node = classifyNodeRuntime();

  const checks = [
    {
      id: "node",
      group: "Core",
      title: "Node runtime",
      state: node.state,
      detail: node.detail,
      meta: process.version,
    },
    {
      id: "config",
      group: "Core",
      title: "Workspace config",
      state: configError ? "attention" : "ready",
      detail: configError || "research-observer.config.json is readable.",
      meta: "research-observer.config.json",
    },
  ];

  const [compiler, progress, annotations, manuscripts, generated, pdfRuntime, git, tex, integrations] = await Promise.all([
    compilerCheck(),
    storageCheck("progress-storage", "Research source", root, paths.progress),
    storageCheck("annotation-storage", "Annotation sidecars", root, paths.annotations),
    storageCheck("manuscript-storage", "Manuscript source", root, paths.manuscripts),
    generatedArtifactsCheck(root, paths.generated.path),
    pdfRuntimeCheck(root, paths.pdfRuntime.path),
    gitCheck(),
    texCheck(),
    integrationChecks(),
  ]);

  checks.push(compiler, progress, annotations, manuscripts, generated, pdfRuntime, git, tex, ...integrations);
  const summary = summarizeLocalHealth(checks);

  return {
    generatedAt: new Date().toISOString(),
    maintenanceEnabled: localMaintenanceEnabled(),
    summary,
    paths: {
      progress: relativeLabel(root, paths.progress.path),
      annotations: relativeLabel(root, paths.annotations.path),
      manuscripts: relativeLabel(root, paths.manuscripts.path),
      generated: relativeLabel(root, paths.generated.path),
      pdfRuntime: relativeLabel(root, paths.pdfRuntime.path),
      ...(paths.codexHome ? { codexHome: relativeLabel(root, paths.codexHome.path) } : {}),
    },
    checks,
  };
}

export async function repairLocalWorkspace(action) {
  if (!localMaintenanceEnabled()) {
    throw new Error("Local maintenance is disabled. Set OBSERVAIRE_LOCAL_MAINTENANCE=1 or RESEARCH_OBSERVER_WRITES=1 when running a production build locally.");
  }

  if (action === "rebuild-research" || action === "repair-generated") {
    const workspace = await writeResearchArtifacts({ fresh: true });
    if (workspace.stats.errors > 0) {
      throw new Error(`Research rebuild completed with ${workspace.stats.errors} compiler error(s).`);
    }
  }

  if (action === "prepare-pdf-runtime" || action === "repair-generated") {
    await preparePdfRuntime();
  }

  if (!["rebuild-research", "prepare-pdf-runtime", "repair-generated"].includes(action)) {
    throw new Error("Unsupported local maintenance action.");
  }

  return collectLocalWorkspaceHealth();
}
