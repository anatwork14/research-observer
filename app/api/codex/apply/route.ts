import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
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
    const patchSha256 = crypto.createHash("sha256").update(patch, "utf8").digest("hex");
    if (patchSha256 !== metadata.patchSha256) {
      return NextResponse.json({ error: "The stored proposal changed after review and cannot be applied." }, { status: 409 });
    }
    if (!metadata.valid || !metadata.reviewable) {
      return NextResponse.json({ error: "This proposal did not pass validation/reviewability checks and cannot be applied." }, { status: 409 });
    }

    const dirty = await gitStatusPaths(root);
    const overlap = dirty.filter((file) => metadata.files.includes(file));
    if (overlap.length) {
      return NextResponse.json({
        error: "The live working tree changed in files touched by this proposal.",
        conflicts: overlap,
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
      await runGit(root, ["apply", "-R", "--whitespace=nowarn", "-"], { input: patch });
      return NextResponse.json({
        error: "Applied changes failed the research doctor and were rolled back.",
        doctor: (doctor.stdout + "\n" + doctor.stderr).trim().slice(0, 12000),
      }, { status: 422 });
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
