"use client";

import { useEffect, useId, useState } from "react";
import { ConsensusCitationPanel } from "@/components/ConsensusCitationPanel";
import { CodexPanel, type CodexResearchContext } from "@/components/CodexPanel";

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
          <p>Find external literature, then reason over the research you choose to trust.</p>
        </div>
        <span className="research-assist-guard">review-first</span>
      </header>

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
            ? "Discovery only. Review a paper before treating it as evidence."
            : "Ask and Draft are read-only. Act always produces a reviewable proposal before Apply."}
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
          embedded
          onStatusChange={setCodexStatus}
        />
      </div>

      <footer className="research-assist-footer">
        <span>External sources never become research truth automatically.</span>
      </footer>
    </section>
  );
}
