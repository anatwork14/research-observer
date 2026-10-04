import { NextResponse } from "next/server";
import { buildResearchAssistantContext } from "@/lib/research/assistant-context.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  if (!slug) return noStore({ error: "A research note slug is required." }, { status: 400 });

  try {
    const result = await buildResearchAssistantContext({ slug });
    return noStore({ context: result.context });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const status = code === "ASSIST_CONTEXT_NOT_FOUND" ? 404 : code === "ASSIST_CONTEXT_SLUG_REQUIRED" ? 400 : 422;
    return noStore({ error: error instanceof Error ? error.message : "Could not build research assistant context." }, { status });
  }
}
