import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { uploadPaper } from "@/lib/research/asset-upload.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function writable() {
  return process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin uploads are not allowed." }, { status: 403 });
  if (!writable()) return NextResponse.json({ error: "Paper uploads are disabled in this environment." }, { status: 503 });
  try {
    const form = await request.formData();
    const research = form.get("research");
    const result = await uploadPaper({ file: form.get("file"), research: typeof research === "string" ? research : "" });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload paper." }, { status: 422 });
  }
}
