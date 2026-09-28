import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  compileLatexProject,
  latestLatexBuild,
  latexCompileEnabled,
  latexToolchainStatus,
} from "@/lib/research/latex-ide.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("research") || "default";
  try {
    const [toolchain, latest] = await Promise.all([
      latexToolchainStatus(),
      latestLatexBuild({ projectId }),
    ]);
    return noStore({ enabled: latexCompileEnabled(), toolchain, latest });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Could not inspect the LaTeX toolchain." }, { status: 422 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin LaTeX builds are not allowed." }, { status: 403 });
  if (!latexCompileEnabled()) return noStore({ error: "LaTeX compilation is disabled in this environment." }, { status: 503 });
  let body: { research?: unknown; mainFile?: unknown; engine?: unknown };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  try {
    const build = await compileLatexProject({
      projectId: typeof body.research === "string" && body.research ? body.research : "default",
      mainFile: typeof body.mainFile === "string" ? body.mainFile : undefined,
      engine: typeof body.engine === "string" ? body.engine as never : undefined,
    });
    return noStore(build, { status: build.success ? 201 : 422 });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "LaTeX compilation failed." }, { status: 422 });
  }
}
