import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { forwardSyncLatex, reverseSyncLatex } from "@/lib/research/latex-ide.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin SyncTeX requests are not allowed." }, { status: 403 });
  let body: {
    mode?: unknown;
    research?: unknown;
    buildId?: unknown;
    file?: unknown;
    line?: unknown;
    column?: unknown;
    page?: unknown;
    x?: unknown;
    y?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const mode = typeof body.mode === "string" ? body.mode : "";
  const common = {
    projectId: typeof body.research === "string" && body.research ? body.research : "default",
    buildId: typeof body.buildId === "string" ? body.buildId : "",
  };
  try {
    if (mode === "forward") {
      const result = await forwardSyncLatex({
        ...common,
        file: typeof body.file === "string" ? body.file : "",
        line: Number(body.line),
        column: Number(body.column ?? 0),
      });
      return noStore(result);
    }
    if (mode === "reverse") {
      const result = await reverseSyncLatex({
        ...common,
        page: Number(body.page),
        x: Number(body.x),
        y: Number(body.y),
      });
      return noStore(result);
    }
    return noStore({ error: "SyncTeX mode must be forward or reverse." }, { status: 400 });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "SyncTeX mapping failed." }, { status: 422 });
  }
}
