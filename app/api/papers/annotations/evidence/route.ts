import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  applyPdfAnnotationEvidence,
  pdfEvidenceReviewWritable,
  previewPdfAnnotationEvidence,
} from "@/lib/research/pdf-evidence-review.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET() {
  return noStore({
    enabled: pdfEvidenceReviewWritable(),
    reason: pdfEvidenceReviewWritable()
      ? "Reviewed PDF annotation Evidence preview and Apply are enabled."
      : "PDF Evidence Apply is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is configured.",
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin PDF Evidence review requests are not allowed." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return noStore({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const action = body.action === "preview" ? "preview" : body.action === "apply" ? "apply" : "";
  if (!action) return noStore({ error: "Action must be preview or apply." }, { status: 400 });
  if (action === "apply" && !pdfEvidenceReviewWritable()) {
    return noStore({ error: "PDF Evidence Apply is disabled in this environment." }, { status: 503 });
  }
  const input = {
    paperPath: typeof body.paperPath === "string" ? body.paperPath : "",
    id: typeof body.id === "string" ? body.id : "",
    expectedRevision: typeof body.expectedRevision === "number" && Number.isInteger(body.expectedRevision) ? body.expectedRevision : undefined,
  };
  try {
    if (action === "preview") return noStore({ preview: await previewPdfAnnotationEvidence(input) });
    const result = await applyPdfAnnotationEvidence({
      ...input,
      expectedWorkspaceSignature: typeof body.expectedWorkspaceSignature === "string" ? body.expectedWorkspaceSignature : "",
      expectedDocumentSha256: typeof body.expectedDocumentSha256 === "string" ? body.expectedDocumentSha256 : "",
      expectedProposalHash: typeof body.expectedProposalHash === "string" ? body.expectedProposalHash : "",
    });
    return noStore({ result }, { status: 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    const status = code === "PDF_EVIDENCE_REVIEW_STALE" || code === "PDF_EVIDENCE_REVIEW_CHANGED" ? 409
      : code === "ANNOTATION_NOT_FOUND" ? 404
        : 422;
    return noStore({
      error: error instanceof Error ? error.message : "PDF Evidence review failed.",
      code: code || undefined,
      revision: typeof (error as { revision?: unknown })?.revision === "number" ? (error as { revision: number }).revision : undefined,
    }, { status });
  }
}
