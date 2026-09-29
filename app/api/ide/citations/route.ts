import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { ensureLatexCitation, listLatexCitationCandidates, resolveLatexCitationTokens } from "@/lib/research/latex-citations.mjs";
import { latexWritesEnabled } from "@/lib/research/latex-ide.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("research") || "default";
  const query = url.searchParams.get("q") || "";
  try {
    const result = await listLatexCitationCandidates({ projectId, query });
    return noStore({
      ...result,
      enabled: latexWritesEnabled(),
      reason: latexWritesEnabled()
        ? "Citation insertion writes only verified project metadata into a project .bib file."
        : "Citation writes are disabled in production unless RESEARCH_OBSERVER_WRITES=1 is configured.",
    });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Could not load citation candidates." }, { status: 422 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin citation requests are not allowed." }, { status: 403 });

  let body: { action?: unknown; research?: unknown; slug?: unknown; bibFile?: unknown; file?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (body.action === "resolve") {
    try {
      const result = await resolveLatexCitationTokens({
        projectId: typeof body.research === "string" && body.research ? body.research : "default",
        file: typeof body.file === "string" ? body.file : "",
        content: typeof body.content === "string" ? body.content : undefined,
      });
      return noStore(result);
    } catch (error) {
      return noStore({ error: error instanceof Error ? error.message : "Could not resolve citation references." }, { status: 422 });
    }
  }
  if (body.action !== "ensure") return noStore({ error: "Unsupported citation action." }, { status: 400 });
  if (!latexWritesEnabled()) return noStore({ error: "Citation writes are disabled in this environment." }, { status: 503 });

  try {
    const result = await ensureLatexCitation({
      projectId: typeof body.research === "string" && body.research ? body.research : "default",
      slug: typeof body.slug === "string" ? body.slug : "",
      bibFile: typeof body.bibFile === "string" && body.bibFile ? body.bibFile : "references.bib",
    });
    return noStore(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    return noStore(
      { error: error instanceof Error ? error.message : "Could not create citation." },
      { status: code === "LATEX_SOURCE_STALE" ? 409 : 422 },
    );
  }
}
