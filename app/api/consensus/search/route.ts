import { NextResponse } from "next/server";
import { consensusConfiguration, searchConsensus } from "@/lib/consensus/client.mjs";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export async function GET() {
  const state = await consensusConfiguration();
  return NextResponse.json(
    {
      enabled: state.enabled,
      source: state.source,
      reason: state.enabled
        ? `Consensus API is configured for server-side scholarly search (${state.source}).`
        : "Add a Consensus API key in Settings or set CONSENSUS_API_KEY on the server.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin Consensus searches are not allowed." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim().slice(0, 1200) : "";
  if (!query) return NextResponse.json({ error: "A research topic or question is required." }, { status: 400 });

  try {
    const result = await searchConsensus({
      query,
      pageSize: numberValue(body.pageSize),
      yearMin: numberValue(body.yearMin),
      yearMax: numberValue(body.yearMax),
      citationMin: numberValue(body.citationMin),
      studyTypes: Array.isArray(body.studyTypes) ? body.studyTypes.filter((item): item is string => typeof item === "string") : [],
      excludePreprints: body.excludePreprints !== false,
      openAccess: body.openAccess === true,
      human: body.human === true,
      medicalMode: body.medicalMode === true,
      includeFullText: body.includeFullText === true,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number"
      ? Number((error as { status: number }).status)
      : (error as { code?: string })?.code === "CONSENSUS_NOT_CONFIGURED" ? 503 : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Consensus search failed." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
