import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { latexWritesEnabled, listLatexWorkspace, readLatexSource } from "@/lib/research/latex-ide.mjs";
import {
  createManuscriptRecoverySnapshot,
  deleteManuscriptRecoverySnapshot,
  restoreManuscriptRecoverySnapshot,
} from "@/lib/codex/manuscript-recovery.mjs";
import {
  allManuscriptPaths,
  changedFileStates,
  deleteProposal,
  loadProposal,
  noHiddenManuscriptPaths,
  runGit,
} from "@/lib/codex/worktree.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function enabled() {
  return process.env.NODE_ENV !== "production" && process.env.RESEARCH_OBSERVER_CODEX !== "0" && latexWritesEnabled();
}

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function relativeProjectFile(repoFile: string, manuscriptPath: string) {
  const prefix = `${manuscriptPath}/`;
  if (!repoFile.startsWith(prefix)) throw new Error("Proposal file escaped the reviewed manuscript project.");
  return repoFile.slice(prefix.length);
}

async function restoreSnapshot(root: string, id: string) {
  try {
    const restored = await restoreManuscriptRecoverySnapshot({ root, proposalId: id });
    await deleteManuscriptRecoverySnapshot({ root, proposalId: id }).catch(() => null);
    return { ok: true, restored: restored.restored };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not restore the manuscript recovery snapshot.",
    };
  }
}

export async function POST(request: Request) {
  if (!enabled()) return NextResponse.json({ error: "Manuscript Codex Apply is unavailable in this environment." }, { status: 503 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin manuscript Apply requests are not allowed." }, { status: 403 });

  let body: { id?: unknown; action?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const id = clean(body.id, 64);
  const action = clean(body.action, 32) || "apply";
  if (!id) return NextResponse.json({ error: "Proposal ID is required." }, { status: 400 });
  if (action !== "apply" && action !== "discard") return NextResponse.json({ error: "Choose apply or discard." }, { status: 400 });

  const root = process.cwd();
  try {
    const { metadata, patch } = await loadProposal(root, id);
    if (metadata.kind !== "manuscript-codex") {
      return NextResponse.json({ error: "This proposal does not belong to the manuscript review workflow." }, { status: 409 });
    }

    if (action === "discard") {
      await Promise.all([
        deleteProposal(root, id),
        deleteManuscriptRecoverySnapshot({ root, proposalId: id }).catch(() => null),
      ]);
      return NextResponse.json({ discarded: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const manuscriptPath = clean(metadata.manuscriptPath, 1000);
    const projectId = clean(metadata.projectId, 120);
    const ide = projectId ? await listLatexWorkspace({ rootDir: root, projectId }) : null;
    const hiddenSourcePaths = ide?.files
      .filter((file) => file.editable && file.hidden)
      .map((file) => manuscriptPath + "/" + file.path) ?? [];
    if (!manuscriptPath || !projectId || !allManuscriptPaths(metadata.files ?? [], manuscriptPath) ||
      !noHiddenManuscriptPaths(metadata.files ?? [], hiddenSourcePaths)) {
      return NextResponse.json({ error: "The proposal contains files outside its reviewed manuscript project." }, { status: 409 });
    }
    if (metadata.destructive) {
      return NextResponse.json({ error: "Destructive manuscript proposals cannot be applied. Hide files through the IDE instead of deleting them." }, { status: 409 });
    }

    const patchSha256 = crypto.createHash("sha256").update(patch, "utf8").digest("hex");
    if (patchSha256 !== metadata.patchSha256) {
      return NextResponse.json({ error: "The stored manuscript proposal changed after review and cannot be applied." }, { status: 409 });
    }
    if (!metadata.valid || !metadata.reviewable || metadata.validation?.valid === false) {
      return NextResponse.json({ error: "This manuscript proposal did not pass reviewability/validation checks." }, { status: 409 });
    }

    const baseline = metadata.baseFiles;
    const baselineComplete = Boolean(
      baseline &&
      Object.keys(baseline).length === metadata.files.length &&
      metadata.files.every((file: string) => Object.hasOwn(baseline, file)),
    );
    if (!baselineComplete) {
      return NextResponse.json({ error: "The proposal is missing its frozen manuscript baseline and cannot be applied safely." }, { status: 409 });
    }

    const conflicts = await changedFileStates(root, baseline);
    if (conflicts.length) {
      return NextResponse.json({
        error: "Live manuscript files changed after this proposal was reviewed. Generate a new proposal from the latest source.",
        conflicts,
      }, { status: 409 });
    }

    const check = await runGit(root, ["apply", "--check", "--whitespace=nowarn", "-"], { input: patch });
    if (check.code !== 0) {
      return NextResponse.json({ error: "The manuscript proposal no longer applies cleanly.", detail: check.stderr.slice(0, 4000) }, { status: 409 });
    }

    const lastCheckConflicts = await changedFileStates(root, baseline);
    if (lastCheckConflicts.length) {
      return NextResponse.json({
        error: "Live manuscript files changed while Apply was checking the reviewed proposal. Generate a new proposal from the latest source.",
        conflicts: lastCheckConflicts,
      }, { status: 409 });
    }

    try {
      await createManuscriptRecoverySnapshot({ root, proposalId: id, files: metadata.files as string[] });
    } catch (snapshotError) {
      return NextResponse.json({
        error: "Could not create the pre-apply manuscript recovery snapshot. No source changes were made.",
        detail: snapshotError instanceof Error ? snapshotError.message : "Recovery snapshot failed.",
      }, { status: 500 });
    }

    const applied = await runGit(root, ["apply", "--whitespace=nowarn", "-"], { input: patch });
    if (applied.code !== 0) {
      const recovery = await restoreSnapshot(root, id);
      return NextResponse.json({
        error: recovery.ok
          ? "Git could not apply the reviewed manuscript proposal. The pre-apply source snapshot was restored."
          : "Git could not apply the reviewed manuscript proposal and automatic source recovery also failed. Inspect the touched manuscript files before continuing.",
        detail: applied.stderr.slice(0, 4000),
        ...(recovery.ok ? { recovered: recovery.restored } : { recoveryRequired: true, recovery: recovery.error, snapshotRetained: true }),
      }, { status: 500 });
    }

    try {
      for (const repoFile of metadata.files as string[]) {
        const file = relativeProjectFile(repoFile, manuscriptPath);
        await readLatexSource({ rootDir: root, projectId, file });
      }
      const workspace = await listLatexWorkspace({ rootDir: root, projectId });
      await Promise.all([
        deleteProposal(root, id),
        deleteManuscriptRecoverySnapshot({ root, proposalId: id }).catch(() => null),
      ]);
      return NextResponse.json({
        applied: true,
        files: metadata.files,
        workspace,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (validationError) {
      const rollback = await runGit(root, ["apply", "-R", "--whitespace=nowarn", "-"], { input: patch });
      if (rollback.code === 0) {
        await deleteManuscriptRecoverySnapshot({ root, proposalId: id }).catch(() => null);
        return NextResponse.json({
          error: "Applied manuscript changes failed source validation and were rolled back.",
          detail: validationError instanceof Error ? validationError.message : "Manuscript validation failed.",
          rollback: "reverse-patch",
        }, { status: 422 });
      }

      const recovery = await restoreSnapshot(root, id);
      return NextResponse.json({
        error: recovery.ok
          ? "Applied manuscript changes failed source validation. Reverse-patch rollback failed, but the exact pre-apply source snapshot was restored."
          : "Applied manuscript changes failed source validation and both automatic rollback methods failed. Inspect the touched manuscript files before continuing.",
        detail: validationError instanceof Error ? validationError.message : "Manuscript validation failed.",
        rollback: rollback.stderr.slice(0, 4000),
        ...(recovery.ok
          ? { recovered: recovery.restored, rollbackFallback: "snapshot" }
          : { recoveryRequired: true, recovery: recovery.error, snapshotRetained: true }),
      }, { status: recovery.ok ? 422 : 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not apply manuscript proposal." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
