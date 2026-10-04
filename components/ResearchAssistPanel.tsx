"use client";

import { useEffect, useId, useState } from "react";
import { ConsensusCitationPanel } from "@/components/ConsensusCitationPanel";
import { CodexPanel, type CodexResearchContext } from "@/components/CodexPanel";
import { ResearchAssistantContext, ResearchAssistantContextState } from "@/components/ResearchAssistantContext";
import type { ResearchAssistantContext as ResearchAssistantContextModel } from "@/lib/research/assistant-context.mjs";

type Service = "consensus" | "codex";
type ServiceStatus = { enabled: boolean; reason?: string } | null;

function statusLabel(status: ServiceStatus) {
  if (status === null) return "checking";
  return status.enabled ? "ready" : "offline";
}

export function ResearchAssistPanel({
  defaultConsensusQuery,
  codexContext,
}: {
  defaultConsensusQuery: string;
  codexContext: CodexResearchContext;
}) {
  const [active, setActive] = useState<Service>("consensus");
  const [consensusStatus, setConsensusStatus] = useState<ServiceStatus>(null);
  const [codexStatus, setCodexStatus] = useState<ServiceStatus>(null);
  const [contextRevision, setContextRevision] = useState(0);
  const [assistantResponse, setAssistantResponse] = useState<{
    slug: string;
    context: ResearchAssistantContextModel | null;
    error: string;
  } | null>(null);
  const contextSlug = codexContext.note?.slug?.trim();
  const consensusId = useId();
  const codexId = useId();
  const consensusTabId = useId();
  const codexTabId = useId();

  useEffect(() => {
    let frame = 0;
    try {
      const stored = window.localStorage.getItem("research-observer-assist-tab");
      if (stored === "consensus" || stored === "codex") {
        frame = window.requestAnimationFrame(() => setActive(stored));
      }
    } catch {
      // Storage is optional. The default Consensus tab remains usable.
    }
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!contextSlug) return;
    const controller = new AbortController();
    fetch(`/api/research/assist/context?slug=${encodeURIComponent(contextSlug)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not build workspace context.");
        return payload;
      })
      .then((payload) => setAssistantResponse({ slug: contextSlug, context: payload.context ?? null, error: "" }))
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          setAssistantResponse({
            slug: contextSlug,
            context: null,
            error: requestError instanceof Error ? requestError.message : "Could not build workspace context.",
          });
        }
      });
    return () => controller.abort();
  }, [contextSlug, contextRevision]);

  function select(service: Service) {
    setActive(service);
    try {
      window.localStorage.setItem("research-observer-assist-tab", service);
    } catch {
      // The interaction still works when storage is unavailable.
    }
  }

  const canonicalContext = contextSlug && assistantResponse?.slug === contextSlug ? assistantResponse.context : null;
  const targetNote = codexContext.note ? {
    slug: canonicalContext?.note.slug ?? codexContext.note.slug,
    title: canonicalContext?.note.title ?? codexContext.note.title,
    type: canonicalContext?.note.type,
    research: canonicalContext?.note.research ?? codexContext.note.research,
  } : undefined;

  return (
    <section className="research-assist-card panel" aria-label="Research assist">
      <header className="research-assist-header">
        <div>
          <span className="kicker">Research assist</span>
          <h3>Sources + reasoning</h3>
          <p>Find external literature, then reason over explicit workspace evidence and relationships.</p>
        </div>
        <span className="research-assist-guard">review-first</span>
      </header>

      {canonicalContext
        ? <ResearchAssistantContext context={canonicalContext} />
        : contextSlug && <ResearchAssistantContextState loading={assistantResponse?.slug !== contextSlug} error={assistantResponse?.slug === contextSlug ? assistantResponse.error : ""} />}

      <div className="research-assist-tabs" role="tablist" aria-label="Research assist service">
        <button
          id={consensusTabId}
          type="button"
          role="tab"
          aria-selected={active === "consensus"}
          aria-controls={consensusId}
          className={active === "consensus" ? "active consensus" : "consensus"}
          onClick={() => select("consensus")}
        >
          <span className="research-assist-service-mark">C</span>
          <span className="research-assist-service-copy">
            <strong>Consensus</strong>
            <small>Find literature</small>
          </span>
          <span className={`research-assist-state ${consensusStatus?.enabled ? "ready" : ""}`}>
            {statusLabel(consensusStatus)}
          </span>
        </button>

        <button
          id={codexTabId}
          type="button"
          role="tab"
          aria-selected={active === "codex"}
          aria-controls={codexId}
          className={active === "codex" ? "active codex" : "codex"}
          onClick={() => select("codex")}
        >
          <span className="research-assist-service-mark">✦</span>
          <span className="research-assist-service-copy">
            <strong>Codex</strong>
            <small>Reason + propose</small>
          </span>
          <span className={`research-assist-state ${codexStatus?.enabled ? "ready" : ""}`}>
            {statusLabel(codexStatus)}
          </span>
        </button>
      </div>

      <div className="research-assist-boundary" aria-live="polite">
        <span aria-hidden="true">{active === "consensus" ? "↗" : "◇"}</span>
        <p>
          {active === "consensus"
            ? "Discovery only. Workspace-derived query ideas in the context inspector are not evidence."
            : "Ask and Draft are read-only. Server-resolved workspace context takes precedence over browser note metadata."}
        </p>
      </div>

      <div
        id={consensusId}
        role="tabpanel"
        aria-labelledby={consensusTabId}
        className="research-assist-panel"
        hidden={active !== "consensus"}
      >
        <ConsensusCitationPanel
          defaultQuery={defaultConsensusQuery}
          researchId={codexContext.note?.research}
          targetNote={targetNote}
          embedded
          onStatusChange={setConsensusStatus}
          onEvidenceSaved={() => setContextRevision((current) => current + 1)}
        />
      </div>

      <div
        id={codexId}
        role="tabpanel"
        aria-labelledby={codexTabId}
        className="research-assist-panel"
        hidden={active !== "codex"}
      >
        <CodexPanel
          context={codexContext}
          embedded
          onStatusChange={setCodexStatus}
        />
      </div>

      <footer className="research-assist-footer">
        <span>External sources and AI output never become research truth automatically.</span>
      </footer>
    </section>
  );
}
