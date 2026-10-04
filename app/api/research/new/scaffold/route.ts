import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  applyResearchScaffold,
  previewResearchScaffold,
  researchScaffoldWritable,
} from "@/lib/research/new-research-scaffold.mjs";
import type { NewResearchPlan, NewResearchScaffoldTarget } from "@/lib/research/new-research-scaffold.mjs";
import { compileResearchWorkspace } from "@/lib/research/compiler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const workspace = await compileResearchWorkspace({ fresh: true });
  return NextResponse.json({
    enabled: researchScaffoldWritable(),
    projects: workspace.projects
      .filter((project) => project.notes > 0 || project.autoIndexed || workspace.config.researchProjects.some((item) => item.id === project.id))
      .map((project) => ({
        id: project.id,
        label: project.label,
        description: project.description || "",
        directory: project.directory || "",
        notes: project.notes,
      })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin New Research scaffold requests are not allowed." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const action = body.action === "apply" ? "apply" : body.action === "preview" ? "preview" : "";
  if (!action) return NextResponse.json({ error: "Action must be preview or apply." }, { status: 400 });
  if (action === "apply" && !researchScaffoldWritable()) {
    return NextResponse.json({ error: "New Research scaffold writes are disabled in this environment." }, { status: 503 });
  }

  const input = {
    topic: typeof body.topic === "string" ? body.topic : "",
    objective: typeof body.objective === "string" ? body.objective : "",
    plan: body.plan as NewResearchPlan,
    target: body.target as NewResearchScaffoldTarget,
  };

  try {
    if (action === "preview") {
      const preview = await previewResearchScaffold(input);
      return NextResponse.json({ preview }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await applyResearchScaffold({
      ...input,
      expectedWorkspaceSignature: typeof body.expectedWorkspaceSignature === "string" ? body.expectedWorkspaceSignature : "",
      expectedProposalHash: typeof body.expectedProposalHash === "string" ? body.expectedProposalHash : "",
    });
    return NextResponse.json({ result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const status = code === "SCAFFOLD_STALE" || code === "SCAFFOLD_CHANGED" ? 409 : 422;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "New Research scaffold request failed.", code: code || undefined },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
