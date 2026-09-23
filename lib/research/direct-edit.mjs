import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";
import {
  deleteProposal,
  loadProposal,
  runGit,
  runResearchDoctor,
  storeProposal,
  withDetachedWorktree,
} from "../codex/worktree.mjs";

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function cleanSlug(value) {
  return String(value ?? "").trim().slice(0, 240);
}

function cleanContent(value) {
  const content = String(value ?? "").replace(/\r\n/g, "\n");
  if (!content.trim()) throw new Error("Markdown cannot be empty.");
  if (Buffer.byteLength(content, "utf8") > 512_000) throw new Error("Markdown is too large for direct edit review.");
  return content.endsWith("\n") ? content : content + "\n";
}

async function resolveNote(root, slug) {
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const entry = workspace.entries.find((item) => item.slug === slug || item.aliases.includes(slug));
  if (!entry) throw new Error("Research note does not exist.");
  const absolute = path.join(workspace.progressRoot, entry.filename);
  const relativeProgress = path.relative(root, workspace.progressRoot);
  if (!relativeProgress || relativeProgress.startsWith("..") || path.isAbsolute(relativeProgress)) {
    throw new Error("Research progress directory is outside the repository.");
  }
  return { workspace, entry, absolute, relativeProgress };
}

async function copyIfPresent(source, destination) {
  try {
    await fs.copyFile(source, destination);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export function directEditWritable() {
  if (process.env.RESEARCH_OBSERVER_WRITES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function directEditReason() {
  return directEditWritable()
    ? "Direct Markdown editing is enabled with review-before-save validation."
    : "Direct editing is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is explicitly configured.";
}

export async function readDirectEditNote({ rootDir = process.cwd(), slug } = {}) {
  const root = path.resolve(rootDir);
  const clean = cleanSlug(slug);
  if (!clean) throw new Error("A note slug is required.");
  const { workspace, entry, absolute } = await resolveNote(root, clean);
  const content = await fs.readFile(absolute, "utf8");
  return {
    slug: entry.slug,
    filename: entry.filename,
    title: entry.title,
    content,
    baseSha256: sha256(content),
    workspaceSignature: workspace.signature,
  };
}

export async function prepareDirectEdit({ rootDir = process.cwd(), slug, content, baseSha256 } = {}) {
  const root = path.resolve(rootDir);
  const clean = cleanSlug(slug);
  if (!clean) throw new Error("A note slug is required.");
  const nextContent = cleanContent(content);
  const { workspace, entry, absolute, relativeProgress } = await resolveNote(root, clean);
  const current = await fs.readFile(absolute, "utf8");
  const currentSha = sha256(current);
  if (!baseSha256 || currentSha !== String(baseSha256)) {
    const error = new Error("This note changed after the editor was opened. Reload before reviewing your draft.");
    error.code = "DIRECT_EDIT_STALE";
    throw error;
  }
  if (current === nextContent) {
    const error = new Error("There are no Markdown changes to review.");
    error.code = "DIRECT_EDIT_NO_CHANGES";
    throw error;
  }

  return withDetachedWorktree(root, async (worktree) => {
    const workProgress = path.join(worktree, relativeProgress);
    await fs.rm(workProgress, { recursive: true, force: true });
    await fs.mkdir(path.dirname(workProgress), { recursive: true });
    await fs.cp(workspace.progressRoot, workProgress, { recursive: true, force: true, errorOnExist: false });
    await copyIfPresent(path.join(root, "research-observer.config.json"), path.join(worktree, "research-observer.config.json"));

    const baseline = await runGit(worktree, ["add", "-A", "--", relativeProgress]);
    if (baseline.code !== 0) throw new Error(baseline.stderr || "Could not prepare the direct-edit review baseline.");

    const workFile = path.join(workProgress, entry.filename);
    await fs.writeFile(workFile, nextContent, "utf8");

    const doctor = await runResearchDoctor(root, worktree);
    const filePath = path.posix.join(relativeProgress.split(path.sep).join("/"), entry.filename);
    const diff = await runGit(worktree, ["diff", "--binary", "--no-ext-diff", "--", filePath]);
    if (diff.code !== 0) throw new Error(diff.stderr || "Could not generate the Markdown review diff.");
    if (!diff.stdout.trim()) throw new Error("No reviewable Markdown diff was generated.");

    const patchBytes = Buffer.byteLength(diff.stdout, "utf8");
    const reviewable = patchBytes <= 120_000 && !diff.stdout.includes("GIT binary patch");
    const valid = doctor.code === 0;
    const doctorOutput = (doctor.stdout + "\n" + doctor.stderr).trim().slice(0, 12_000);
    const stored = await storeProposal(root, {
      kind: "direct-edit",
      files: [filePath],
      valid,
      reviewable,
      doctor: { code: doctor.code, output: doctorOutput },
      summary: `Direct Markdown edit for ${entry.filename}`,
      patch: diff.stdout,
      slug: entry.slug,
      filename: entry.filename,
      baseSha256: currentSha,
      workspaceSignature: workspace.signature,
    });

    return {
      proposal: stored,
      patch: diff.stdout,
      valid,
      reviewable,
      doctor: { code: doctor.code, output: doctorOutput },
    };
  });
}

export async function applyDirectEdit({ rootDir = process.cwd(), id } = {}) {
  const root = path.resolve(rootDir);
  const { metadata, patch } = await loadProposal(root, String(id ?? ""));
  if (metadata.kind !== "direct-edit") throw new Error("This review proposal is not a direct Markdown edit.");
  if (!metadata.valid || !metadata.reviewable) throw new Error("This Markdown edit did not pass review checks and cannot be saved.");
  if (!metadata.slug || !metadata.filename || !metadata.baseSha256) throw new Error("Direct-edit proposal metadata is incomplete.");
  if (sha256(patch) !== metadata.patchSha256) throw new Error("The reviewed patch changed after it was prepared.");

  const { entry, absolute } = await resolveNote(root, metadata.slug);
  if (entry.filename !== metadata.filename) throw new Error("The note filename changed after review. Reload before saving.");
  const current = await fs.readFile(absolute, "utf8");
  if (sha256(current) !== metadata.baseSha256) {
    const error = new Error("This note changed after review. Reload and review the latest version before saving.");
    error.code = "DIRECT_EDIT_STALE";
    throw error;
  }

  const check = await runGit(root, ["apply", "--check", "--whitespace=nowarn", "-"], { input: patch });
  if (check.code !== 0) {
    const error = new Error("The reviewed Markdown patch no longer applies cleanly.");
    error.detail = check.stderr.slice(0, 4000);
    throw error;
  }

  const applied = await runGit(root, ["apply", "--whitespace=nowarn", "-"], { input: patch });
  if (applied.code !== 0) throw new Error(applied.stderr || "Git could not apply the Markdown edit.");

  const doctor = await runResearchDoctor(root);
  if (doctor.code !== 0) {
    await runGit(root, ["apply", "-R", "--whitespace=nowarn", "-"], { input: patch });
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    const error = new Error("The saved Markdown failed validation and was rolled back.");
    error.doctor = (doctor.stdout + "\n" + doctor.stderr).trim().slice(0, 12000);
    throw error;
  }

  await writeResearchArtifacts({ rootDir: root, fresh: true });
  const updated = await fs.readFile(absolute, "utf8");
  await deleteProposal(root, metadata.id);
  return {
    applied: true,
    slug: metadata.slug,
    filename: metadata.filename,
    baseSha256: sha256(updated),
    doctor: (doctor.stdout + "\n" + doctor.stderr).trim().slice(0, 12000),
  };
}

export async function discardDirectEdit({ rootDir = process.cwd(), id } = {}) {
  const root = path.resolve(rootDir);
  const { metadata } = await loadProposal(root, String(id ?? ""));
  if (metadata.kind !== "direct-edit") throw new Error("This review proposal is not a direct Markdown edit.");
  await deleteProposal(root, metadata.id);
  return { discarded: true };
}
