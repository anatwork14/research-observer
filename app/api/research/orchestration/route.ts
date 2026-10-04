import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  orchestrationConfigReason,
  orchestrationConfigWritable,
  previewOrchestrationConfig,
  readOrchestrationEditorState,
  saveOrchestrationConfig,
} from "@/lib/research/orchestration-config.mjs";

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
  if (code === "ORCHESTRATION_CONFIG_STALE") return 409;
  if (code === "ORCHESTRATION_CONFIG_DISABLED") return 503;
  if (code === "ORCHESTRATION_PROJECT_MISSING") return 404;
  if (code === "ORCHESTRATION_CONFIG_COMPILER" || code === "ORCHESTRATION_CONFIG_ROLLBACK") return 500;
  if (code === "ORCHESTRATION_CONFIG_PARSE") return 422;
  if (code === "ORCHESTRATION_CONFIG_NO_CHANGES") return 422;
  if (code === "ORCHESTRATION_CONFIG_VALIDATION") return 422;
  if (code === "ORCHESTRATION_CONFIG_REVIEW_REQUIRED") return 422;
  return 422;
}

export async function GET() {
  try {
    const state = await readOrchestrationEditorState();
    return noStore(state);
  } catch (error) {
    return noStore({
      enabled: orchestrationConfigWritable(),
      reason: orchestrationConfigReason(),
      error: error instanceof Error ? error.message : "Could not read orchestration configuration.",
    }, { status: 422 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return noStore({ error: "Cross-origin orchestration edits are not allowed." }, { status: 403 });
  }
  if (!orchestrationConfigWritable()) {
    return noStore({ error: orchestrationConfigReason() }, { status: 503 });
  }

  let body: {
    action?: unknown;
    projectId?: unknown;
    orchestration?: unknown;
    baseSha256?: unknown;
    reviewSha256?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const input = {
    projectId: typeof body.projectId === "string" ? body.projectId : "",
    orchestration: body.orchestration,
    baseSha256: typeof body.baseSha256 === "string" ? body.baseSha256 : "",
    reviewSha256: typeof body.reviewSha256 === "string" ? body.reviewSha256 : "",
  };

  try {
    if (action === "preview") {
      return noStore(await previewOrchestrationConfig(input));
    }
    if (action === "save") {
      return noStore(await saveOrchestrationConfig(input));
    }
    return noStore({ error: "Unsupported orchestration editor action." }, { status: 400 });
  } catch (error) {
    const issues = (error as { issues?: unknown })?.issues;
    return noStore({
      error: error instanceof Error ? error.message : "Orchestration edit failed.",
      ...((Array.isArray(issues) && issues.length) ? { issues } : {}),
    }, { status: errorStatus(error) });
  }
}
