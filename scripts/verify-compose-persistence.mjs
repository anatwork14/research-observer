import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const id = crypto.randomUUID().slice(0, 8);
const project = `observaire-persistence-${id}`;
const stateVolume = `observaire-profile-verification-${id}`;
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-compose-persistence-"));
const researchDir = path.join(fixtureRoot, "progress");
const annotationsDir = path.join(fixtureRoot, "annotations");
const manuscriptsDir = path.join(fixtureRoot, "manuscripts");
const stateMarker = "state-volume-survives-recreate";

if (stateVolume === "observaire-profile") throw new Error("Persistence verification must never use the normal Observaire state volume.");

async function run(command, args, { allowFailure = false, capture = false } = {}) {
  const stdout = [];
  const stderr = [];
  const child = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      OBSERVAIRE_RESEARCH_DIR: researchDir,
      OBSERVAIRE_ANNOTATIONS_DIR: annotationsDir,
      OBSERVAIRE_MANUSCRIPTS_DIR: manuscriptsDir,
      OBSERVAIRE_STATE_VOLUME: stateVolume,
      OBSERVAIRE_PORT: "0",
      ...(typeof process.getuid === "function" ? { OBSERVAIRE_UID: String(process.getuid()) } : {}),
      ...(typeof process.getgid === "function" ? { OBSERVAIRE_GID: String(process.getgid()) } : {}),
    },
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (capture) {
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
  }
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({
      code: code ?? (signal ? 1 : 0),
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
  if (!allowFailure && result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

async function writeFixtures() {
  await Promise.all([
    fs.mkdir(researchDir, { recursive: true }),
    fs.mkdir(path.join(annotationsDir, "default"), { recursive: true }),
    fs.mkdir(path.join(manuscriptsDir, "default"), { recursive: true }),
  ]);
  await fs.writeFile(path.join(researchDir, "00_persistence.md"), `---\nid: persistence-fixture\ntitle: Persistence fixture\ntype: literature\nstatus: complete\nauthors:\n  - Observaire Verification\nyear: 2026\n---\n\n# Persistence fixture\n\nDurable research bytes.\n`, "utf8");
  await fs.writeFile(path.join(annotationsDir, "default", "persistence.json"), JSON.stringify({
    schemaVersion: 2,
    revision: 1,
    marker: "durable annotation bytes",
  }, null, 2) + "\n", "utf8");
  await fs.writeFile(path.join(manuscriptsDir, "default", "main.tex"), "\\documentclass{article}\n\\begin{document}\nDurable manuscript bytes.\n\\end{document}\n", "utf8");
}

const mountedFiles = [
  { path: path.join(researchDir, "00_persistence.md"), containerPath: "/app/progress/00_persistence.md" },
  { path: path.join(annotationsDir, "default", "persistence.json"), containerPath: "/app/annotations/default/persistence.json" },
  { path: path.join(manuscriptsDir, "default", "main.tex"), containerPath: "/app/manuscripts/default/main.tex" },
];
const expectedHashes = new Map();
async function verifyHostBytes() {
  for (const file of mountedFiles) {
    const actual = crypto.createHash("sha256").update(await fs.readFile(file.path)).digest("hex");
    if (actual !== expectedHashes.get(file.path)) throw new Error(`Host fixture bytes changed: ${file.path}`);
  }
}

function mountedChecks() {
  return mountedFiles
    .map((file) => `test -s '${file.containerPath}' && test "$(sha256sum '${file.containerPath}' | cut -d ' ' -f 1)" = '${expectedHashes.get(file.path)}'`)
    .join(" && ");
}

async function probeStateVolume() {
  const probe = await run("docker", [
    "compose", "-p", project, "run", "--rm", "--no-deps", "observaire",
    "sh", "-lc",
    `set -eu; test -w /app/.research-observer; printf '%s\\n' '${stateMarker}' > /app/.research-observer/persistence-marker.txt; sync; grep -Fxq '${stateMarker}' /app/.research-observer/persistence-marker.txt`,
  ], { allowFailure: true, capture: true });
  if (probe.code === 0) return;

  const detail = `${probe.stderr}\n${probe.stdout}`.trim();
  const disk = await run("docker", ["system", "df"], { allowFailure: true, capture: true }).catch(() => ({ stdout: "", stderr: "" }));
  const storageFailure = /(?:i\/o error|input\/output error|no space left on device|enospc|disk quota)/i.test(detail);
  const permissionFailure = /permission denied/i.test(detail);
  const hint = storageFailure
    ? "Docker's storage backend is not writable or is out of space. Free/expand Docker VM storage, then rerun verification. This is an infrastructure failure; the persistence gate must remain failed until the write+fsync probe succeeds."
    : permissionFailure
      ? "The Observaire runtime UID/GID cannot write the disposable state volume. Check Docker volume ownership/copy-up permissions; do not bypass this by running the application as root."
      : "The disposable Observaire state volume failed a write+fsync/readback probe with the real application image and runtime user.";
  throw new Error([
    `[verify:persistence] state-volume preflight failed for ${stateVolume}.`,
    hint,
    detail ? `Probe output:\n${detail}` : "Probe returned no diagnostic output.",
    disk.stdout?.trim() ? `Docker storage summary:\n${disk.stdout.trim()}` : "",
    disk.stderr?.trim() ? `Docker storage diagnostic:\n${disk.stderr.trim()}` : "",
  ].filter(Boolean).join("\n\n"));
}

console.log(`[verify:persistence] project: ${project}`);
console.log(`[verify:persistence] disposable state volume: ${stateVolume}`);
console.log(`[verify:persistence] fixture root: ${fixtureRoot}`);

try {
  await writeFixtures();
  for (const file of mountedFiles) {
    expectedHashes.set(file.path, crypto.createHash("sha256").update(await fs.readFile(file.path)).digest("hex"));
  }
  await run("docker", ["volume", "create", stateVolume]);
  await run("docker", ["compose", "-p", project, "build", "observaire"]);
  await probeStateVolume();
  console.log("[verify:persistence] disposable state-volume write+fsync preflight: PASS");

  await run("docker", ["compose", "-p", project, "up", "-d", "--no-build", "observaire"]);
  await run("docker", ["compose", "-p", project, "exec", "-T", "observaire", "sh", "-lc", `${mountedChecks()} && grep -Fxq '${stateMarker}' /app/.research-observer/persistence-marker.txt`]);

  await run("docker", ["compose", "-p", project, "down"]);

  await verifyHostBytes();

  await run("docker", ["compose", "-p", project, "up", "-d", "--no-build", "observaire"]);
  await run("docker", ["compose", "-p", project, "exec", "-T", "observaire", "sh", "-lc", `${mountedChecks()} && grep -Fxq '${stateMarker}' /app/.research-observer/persistence-marker.txt`]);
  await verifyHostBytes();

  console.log("[verify:persistence] PASS");
  console.log("research bind mount: PASS");
  console.log("annotation bind mount: PASS");
  console.log("manuscript bind mount: PASS");
  console.log("exact SHA-256 bytes before and after recreation: PASS");
  console.log("state volume write+fsync and recreation: PASS");
} finally {
  await run("docker", ["compose", "-p", project, "down"], { allowFailure: true }).catch(() => null);
  await run("docker", ["volume", "rm", "-f", stateVolume], { allowFailure: true }).catch(() => null);
  await fs.rm(fixtureRoot, { recursive: true, force: true }).catch(() => null);
}
