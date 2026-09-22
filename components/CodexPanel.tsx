"use client";

import { useEffect, useMemo, useState } from "react";

export type CodexResearchContext = {
  note?: {
    slug: string;
    title: string;
    filename: string;
  };
  paper?: {
    path: string;
    title: string;
    page: number;
  };
  selection?: string;
};

type Status = {
  enabled: boolean;
  reason?: string;
};

export function CodexPanel({ context }: { context: CodexResearchContext }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/codex/ask", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setStatus({ enabled: Boolean(payload.enabled), reason: payload.reason }))
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          setStatus({ enabled: false, reason: "Codex status is unavailable." });
        }
      });
    return () => controller.abort();
  }, []);

  const chips = useMemo(() => {
    const values: string[] = [];
    if (context.note) values.push(context.note.title);
    if (context.paper) values.push(`${context.paper.title} · p.${context.paper.page}`);
    if (context.selection) values.push("Selected PDF text");
    return values;
  }, [context]);

  async function ask() {
    const question = prompt.trim();
    if (!question || running || !status?.enabled) return;

    setRunning(true);
    setError("");
    setAnswer("");
    try {
      const response = await fetch("/api/codex/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: question, context }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.reason || "Codex request failed.");
      setAnswer(payload.answer || "Codex returned no text.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Codex request failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="codex-panel" aria-label="Codex research assistant">
      <div className="codex-heading">
        <div>
          <span className="codex-mark" aria-hidden="true">✦</span>
          <div><strong>Codex</strong><small>Ask · read-only</small></div>
        </div>
        <span className={`codex-status ${status?.enabled ? "ready" : ""}`}>
          {status === null ? "checking" : status.enabled ? "ready" : "offline"}
        </span>
      </div>

      <div className="codex-context" aria-label="Codex context">
        <span className="codex-context-label">Context</span>
        <div>
          {chips.map((chip) => <span key={chip} className="codex-chip">{chip}</span>)}
          {!chips.length && <span className="codex-chip muted">Workspace</span>}
        </div>
      </div>

      {status && !status.enabled && (
        <p className="codex-unavailable">{status.reason || "Codex is unavailable in this environment."}</p>
      )}

      <label className="codex-prompt">
        <span className="sr-only">Ask Codex about this research context</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask how this evidence relates to the research…"
          rows={4}
          disabled={!status?.enabled || running}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void ask();
            }
          }}
        />
      </label>

      <div className="codex-actions">
        <span>⌘/Ctrl + Enter</span>
        <button onClick={() => void ask()} disabled={!status?.enabled || running || !prompt.trim()}>
          {running ? "Thinking…" : "Ask"}
        </button>
      </div>

      {error && <p className="codex-error">{error}</p>}
      {answer && (
        <div className="codex-answer" aria-live="polite">
          <span className="kicker">Codex response</span>
          <p>{answer}</p>
        </div>
      )}
    </section>
  );
}
