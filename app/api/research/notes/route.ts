import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { createResearchNote, noteCreateWritable } from "@/lib/research/note-create.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin note creation is not allowed." }, { status: 403 });
  if (!noteCreateWritable()) return NextResponse.json({ error: "Note creation is disabled in this environment." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  try {
    const note = await createResearchNote({
      title: typeof body.title === "string" ? body.title : "",
      summary: typeof body.summary === "string" ? body.summary : "",
      type: typeof body.type === "string" ? body.type : "note",
      research: typeof body.research === "string" ? body.research : "",
      body: typeof body.body === "string" ? body.body : "",
    });
    return NextResponse.json(note, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create the note." }, { status: 422 });
  }
}
