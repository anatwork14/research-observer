import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  allResearchPaths,
  changedFileStates,
  deleteProposal,
  gitStatusPaths,
  loadProposal,
  runGit,
  runResearchDoctor,
} from "@/lib/codex/worktree.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function enabled() {
  return process.env.NODE_ENV !== "production" && process.env.RESEARCH_OBSERVER_CODEX !== "0";
}

function clean(value: unknown, max = 64) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!enabled()) {
    return NextResponse.json({ error: "Codex Apply mode is unavailable in this environment." }, { status: 503 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin Apply requests are not allowed." }, { status: 403 });
  }

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const id = clean(body.id);
  if (!id) return NextResponse.json({ error: "Proposal ID is required." }, { status: 400 });

  const root = process.cwd();
  try {
    const { metadata, patch } = await loadProposal(root, id);
    if (metadata.kind && metadata.kind !== "codex") {
      return NextResponse.json({ error: "This proposal belongs to another review workflow and cannot be applied through Codex." }, { status: 409 });
    }
    const patchSha256 = crypto.createHash("sha256").update(patch, "utf8").digest("hex");
    if (patchSha256 !== metadata.patchSha256) {
      return NextResponse.json({ error: "The stored proposal changed after review and cannot be applied." }, { status: 409 });
    }
    if (!metadata.valid || !metadata.reviewable) {
      return NextResponse.json({ error: "This proposal did not pass validation/reviewability checks and cannot be applied." }, { status: 409 });
    }

    const researchPath = metadata.researchPath || "progress";
    if (!allResearchPaths(metadata.files, researchPath)) {
      return NextResponse.json({ error: "The proposal contains files outside its reviewed research directory." }, { status: 409 });
    }

    const baseline = metadata.baseFiles;
    const baselineComplete = Boolean(
      baseline &&
      Object.keys(baseline).length === metadata.files.length &&
      metadata.files.every((file) => Object.hasOwn(baseline, file)),
    );
    const conflicts = baselineComplete
      ? await changedFileStates(root, baseline)
      : (await gitStatusPaths(root)).filter((file) => metadata.files.includes(file));

    if (conflicts.length) {
      return NextResponse.json({
        error: baselineComplete
          ? "The live research files changed after this proposal was reviewed."
          : "The live working tree changed in files touched by this proposal.",
        conflicts,
      }, { status: 409 });
    }

    const check = await runGit(root, ["apply", "--check", "--whitespace=nowarn", "-"], { input: patch });
    if (check.code !== 0) {
      return NextResponse.json({
        error: "The proposal no longer applies cleanly.",
        detail: check.stderr.slice(0, 4000),
      }, { status: 409 });
    }

    const applied = await runGit(root, ["apply", "--whitespace=nowarn", "-"], { input: patch });
    if (applied.code !== 0) {
      return NextResponse.json({
        error: "Git could not apply the proposal.",
        detail: applied.stderr.slice(0, 4000),
      }, { status: 500 });
    }

    const doctor = await runResearchDoctor(root);
    if (doctor.code !== 0) {
      const rollback = await runGit(root, ["apply", "-R", "--whitespace=nowarn", "-"], { input: patch });
      return NextResponse.json({
        error: rollback.code === 0
          ? "Applied changes failed the research doctor and were rolled back."
          : "Applied changes failed the research doctor and automatic rollback also failed. Inspect the touched research files before continuing.",
        doctor: (doctor.stdout + "\n" + doctor.stderr).trim().slice(0, 12000),
        ...(rollback.code !== 0 ? { rollback: rollback.stderr.slice(0, 4000) } : {}),
      }, { status: rollback.code === 0 ? 422 : 500 });
    }

    await deleteProposal(root, id);
    return NextResponse.json({
      applied: true,
      files: metadata.files,
      doctor: (doctor.stdout + "\n" + doctor.stderr).trim().slice(0, 12000),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not apply Codex proposal." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
