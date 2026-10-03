import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { collectLocalWorkspaceHealth, repairLocalWorkspace } from "@/lib/local-workspace-health.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET() {
  return noStore(await collectLocalWorkspaceHealth());
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return noStore({ error: "Cross-origin local maintenance is not allowed." }, { status: 403 });
  }

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  try {
    return noStore(await repairLocalWorkspace(action));
  } catch (error) {
    return noStore(
      { error: error instanceof Error ? error.message : "Local maintenance failed." },
      { status: 422 },
    );
  }
}
