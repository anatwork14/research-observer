import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  applyReviewedConsensusEvidence,
  previewReviewedConsensusEvidence,
  reviewedEvidenceWritable,
} from "@/lib/research/reviewed-evidence.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewInput = {
  paper?: unknown;
  query?: unknown;
  research?: unknown;
  targetSlug?: unknown;
  relationType?: unknown;
  comment?: unknown;
};

function normalizedInput(body: ReviewInput) {
  return {
    paper: body.paper,
    query: typeof body.query === "string" ? body.query : "",
    research: typeof body.research === "string" ? body.research : "",
    targetSlug: typeof body.targetSlug === "string" ? body.targetSlug : "",
    relationType: typeof body.relationType === "string" ? body.relationType : "",
    comment: typeof body.comment === "string" ? body.comment : "",
  };
}

export async function GET() {
  return NextResponse.json({
    enabled: reviewedEvidenceWritable(),
    reason: reviewedEvidenceWritable()
      ? "Reviewed Consensus Evidence preview and Apply are enabled."
      : "Reviewed Evidence Apply is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is explicitly configured.",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin Evidence review requests are not allowed." }, { status: 403 });
  }

  let body: ReviewInput & {
    action?: unknown;
    expectedWorkspaceSignature?: unknown;
    expectedProposalHash?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const action = body.action === "preview" ? "preview" : body.action === "apply" ? "apply" : "";
  if (!action) return NextResponse.json({ error: "Action must be preview or apply." }, { status: 400 });
  if (action === "apply" && !reviewedEvidenceWritable()) {
    return NextResponse.json({ error: "Reviewed Evidence writes are disabled in this environment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const input = normalizedInput(body);
  try {
    if (action === "preview") {
      const preview = await previewReviewedConsensusEvidence(input);
      return NextResponse.json({ preview }, { headers: { "Cache-Control": "no-store" } });
    }

    const result = await applyReviewedConsensusEvidence({
      ...input,
      expectedWorkspaceSignature: typeof body.expectedWorkspaceSignature === "string" ? body.expectedWorkspaceSignature : "",
      expectedProposalHash: typeof body.expectedProposalHash === "string" ? body.expectedProposalHash : "",
    });
    return NextResponse.json({ result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const status = code === "EVIDENCE_REVIEW_STALE" || code === "EVIDENCE_REVIEW_CHANGED" ? 409 : 422;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Reviewed Evidence request failed.",
      code: code || undefined,
    }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
