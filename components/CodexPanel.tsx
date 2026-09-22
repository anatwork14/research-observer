"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  pageText?: string;
};

type Status = {
  enabled: boolean;
  reason?: string;
};

type Mode = "ask" | "draft" | "act";

type Proposal = {
  id: string;
  files: string[];
  valid: boolean;
  doctor: { code: number; output: string };
  summary: string;
  patch: string;
  truncated: boolean;
  allowed: boolean;
  reviewable: boolean;
  binary?: boolean;
};

const modeMeta: Record<Mode, { label: string; description: string; action: string; placeholder: string }> = {
  ask: {
    label: "Ask",
    description: "Reason over research",
    action: "Ask Codex",
    placeholder: "Ask how this evidence relates to the research…",
  },
  draft: {
    label: "Draft",
    description: "Write without editing",
    action: "Create draft",
    placeholder: "Draft a research note, synthesis, or evidence update…",
  },
  act: {
    label: "Act",
    description: "Prepare reviewed changes",
    action: "Prepare changes",
    placeholder: "Describe the research-file change to prepare…",
  },
};

const quickPrompts: Record<Mode, string[]> = {
  ask: [
    "What is the strongest unresolved question here?",
    "What evidence contradicts or weakens this note?",
    "What should I investigate next?",
  ],
  draft: [
    "Draft a concise synthesis from the current evidence.",
    "Draft the next-steps section without inventing results.",
    "Draft a research gap statement with explicit uncertainty.",
  ],
  act: [
    "Prepare a small update to this research note based on the current evidence.",
    "Prepare a new follow-up question note linked to this research.",
    "Prepare a clarification of limitations without changing factual claims.",
  ],
};

export function CodexPanel({
  context,
  embedded = false,
  onStatusChange,
}: {
  context: CodexResearchContext;
  embedded?: boolean;
  onStatusChange?: (status: Status) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<Mode>("ask");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [appliedMessage, setAppliedMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/codex/ask", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const next = { enabled: Boolean(payload.enabled), reason: payload.reason };
        setStatus(next);
        onStatusChange?.(next);
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          const next = { enabled: false, reason: "Codex status is unavailable." };
          setStatus(next);
          onStatusChange?.(next);
        }
      });
    return () => controller.abort();
  }, [onStatusChange]);

  const chips = useMemo(() => {
    const values: string[] = [];
    if (context.note) values.push(context.note.title);
    if (context.paper) values.push(`${context.paper.title} · p.${context.paper.page}`);
    if (context.selection) values.push("Selected PDF text");
    else if (context.pageText) values.push("Current page text");
    return values;
  }, [context]);

  function selectMode(next: Mode) {
    if (next === mode || running || applying) return;
    if (proposal) return;
    setMode(next);
    setError("");
    setAnswer("");
    setAppliedMessage("");
  }

  async function run() {
    const instruction = prompt.trim();
    if (!instruction || running || !status?.enabled) return;

    setRunning(true);
    setError("");
    setAnswer("");
    setProposal(null);
    setAppliedMessage("");

    try {
      const endpoint = mode === "act" ? "/api/codex/act" : "/api/codex/ask";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: instruction,
          context,
          ...(mode !== "act" ? { mode } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.reason || "Codex request failed.");

      if (mode === "act") {
        setProposal({
          ...payload.proposal,
          patch: payload.patch || "",
          truncated: Boolean(payload.truncated),
          allowed: Boolean(payload.allowed),
          reviewable: Boolean(payload.reviewable),
          binary: Boolean(payload.binary),
        });
        setAnswer(payload.proposal?.summary || "Codex prepared a research proposal.");
      } else {
        setAnswer(payload.answer || "Codex returned no text.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Codex request failed.");
    } finally {
      setRunning(false);
    }
  }

  async function applyProposal() {
    if (!proposal?.id || !proposal.valid || !proposal.allowed || !proposal.reviewable || applying) return;
    setApplying(true);
    setError("");
    try {
      const response = await fetch("/api/codex/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not apply Codex proposal.");
      setAppliedMessage(`Applied ${payload.files?.length ?? 0} research file${payload.files?.length === 1 ? "" : "s"}; doctor passed.`);
      setProposal(null);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not apply Codex proposal.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className={`codex-panel ${embedded ? "embedded" : ""}`} aria-label="Codex research assistant">
      {!embedded && (
        <div className="codex-heading">
          <div>
            <span className="codex-mark" aria-hidden="true">✦</span>
            <div>
              <strong>Codex</strong>
              <small>{mode === "act" ? "Act · isolated worktree" : `${modeMeta[mode].label} · read-only`}</small>
            </div>
          </div>
          <span className={`codex-status ${status?.enabled ? "ready" : ""}`}>
            {status === null ? "checking" : status.enabled ? "ready" : "offline"}
          </span>
        </div>
      )}

      <div className="assist-section-heading">
        <div>
          <span className="kicker">Local reasoning</span>
          <strong>{modeMeta[mode].description}</strong>
        </div>
        <span className={`assist-mode-safety ${mode === "act" ? "review" : "readonly"}`}>
          {mode === "act" ? "review required" : "read-only"}
        </span>
      </div>

      <div className="codex-mode-tabs" role="tablist" aria-label="Codex mode">
        {(["ask", "draft", "act"] as Mode[]).map((item) => (
          <button
            key={item}
            className={mode === item ? "active" : ""}
            onClick={() => selectMode(item)}
            aria-selected={mode === item}
            role="tab"
            disabled={running || applying || Boolean(proposal && mode !== item)}
            title={proposal && mode !== item ? "Review or dismiss the current proposal before switching modes." : modeMeta[item].description}
          >
            <strong>{modeMeta[item].label}</strong>
            <small>{modeMeta[item].description}</small>
          </button>
        ))}
      </div>

      <div className="codex-context" aria-label="Codex context">
        <span className="codex-context-label">Using</span>
        <div>
          {chips.map((chip) => <span key={chip} className="codex-chip">{chip}</span>)}
          {!chips.length && <span className="codex-chip muted">Workspace</span>}
        </div>
      </div>

      {status && !status.enabled && (
        <div className="assist-state-card muted">
          <strong>Codex is unavailable</strong>
          <p>{status.reason || "Codex is unavailable in this environment."}</p>
        </div>
      )}

      {mode === "act" && (
        <div className="codex-mode-note">
          <strong>Safe Act flow</strong>
          <p>Codex edits an isolated worktree first. You review the diff and validation output before Apply can touch live research.</p>
        </div>
      )}

      <div className="assist-quick-actions codex-quick-actions" aria-label="Codex prompt starters">
        {quickPrompts[mode].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPrompt(item)}
            disabled={!status?.enabled || running || applying || Boolean(proposal)}
          >
            {item}
          </button>
        ))}
      </div>

      <label className="codex-prompt">
        <span className="sr-only">Codex instruction</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={modeMeta[mode].placeholder}
          rows={4}
          disabled={!status?.enabled || running || applying || Boolean(proposal)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void run();
            }
          }}
        />
      </label>

      <div className="codex-actions">
        <span>⌘/Ctrl + Enter</span>
        <button onClick={() => void run()} disabled={!status?.enabled || running || applying || Boolean(proposal) || !prompt.trim()}>
          {running ? <><span className="assist-spinner" aria-hidden="true" />Working…</> : modeMeta[mode].action}
        </button>
      </div>

      {error && (
        <div className="assist-state-card error" role="alert">
          <strong>Codex needs attention</strong>
          <p>{error}</p>
          {status?.enabled && prompt.trim() && !proposal && <button type="button" onClick={() => void run()}>Retry</button>}
        </div>
      )}

      {appliedMessage && (
        <div className="assist-state-card success" aria-live="polite">
          <strong>Research updated</strong>
          <p>{appliedMessage}</p>
        </div>
      )}

      {answer && (
        <div className="codex-answer" aria-live="polite">
          <div className="assist-results-label">
            <span>{mode === "act" ? "Agent summary" : "Codex response"}</span>
            <strong>{modeMeta[mode].label}</strong>
          </div>
          <p>{answer}</p>
        </div>
      )}

      {proposal && (
        <section className="codex-proposal" aria-label="Codex proposed changes">
          <div className="codex-proposal-heading">
            <div>
              <span className={`codex-validation ${proposal.valid && proposal.allowed && proposal.reviewable ? "passed" : "blocked"}`}>
                {proposal.valid && proposal.allowed && proposal.reviewable ? "doctor passed" : proposal.reviewable ? "blocked" : "not reviewable"}
              </span>
              <strong>{proposal.files.length} file{proposal.files.length === 1 ? "" : "s"}</strong>
            </div>
            <div className="codex-proposal-actions">
              <button
                type="button"
                className="codex-dismiss"
                onClick={() => {
                  setProposal(null);
                  setAnswer("");
                }}
                disabled={applying}
              >
                Dismiss
              </button>
              <button
                className="codex-apply"
                onClick={() => void applyProposal()}
                disabled={!proposal.valid || !proposal.allowed || !proposal.reviewable || applying}
              >
                {applying ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>

          <div className="codex-files">
            {proposal.files.map((file) => <code key={file}>{file}</code>)}
          </div>

          <details className="codex-diff-details" open>
            <summary>Review diff{proposal.truncated ? " · preview truncated" : ""}</summary>
            <pre>{proposal.patch || "No diff available."}</pre>
          </details>

          <details className="codex-doctor">
            <summary>Validation output</summary>
            <pre>{proposal.doctor?.output || "No doctor output."}</pre>
          </details>

          {!proposal.reviewable && (
            <div className="assist-state-card muted">
              <strong>Apply disabled</strong>
              <p>This proposal cannot be fully reviewed in the UI{proposal.binary ? " because it contains a binary patch." : " because the diff is too large."}</p>
            </div>
          )}
          {proposal.reviewable && !proposal.valid && (
            <div className="assist-state-card error">
              <strong>Apply disabled</strong>
              <p>The proposed worktree did not pass the research doctor or path policy.</p>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
