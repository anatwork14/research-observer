import { NextResponse } from "next/server";
import { createEvidenceNote } from "@/lib/research/evidence-write.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function writable() {
  if (process.env.RESEARCH_OBSERVER_WRITES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function GET() {
  return NextResponse.json({
    enabled: writable(),
    reason: writable()
      ? "Local evidence capture is enabled."
      : "Evidence capture is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is explicitly configured.",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin evidence writes are not allowed." }, { status: 403 });
  }
  if (!writable()) {
    return NextResponse.json({ error: "Evidence capture is disabled in this environment." }, { status: 503 });
  }

  let body: {
    paperPath?: unknown;
    page?: unknown;
    quote?: unknown;
    comment?: unknown;
    relationship?: { type?: unknown; target?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const result = await createEvidenceNote({
      paperPath: typeof body.paperPath === "string" ? body.paperPath : "",
      page: Number(body.page),
      quote: typeof body.quote === "string" ? body.quote : "",
      comment: typeof body.comment === "string" ? body.comment : "",
      relationship: body.relationship?.target
        ? {
            type: typeof body.relationship.type === "string" ? body.relationship.type : "",
            target: typeof body.relationship.target === "string" ? body.relationship.target : "",
          }
        : undefined,
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create evidence note." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}
