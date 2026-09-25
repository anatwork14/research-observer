import { NextResponse } from "next/server";
import { createConsensusEvidenceNote, createEvidenceNote } from "@/lib/research/evidence-write.mjs";
import { uploadEvidence } from "@/lib/research/asset-upload.mjs";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function writable() {
  if (process.env.RESEARCH_OBSERVER_WRITES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function relationshipValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const relationship = value as { type?: unknown; target?: unknown };
  if (typeof relationship.target !== "string" || !relationship.target.trim()) return undefined;
  return {
    type: typeof relationship.type === "string" ? relationship.type : "",
    target: relationship.target,
  };
}

export async function GET() {
  return NextResponse.json({
    enabled: writable(),
    reason: writable()
      ? "Durable local and reviewed Consensus evidence capture is enabled."
      : "Evidence capture is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is explicitly configured.",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin evidence writes are not allowed." }, { status: 403 });
  }
  if (!writable()) {
    return NextResponse.json({ error: "Evidence capture is disabled in this environment." }, { status: 503 });
  }

  if (request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const title = form.get("title");
      const comment = form.get("comment");
      const research = form.get("research");
      const result = await uploadEvidence({
        file: form.get("file"),
        title: typeof title === "string" ? title : "",
        comment: typeof comment === "string" ? comment : "",
        research: typeof research === "string" ? research : "",
      });
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not upload evidence." },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  let body: {
    kind?: unknown;
    paperPath?: unknown;
    page?: unknown;
    quote?: unknown;
    paper?: unknown;
    query?: unknown;
    research?: unknown;
    comment?: unknown;
    relationship?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const result = body.kind === "consensus"
      ? await createConsensusEvidenceNote({
          paper: body.paper && typeof body.paper === "object" ? body.paper : undefined,
          query: typeof body.query === "string" ? body.query : "",
          research: typeof body.research === "string" ? body.research : "",
          comment: typeof body.comment === "string" ? body.comment : "",
          relationship: relationshipValue(body.relationship),
        })
      : await createEvidenceNote({
          paperPath: typeof body.paperPath === "string" ? body.paperPath : "",
          page: Number(body.page),
          quote: typeof body.quote === "string" ? body.quote : "",
          comment: typeof body.comment === "string" ? body.comment : "",
          relationship: relationshipValue(body.relationship),
        });

    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create evidence note." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}
