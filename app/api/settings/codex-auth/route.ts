import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  cancelCodexDeviceAuth,
  codexLoginStatus,
  currentCodexAuthSession,
  logoutCodex,
  startCodexDeviceAuth,
} from "@/lib/settings/codex-auth.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET() {
  const session = currentCodexAuthSession();
  if (session && (session.status === "starting" || session.status === "waiting")) {
    return noStore({
      codex: {
        available: true,
        authenticated: false,
        reason: "Codex device authorization is in progress.",
      },
      session,
    });
  }

  const codex = await codexLoginStatus();
  return noStore({ codex, session });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return noStore({ error: "Cross-origin Codex authorization is not allowed." }, { status: 403 });
  }

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const action = typeof body.action === "string" ? body.action : "start";

  try {
    if (action === "cancel") {
      return noStore({ ok: true, session: cancelCodexDeviceAuth() });
    }
    if (action === "logout") {
      await logoutCodex();
      return noStore({ ok: true, codex: await codexLoginStatus(), session: null });
    }
    if (action !== "start") {
      return noStore({ error: "Unsupported Codex authorization action." }, { status: 400 });
    }

    const session = await startCodexDeviceAuth();
    return noStore({ ok: true, session, codex: await codexLoginStatus() });
  } catch (error) {
    return noStore(
      { error: error instanceof Error ? error.message : "Could not update Codex authorization." },
      { status: 422 },
    );
  }
}
