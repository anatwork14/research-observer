import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  configureLatexWorkspace,
  createLatexSource,
  latexEditableExtensions,
  latexEngines,
  latexWritesEnabled,
  listLatexWorkspace,
  readLatexSource,
  saveLatexSource,
  setLatexFileHidden,
} from "@/lib/research/latex-ide.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("research") || "default";
  const file = url.searchParams.get("file");
  try {
    if (file) {
      const source = await readLatexSource({ projectId, file });
      return noStore({ ...source, enabled: latexWritesEnabled() });
    }
    const workspace = await listLatexWorkspace({ projectId });
    return noStore({
      ...workspace,
      enabled: latexWritesEnabled(),
      editableExtensions: latexEditableExtensions,
      engines: latexEngines,
      reason: latexWritesEnabled()
        ? "Manuscript editing is enabled. Hide actions are soft deletes and remain restorable."
        : "Manuscript editing is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is configured.",
    });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Could not load manuscript workspace." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin manuscript writes are not allowed." }, { status: 403 });
  if (!latexWritesEnabled()) return noStore({ error: "Manuscript writes are disabled in this environment." }, { status: 503 });

  let body: {
    action?: unknown;
    research?: unknown;
    file?: unknown;
    content?: unknown;
    baseSha256?: unknown;
    mainFile?: unknown;
    engine?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const projectId = typeof body.research === "string" && body.research ? body.research : "default";
  const file = typeof body.file === "string" ? body.file : "";
  try {
    if (action === "create") {
      const source = await createLatexSource({
        projectId,
        file,
        content: typeof body.content === "string" ? body.content : "",
      });
      return noStore(source, { status: 201 });
    }
    if (action === "save") {
      const source = await saveLatexSource({
        projectId,
        file,
        content: typeof body.content === "string" ? body.content : "",
        baseSha256: typeof body.baseSha256 === "string" ? body.baseSha256 : "",
      });
      return noStore(source);
    }
    if (action === "hide" || action === "restore") {
      const workspace = await setLatexFileHidden({ projectId, file, hidden: action === "hide" });
      return noStore(workspace);
    }
    if (action === "configure") {
      const workspace = await configureLatexWorkspace({
        projectId,
        ...(typeof body.mainFile === "string" ? { mainFile: body.mainFile } : {}),
        ...(typeof body.engine === "string" ? { engine: body.engine as never } : {}),
      });
      return noStore(workspace);
    }
    return noStore({ error: "Unsupported manuscript action." }, { status: 400 });
  } catch (error) {
    const status = (error as { code?: unknown })?.code === "LATEX_SOURCE_STALE" ? 409 : 422;
    return noStore({ error: error instanceof Error ? error.message : "Manuscript update failed." }, { status });
  }
}
