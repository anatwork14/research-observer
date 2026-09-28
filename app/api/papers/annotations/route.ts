import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  createPdfAnnotation,
  listPdfAnnotations,
  pdfAnnotationTypes,
  promotePdfAnnotationToEvidence,
  reanchorPdfAnnotation,
  restorePdfAnnotation,
  softDeletePdfAnnotation,
  updatePdfAnnotation,
} from "@/lib/research/pdf-annotations.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function writable() {
  return process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";
}

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

function errorStatus(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  if (code === "ANNOTATION_STALE") return 409;
  if (code === "ANNOTATION_NOT_FOUND" || code === "ANNOTATION_PDF_NOT_FOUND") return 404;
  return 422;
}

function objectBody(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasAnchorPosition(value: Record<string, unknown> | null): value is Record<string, unknown> & { page: number; rects: unknown[] } {
  return Boolean(value && Number.isInteger(value.page) && (value.page as number) > 0 && Array.isArray(value.rects));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paperPath = url.searchParams.get("paper") ?? "";
  if (!paperPath) return noStore({ error: "A paper path is required." }, { status: 400 });
  try {
    const state = await listPdfAnnotations({
      paperPath,
      includeDeleted: url.searchParams.get("includeDeleted") === "1",
    });
    return noStore({
      ...state,
      enabled: writable(),
      types: pdfAnnotationTypes,
      reason: writable()
        ? "PDF annotations are stored as durable sidecars; area/figure/table regions are supported, delete actions only hide records, re-anchoring is explicit, and promotion to evidence remains reviewed."
        : "PDF annotation writes are disabled in production unless RESEARCH_OBSERVER_WRITES=1 is configured.",
    });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Could not load annotations." }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin annotation writes are not allowed." }, { status: 403 });
  if (!writable()) return noStore({ error: "PDF annotation writes are disabled in this environment." }, { status: 503 });

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const body = objectBody(parsedBody);
  if (!body) return noStore({ error: "Request body must be a JSON object." }, { status: 400 });

  const action = typeof body.action === "string" ? body.action : "";
  const paperPath = typeof body.paperPath === "string" ? body.paperPath : "";
  const id = typeof body.id === "string" ? body.id : "";
  const expectedRevision = typeof body.expectedRevision === "number" && Number.isInteger(body.expectedRevision)
    ? body.expectedRevision
    : undefined;
  try {
    if (action === "create") {
      const annotation = objectBody(body.annotation);
      if (!hasAnchorPosition(annotation)) {
        return noStore({ error: "Annotation must include a positive page and rectangle list." }, { status: 400 });
      }
      const result = await createPdfAnnotation({
        paperPath,
        expectedRevision,
        annotation: annotation as Parameters<typeof createPdfAnnotation>[0]["annotation"],
      });
      return noStore(result, { status: 201 });
    }
    if (action === "update") {
      const result = await updatePdfAnnotation({
        paperPath,
        id,
        expectedRevision,
        patch: body.patch && typeof body.patch === "object" ? body.patch as never : {},
      });
      return noStore(result);
    }
    if (action === "reanchor") {
      const anchor = objectBody(body.anchor);
      if (!hasAnchorPosition(anchor)) {
        return noStore({ error: "Re-anchor must include a positive page and rectangle list." }, { status: 400 });
      }
      const result = await reanchorPdfAnnotation({
        paperPath,
        id,
        expectedRevision,
        anchor: anchor as Parameters<typeof reanchorPdfAnnotation>[0]["anchor"],
      });
      return noStore(result);
    }
    if (action === "delete") {
      const result = await softDeletePdfAnnotation({ paperPath, id, expectedRevision });
      return noStore(result);
    }
    if (action === "restore") {
      const result = await restorePdfAnnotation({ paperPath, id, expectedRevision });
      return noStore(result);
    }
    if (action === "promote") {
      const result = await promotePdfAnnotationToEvidence({ paperPath, id, expectedRevision });
      return noStore(result, { status: result.existing ? 200 : 201 });
    }
    return noStore({ error: "Unsupported annotation action." }, { status: 400 });
  } catch (error) {
    return noStore(
      {
        error: error instanceof Error ? error.message : "Annotation update failed.",
        revision: typeof (error as { revision?: unknown })?.revision === "number" ? (error as { revision: number }).revision : undefined,
      },
      { status: errorStatus(error) },
    );
  }
}
