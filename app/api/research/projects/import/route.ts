import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  importResearchProject,
  projectImportReason,
  projectImportWritable,
} from "@/lib/research/project-import.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return noStore({ enabled: projectImportWritable(), reason: projectImportReason() });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return noStore({ error: "Cross-origin project imports are not allowed." }, { status: 403 });
  if (!projectImportWritable()) return noStore({ error: projectImportReason() }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return noStore({ error: "Project import requires multipart form data." }, { status: 400 });
  }

  const projectName = typeof form.get("projectName") === "string" ? String(form.get("projectName")) : "";
  let paths: string[] = [];
  try {
    const raw = form.get("paths");
    paths = typeof raw === "string" ? JSON.parse(raw) : [];
    if (!Array.isArray(paths) || paths.some((item) => typeof item !== "string")) throw new Error("invalid paths");
  } catch {
    return noStore({ error: "Project import file paths are invalid." }, { status: 400 });
  }

  const uploads = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!uploads.length || uploads.length !== paths.length) {
    return noStore({ error: "Project import file metadata does not match the selected folder." }, { status: 400 });
  }

  try {
    const files = await Promise.all(uploads.map(async (file, index) => ({
      name: file.name,
      relativePath: paths[index],
      data: new Uint8Array(await file.arrayBuffer()),
    })));
    const result = await importResearchProject({ projectName, files });
    return noStore(result, { status: 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const status = code === "PROJECT_IMPORT_EXISTS" || code === "PROJECT_IMPORT_ID_CONFLICT"
      ? 409
      : code === "PROJECT_IMPORT_DISABLED"
        ? 503
        : 422;
    return noStore({
      error: error instanceof Error ? error.message : "Could not import the research project folder.",
      ...(code ? { code } : {}),
    }, { status });
  }
}
