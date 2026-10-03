import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { inspectLatexWithTexlab, texlabStatus } from "@/lib/research/texlab.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export async function GET() {
  try {
    return noStore(await texlabStatus());
  } catch (error) {
    return noStore({ enabled: true, available: false, error: error instanceof Error ? error.message : "Could not inspect TexLab." }, { status: 200 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin TexLab analysis is not allowed." }, { status: 403 });
  let body: {
    research?: unknown;
    file?: unknown;
    content?: unknown;
    position?: { line?: unknown; column?: unknown; character?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const projectId = typeof body.research === "string" && body.research ? body.research : "default";
  const file = typeof body.file === "string" ? body.file : "";
  if (!file) return noStore({ error: "Choose an active .tex source file first." }, { status: 400 });
  if (typeof body.content !== "string") return noStore({ error: "TexLab analysis requires the current editor buffer." }, { status: 400 });

  const status = await texlabStatus();
  if (!status.enabled || !status.available) {
    return noStore({ error: status.reason || "TexLab is not available in this environment.", status }, { status: 503 });
  }

  const rawPosition = body.position && typeof body.position === "object" ? body.position : undefined;
  const position = rawPosition
    ? {
        line: Math.max(0, Number(rawPosition.line) || 0),
        column: Math.max(0, Number(rawPosition.column ?? rawPosition.character) || 0),
      }
    : undefined;

  try {
    const result = await inspectLatexWithTexlab({ projectId, file, content: body.content, position });
    return noStore({ status, ...result });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "TexLab analysis failed.", status }, { status: 422 });
  }
}
