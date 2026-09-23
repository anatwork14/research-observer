import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function run(command, args, { cwd, input, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code: code ?? (signal ? 1 : 0),
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

export async function runGit(cwd, args, options = {}) {
  return run("git", args, { cwd, ...options });
}

export function parseStatusPaths(output) {
  const paths = [];
  for (const record of output.split("\0").filter(Boolean)) {
    if (/^[ MADRCU?!]{2} /.test(record)) paths.push(record.slice(3));
    else paths.push(record);
  }
  return [...new Set(paths.filter(Boolean))];
}

export function allResearchPaths(paths) {
  return paths.length > 0 && paths.every((file) => {
    if (!(file === "progress" || file.startsWith("progress/"))) return false;
    return !/(^|\/)AGENTS\.md$/i.test(file);
  });
}

export async function gitStatusPaths(root) {
  const result = await runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (result.code !== 0) throw new Error(result.stderr || "git status failed");
  return parseStatusPaths(result.stdout);
}

export async function withDetachedWorktree(root, task) {
  const parent = path.join(os.tmpdir(), "research-observer-codex");
  await fs.mkdir(parent, { recursive: true });
  const worktree = path.join(parent, crypto.randomUUID());

  const add = await runGit(root, ["worktree", "add", "--detach", worktree, "HEAD"], { timeoutMs: 60000 });
  if (add.code !== 0) throw new Error(add.stderr || "Could not create Codex worktree.");

  try {
    return await task(worktree);
  } finally {
    await runGit(root, ["worktree", "remove", "--force", worktree], { timeoutMs: 60000 }).catch(() => null);
    await fs.rm(worktree, { recursive: true, force: true }).catch(() => null);
  }
}

export async function collectResearchDiff(worktree) {
  const statusPaths = await gitStatusPaths(worktree);
  if (!statusPaths.length) return { files: [], patch: "", allowed: true };

  const allowed = allResearchPaths(statusPaths);
  if (allowed) {
    const intent = await runGit(worktree, ["add", "-N", "--", "progress"]);
    if (intent.code !== 0) throw new Error(intent.stderr || "Could not prepare untracked research files for diff.");
  }

  const diff = await runGit(worktree, ["diff", "--binary", "--no-ext-diff", "--"]);
  if (diff.code !== 0) throw new Error(diff.stderr || "Could not collect Codex proposal diff.");
  const patchBytes = Buffer.byteLength(diff.stdout, "utf8");
  const binary = diff.stdout.includes("GIT binary patch");
  const reviewable = patchBytes <= 120000 && !binary;
  return { files: statusPaths, patch: diff.stdout, allowed, reviewable, patchBytes, binary };
}

export async function runResearchDoctor(root, cwd = root) {
  const script = path.join(root, "scripts", "research-doctor.mjs");
  return run(process.execPath, [script], { cwd, timeoutMs: 120000 });
}

function draftDirectory(root) {
  return path.join(root, ".research-observer", "codex-drafts");
}

export async function storeProposal(root, proposal) {
  const id = crypto.randomUUID();
  const directory = draftDirectory(root);
  await fs.mkdir(directory, { recursive: true });
  const patchPath = path.join(directory, id + ".patch");
  const metaPath = path.join(directory, id + ".json");

  const metadata = {
    id,
    kind: proposal.kind || "codex",
    createdAt: new Date().toISOString(),
    files: proposal.files,
    valid: proposal.valid,
    reviewable: proposal.reviewable,
    doctor: proposal.doctor,
    summary: proposal.summary,
    ...(proposal.slug ? { slug: proposal.slug } : {}),
    ...(proposal.filename ? { filename: proposal.filename } : {}),
    ...(proposal.baseSha256 ? { baseSha256: proposal.baseSha256 } : {}),
    ...(proposal.workspaceSignature ? { workspaceSignature: proposal.workspaceSignature } : {}),
    patchSha256: crypto.createHash("sha256").update(proposal.patch, "utf8").digest("hex"),
  };

  await Promise.all([
    fs.writeFile(patchPath, proposal.patch, "utf8"),
    fs.writeFile(metaPath, JSON.stringify(metadata, null, 2) + "\n", "utf8"),
  ]);
  return metadata;
}

export async function loadProposal(root, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid proposal ID.");
  const directory = draftDirectory(root);
  const [metadataRaw, patch] = await Promise.all([
    fs.readFile(path.join(directory, id + ".json"), "utf8"),
    fs.readFile(path.join(directory, id + ".patch"), "utf8"),
  ]);
  return { metadata: JSON.parse(metadataRaw), patch };
}

export async function deleteProposal(root, id) {
  const directory = draftDirectory(root);
  await Promise.all([
    fs.rm(path.join(directory, id + ".json"), { force: true }),
    fs.rm(path.join(directory, id + ".patch"), { force: true }),
  ]);
}
