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
  const [assistantContext, setAssistantContext] = useState<ResearchAssistantContextModel | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState("");
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
    const slug = codexContext.note?.slug?.trim();
    if (!slug) {
      setAssistantContext(null);
      setContextError("");
      setContextLoading(false);
      return;
    }
    const controller = new AbortController();
    setContextLoading(true);
    setContextError("");
    fetch(`/api/research/assist/context?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not build workspace context.");
        return payload;
      })
      .then((payload) => setAssistantContext(payload.context ?? null))
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          setAssistantContext(null);
          setContextError(requestError instanceof Error ? requestError.message : "Could not build workspace context.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setContextLoading(false);
      });
    return () => controller.abort();
  }, [codexContext.note?.slug]);

  function select(service: Service) {
    setActive(service);
    try {
      window.localStorage.setItem("research-observer-assist-tab", service);
    } catch {
      // The interaction still works when storage is unavailable.
    }
  }

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

      {assistantContext
        ? <ResearchAssistantContext context={assistantContext} />
        : <ResearchAssistantContextState loading={contextLoading} error={contextError} />}

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
            ? "Discovery only. Workspace-derived queries are search ideas, not evidence."
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
          contextQueries={assistantContext?.literatureQueries}
          embedded
          onStatusChange={setConsensusStatus}
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
          assistantContext={assistantContext}
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
