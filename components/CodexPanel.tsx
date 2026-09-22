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

const modeLabels: Record<Mode, string> = {
  ask: "Ask",
  draft: "Draft",
  act: "Act",
};

export function CodexPanel({ context }: { context: CodexResearchContext }) {
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
    else if (context.pageText) values.push("Current page text");
    return values;
  }, [context]);

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

  const actionLabel = mode === "act" ? "Prepare changes" : mode === "draft" ? "Draft" : "Ask";
  const placeholder =
    mode === "act"
      ? "Describe the research-file change to prepare…"
      : mode === "draft"
        ? "Draft a research note, synthesis, or evidence update…"
        : "Ask how this evidence relates to the research…";

  return (
    <section className="codex-panel" aria-label="Codex research assistant">
      <div className="codex-heading">
        <div>
          <span className="codex-mark" aria-hidden="true">✦</span>
          <div>
            <strong>Codex</strong>
            <small>{mode === "act" ? "Act · isolated worktree" : `${modeLabels[mode]} · read-only`}</small>
          </div>
        </div>
        <span className={`codex-status ${status?.enabled ? "ready" : ""}`}>
          {status === null ? "checking" : status.enabled ? "ready" : "offline"}
        </span>
      </div>

      <div className="codex-mode-tabs" role="tablist" aria-label="Codex mode">
        {(["ask", "draft", "act"] as Mode[]).map((item) => (
          <button
            key={item}
            className={mode === item ? "active" : ""}
            onClick={() => {
              setMode(item);
              setError("");
              setAnswer("");
              setProposal(null);
              setAppliedMessage("");
            }}
            aria-selected={mode === item}
            role="tab"
          >
            {modeLabels[item]}
          </button>
        ))}
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

      {mode === "act" && (
        <p className="codex-mode-note">
          Act never edits the live tree first. It requires committed/stashed <code>progress/**</code> changes so the detached worktree matches your evidence, then you review the diff before Apply.
        </p>
      )}

      <label className="codex-prompt">
        <span className="sr-only">Codex instruction</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={!status?.enabled || running || applying}
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
        <button onClick={() => void run()} disabled={!status?.enabled || running || applying || !prompt.trim()}>
          {running ? "Working…" : actionLabel}
        </button>
      </div>

      {error && <p className="codex-error">{error}</p>}
      {appliedMessage && <p className="codex-success">{appliedMessage}</p>}

      {answer && (
        <div className="codex-answer" aria-live="polite">
          <span className="kicker">{mode === "act" ? "Agent summary" : "Codex response"}</span>
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
            <button
              className="codex-apply"
              onClick={() => void applyProposal()}
              disabled={!proposal.valid || !proposal.allowed || !proposal.reviewable || applying}
            >
              {applying ? "Applying…" : "Apply"}
            </button>
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
            <p className="codex-unavailable">
              Apply is disabled because this proposal cannot be fully reviewed in the UI{proposal.binary ? " (binary patch)" : " (diff too large)"}.
            </p>
          )}
          {proposal.reviewable && !proposal.valid && (
            <p className="codex-unavailable">Apply is disabled because the proposed worktree did not pass the local research doctor or path policy.</p>
          )}
        </section>
      )}
    </section>
  );
}
