import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "../lib/research/compiler.mjs";

const root = process.cwd();
let timer;
let compiling = false;
let rerun = false;

async function compile(label = "update") {
  if (compiling) {
    rerun = true;
    return;
  }

  compiling = true;
  try {
    const workspace = await writeResearchArtifacts({ rootDir: root, fresh: true });
    const summary =
      workspace.stats.notes + " notes · " +
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

const initial = await compileResearchWorkspace({ rootDir: root, fresh: true });
await writeResearchArtifacts({ rootDir: root, fresh: true });

const watchers = [];
try {
  watchers.push(fs.watch(initial.progressRoot, { recursive: true }, scheduleCompile));
} catch (error) {
  console.warn("[research] Could not watch progress directory:", error);
}

const configPath = path.join(root, "research-observer.config.json");
try {
  watchers.push(fs.watch(configPath, scheduleCompile));
} catch {
  // Config file is optional.
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
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  for (const watcher of watchers) watcher.close();
  clearTimeout(timer);
  process.exit(code ?? (signal ? 1 : 0));
});
