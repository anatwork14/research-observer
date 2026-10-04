import type { ResearchAssistantContext as ResearchAssistantContextModel } from "@/lib/research/assistant-context.mjs";
import styles from "./ResearchAssistantContext.module.css";

function provenance(signal: ResearchAssistantContextModel["evidence"]["incomingSignals"][number]) {
  const source = signal.sourceProvenance;
  if (!source) return "Source metadata unavailable";
  return [
    source.kind,
    source.doi ? `DOI ${source.doi}` : "",
    source.pdf,
    source.page ? `p.${source.page}` : "",
    source.url,
  ].filter(Boolean).join(" · ");
}

export function ResearchAssistantContext({ context }: { context: ResearchAssistantContextModel }) {
  const evidenceSignals = [...context.evidence.incomingSignals, ...context.evidence.outgoingSignals];
  const relationCount = context.summary.explicitIncoming + context.summary.explicitOutgoing;
  const orchestration = context.project?.orchestration;

  return (
    <section className={styles.context} aria-label="Research assistant workspace context">
      <header className={styles.header}>
        <div>
          <span>Workspace context</span>
          <strong>{context.note.title}</strong>
        </div>
        <small>{context.project?.label ?? context.note.research}</small>
      </header>

      <div className={styles.chips} aria-label="Research context facts">
        <span>{relationCount} explicit relation{relationCount === 1 ? "" : "s"}</span>
        <span>{context.summary.evidenceSignals} evidence signal{context.summary.evidenceSignals === 1 ? "" : "s"}</span>
        <span data-attention={context.summary.currentHealthConditions > 0 || undefined}>
          {context.summary.currentHealthConditions} current health fact{context.summary.currentHealthConditions === 1 ? "" : "s"}
        </span>
        {orchestration && <span>{orchestration.status} · {orchestration.dependencyState}</span>}
      </div>

      <details className={styles.details}>
        <summary>Inspect context sent to Research Assist</summary>
        <div className={styles.detailsBody}>
          <div className={styles.group}>
            <span>Current note snapshot</span>
            <p>
              Codex receives up to {context.note.includedContentChars.toLocaleString()} of {context.note.contentChars.toLocaleString()} source characters from this note, plus the factual metadata below. The note text is treated as untrusted source material.
            </p>
          </div>

          <div className={styles.group}>
            <span>Explicit evidence signals</span>
            <div className={styles.rows}>
              {evidenceSignals.length ? evidenceSignals.map((signal, index) => (
                <div className={styles.row} key={`${signal.type}-${signal.source?.slug}-${signal.target?.slug}-${index}`}>
                  <code>{signal.type}</code>
                  <div>
                    <strong>{signal.source?.title ?? "Unknown source"} → {signal.target?.title ?? "Unknown target"}</strong>
                    <small>{provenance(signal)}{signal.note ? ` · ${signal.note}` : ""}</small>
                  </div>
                </div>
              )) : <p>No explicit Evidence → target signal is recorded for this note.</p>}
            </div>
          </div>

          <div className={styles.group}>
            <span>Compiler health facts</span>
            <div className={styles.rows}>
              {context.health.current.length ? context.health.current.map((item) => (
                <div className={styles.row} key={item.code}>
                  <code>{item.code}</code>
                  <div><strong>{item.label}</strong><small>{item.description}</small></div>
                </div>
              )) : <p>No compiler health condition is attached to this current note.</p>}
            </div>
          </div>

          {orchestration && (
            <div className={styles.group}>
              <span>Declared project coordination</span>
              <div className={styles.rows}>
                <div className={styles.row}>
                  <code>{orchestration.status}</code>
                  <div>
                    <strong>Dependency state: {orchestration.dependencyState}</strong>
                    <small>
                      {orchestration.waitingOn.length
                        ? `Waiting on ${orchestration.waitingOn.map((item) => `${item.label} (${item.status})`).join(", ")}.`
                        : "No unfinished declared dependency."}
                    </small>
                  </div>
                </div>
                {orchestration.next && (
                  <div className={styles.row}><code>next</code><div><strong>{orchestration.next}</strong></div></div>
                )}
              </div>
            </div>
          )}

          {context.recent.length > 0 && (
            <div className={styles.group}>
              <span>Recent dated work</span>
              <div className={styles.rows}>
                {context.recent.map((entry) => (
                  <div className={styles.row} key={entry.slug}>
                    <code>{entry.date}</code>
                    <div><strong>{entry.title}</strong><small>{[entry.type, entry.status].filter(Boolean).join(" · ")}</small></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>

      <p className={styles.integrity}>
        This panel shows compiler facts and explicit authored relationships. It does not infer research quality, evidence strength, or workflow status.
      </p>
    </section>
  );
}

export function ResearchAssistantContextState({ loading, error }: { loading?: boolean; error?: string }) {
  if (loading) return <div className={styles.loading}>Building current workspace context…</div>;
  if (error) return <div className={styles.error}>Workspace context is unavailable: {error} Existing Consensus and Codex controls remain usable.</div>;
  return null;
}
