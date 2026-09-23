import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "../lib/research/compiler.mjs";
import { preparePdfRuntime } from "../lib/research/pdf-runtime.mjs";

const root = process.cwd();
let timer;
let pollTimer;
let polling = false;
let compiling = false;
let rerun = false;
let lastSignature = "";

async function compile(label = "update") {
  if (compiling) {
    rerun = true;
    return;
  }

  compiling = true;
  try {
    const workspace = await writeResearchArtifacts({ rootDir: root, fresh: true });
    lastSignature = workspace.signature;
    const summary =
      workspace.stats.notes + " notes · " +
      workspace.projects.filter((project) => project.notes > 0).length + " projects · " +
      workspace.stats.errors + " errors · " +
      workspace.stats.warnings + " warnings";
    console.log("[research:" + label + "] " + summary);
  } catch (error) {
    console.error("[research] compile failed:", error);
  } finally {
    compiling = false;
    if (rerun) {
      rerun = false;
      void compile("queued");
    }
  }
}

function scheduleCompile() {
  clearTimeout(timer);
  timer = setTimeout(() => void compile("changed"), 120);
}

async function pollForChanges() {
  if (polling || compiling) return;
  polling = true;
  try {
    const workspace = await compileResearchWorkspace({ rootDir: root });
    if (workspace.signature !== lastSignature) scheduleCompile();
  } catch (error) {
    console.warn("[research] Polling check failed:", error);
  } finally {
    polling = false;
  }
}

await preparePdfRuntime(root);
const initial = await writeResearchArtifacts({ rootDir: root, fresh: true });
lastSignature = initial.signature;

const watchers = [];
try {
  watchers.push(fs.watch(initial.progressRoot, { recursive: true }, scheduleCompile));
} catch (error) {
  console.warn("[research] Could not watch progress directory; polling can be enabled with OBSERVAIRE_WATCH_POLL_MS:", error);
}

const configPath = path.join(root, "research-observer.config.json");
try {
  watchers.push(fs.watch(configPath, scheduleCompile));
} catch {
  // Config file is optional.
}

const requestedPollMs = Number(process.env.OBSERVAIRE_WATCH_POLL_MS || 0);
if (Number.isFinite(requestedPollMs) && requestedPollMs > 0) {
  const pollMs = Math.max(500, Math.trunc(requestedPollMs));
  pollTimer = setInterval(() => void pollForChanges(), pollMs);
  pollTimer.unref?.();
  console.log(`[research] Bind-mount polling enabled every ${pollMs}ms.`);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

function shutdown(signal) {
  for (const watcher of watchers) watcher.close();
  clearTimeout(timer);
  if (pollTimer) clearInterval(pollTimer);
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  for (const watcher of watchers) watcher.close();
  clearTimeout(timer);
  if (pollTimer) clearInterval(pollTimer);
  process.exit(code ?? (signal ? 1 : 0));
});
