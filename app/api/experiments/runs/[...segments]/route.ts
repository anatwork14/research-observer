import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getResearchWorkspace } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  if (segments.length < 3 || segments.some((part) => part === "." || part === ".." || part.includes(":") || part.includes("\\"))) return NextResponse.json({ error: "Invalid run data path." }, { status: 400 });
  const [experimentId, runId, ...fileParts] = segments;
  const workspace = await getResearchWorkspace();
  const run = workspace.experiments.find((item) => item.experimentId === experimentId && item.id === runId);
  const relative = fileParts.join("/");
  const declared = (run?.dataFiles ?? []).some((item) => (typeof item === "string" ? item : item.path) === relative) || (run?.artifacts ?? []).some((item) => (typeof item === "string" ? item : item && typeof item === "object" && "path" in item ? String(item.path) : "") === relative);
  if (!run || !declared) return NextResponse.json({ error: "Run file not found." }, { status: 404 });
  const runDirectory = path.resolve(workspace.progressRoot, path.dirname(run.manifest));
  const file = path.resolve(runDirectory, ...fileParts);
  if (!(file === runDirectory || file.startsWith(runDirectory + path.sep))) return NextResponse.json({ error: "Invalid run data path." }, { status: 400 });
  try {
    let current = runDirectory;
    for (const part of fileParts) { current = path.join(current, part); const stat = await fs.lstat(current); if (stat.isSymbolicLink()) throw new Error("symlink"); }
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > 25 * 1024 * 1024) throw new Error("file");
    const bytes = await fs.readFile(file);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(bytes.byteLength), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Run file is unavailable or unsafe." }, { status: 404 });
  }
}
