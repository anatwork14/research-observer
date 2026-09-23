import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  applyDirectEdit,
  directEditReason,
  directEditWritable,
  discardDirectEdit,
  prepareDirectEdit,
  readDirectEditNote,
} from "@/lib/research/direct-edit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

function errorStatus(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  if (code === "DIRECT_EDIT_STALE") return 409;
  if (code === "DIRECT_EDIT_NO_CHANGES") return 422;
  return 422;
}

export async function GET(request: Request) {
  if (!directEditWritable()) {
    return noStore({ enabled: false, reason: directEditReason() });
  }
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slug) return noStore({ enabled: true, reason: directEditReason(), error: "A note slug is required." }, { status: 400 });

  try {
    const note = await readDirectEditNote({ slug });
    return noStore({ enabled: true, reason: directEditReason(), note });
  } catch (error) {
    return noStore({ enabled: true, reason: directEditReason(), error: error instanceof Error ? error.message : "Could not open this note for editing." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return noStore({ error: "Cross-origin Markdown edits are not allowed." }, { status: 403 });
  }
  if (!directEditWritable()) {
    return noStore({ error: directEditReason() }, { status: 503 });
  }

  let body: {
    action?: unknown;
    slug?: unknown;
    content?: unknown;
    baseSha256?: unknown;
    id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  try {
    if (action === "preview") {
      const result = await prepareDirectEdit({
        slug: typeof body.slug === "string" ? body.slug : "",
        content: typeof body.content === "string" ? body.content : "",
        baseSha256: typeof body.baseSha256 === "string" ? body.baseSha256 : "",
      });
      return noStore(result);
    }
    if (action === "apply") {
      const result = await applyDirectEdit({ id: typeof body.id === "string" ? body.id : "" });
      return noStore(result);
    }
    if (action === "discard") {
      const result = await discardDirectEdit({ id: typeof body.id === "string" ? body.id : "" });
      return noStore(result);
    }
    return noStore({ error: "Unsupported direct-edit action." }, { status: 400 });
  } catch (error) {
    const detail = (error as { detail?: unknown })?.detail;
    const doctor = (error as { doctor?: unknown })?.doctor;
    return noStore(
      {
        error: error instanceof Error ? error.message : "Direct Markdown edit failed.",
        ...(typeof detail === "string" ? { detail } : {}),
        ...(typeof doctor === "string" ? { doctor } : {}),
      },
      { status: errorStatus(error) },
    );
  }
}
