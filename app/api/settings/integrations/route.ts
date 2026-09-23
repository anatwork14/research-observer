import { NextResponse } from "next/server";
import { searchConsensus } from "@/lib/consensus/client.mjs";
import {
  clearConsensusApiKey,
  consensusIntegrationStatus,
  saveConsensusApiKey,
} from "@/lib/settings/integrations.mjs";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET() {
  const consensus = await consensusIntegrationStatus();
  return noStore({
    writable: consensus.writable,
    consensus: {
      configured: consensus.configured,
      source: consensus.source,
      environmentManaged: consensus.source === "environment",
    },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return noStore({ error: "Cross-origin settings changes are not allowed." }, { status: 403 });
  }

  let body: { action?: unknown; apiKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "save-consensus";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  try {
    if (action === "test-consensus") {
      if (!apiKey) return noStore({ error: "Enter a Consensus API key to test." }, { status: 400 });
      const result = await searchConsensus(
        { query: "systematic review research methods", pageSize: 1, excludePreprints: true },
        { apiKey },
      );
      return noStore({ ok: true, papers: result.papers.length });
    }

    if (action !== "save-consensus") {
      return noStore({ error: "Unsupported settings action." }, { status: 400 });
    }

    const saved = await saveConsensusApiKey(apiKey);
    return noStore({ ok: true, consensus: saved });
  } catch (error) {
    return noStore(
      { error: error instanceof Error ? error.message : "Could not update integration settings." },
      { status: action === "test-consensus" ? 502 : 422 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return noStore({ error: "Cross-origin settings changes are not allowed." }, { status: 403 });
  }

  try {
    const cleared = await clearConsensusApiKey();
    return noStore({ ok: true, consensus: cleared });
  } catch (error) {
    return noStore(
      { error: error instanceof Error ? error.message : "Could not clear Consensus settings." },
      { status: 422 },
    );
  }
}
