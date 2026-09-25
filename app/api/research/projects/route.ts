import { NextResponse } from "next/server";
import { getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspace = await getResearchWorkspace();
  const projects = workspace.projects
    .filter((project) => project.notes > 0 || project.autoIndexed)
    .map(({ id, label, description }) => ({ id, label, description }));
  return NextResponse.json({ projects }, { headers: { "Cache-Control": "no-store" } });
}
