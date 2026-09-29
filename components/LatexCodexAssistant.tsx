"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./LatexCodexAssistant.module.css";
import { activeLatexEditor } from "./latex-editor-adapter";
import { announceIdeOverlayOpen, listenForOtherIdeOverlay } from "./ide-overlay-coordinator";

type Mode = "ask" | "draft" | "act";
type Status = { enabled: boolean; reason?: string };
type CompilerDiagnostic = { severity?: string; file?: string; line?: number; message?: string };
type BuildStatus = {
  latest?: {
    success?: boolean;
    diagnostics?: CompilerDiagnostic[];
  } | null;
};
type ProposalDiagnostic = { file?: string; severity?: string; code?: string; line?: number; message?: string };
type ManuscriptProposal = {
  proposal: {
    id: string;
    files: string[];
    valid: boolean;
    reviewable: boolean;
    summary?: string;
    validation?: { valid?: boolean; diagnostics?: ProposalDiagnostic[] };
  };
  patch: string;
  truncated?: boolean;
  allowed?: boolean;
  reviewable?: boolean;
  destructive?: boolean;
  validation?: { valid?: boolean; diagnostics?: ProposalDiagnostic[] };
};

const quickPrompts: Record<Mode, string[]> = {
  ask: [
    "Explain the most important compiler problems in the current manuscript and suggest the smallest safe fixes.",
    "Which claims in the current section appear to need citations from this research workspace?",
    "Review the current manuscript structure and identify gaps or duplicated sections.",
  ],
  draft: [
    "Draft a clearer version of the selected manuscript text without changing its factual meaning.",
    "Draft a concise transition for the current section and mark any factual claims that need evidence.",
    "Draft a limitations paragraph using only evidence that exists in this research workspace.",
  ],
  act: [
    "Fix the current LaTeX source using the smallest changes needed to address the visible compiler problems.",
    "Improve the selected manuscript passage for clarity while preserving claims, citations, labels, and factual meaning.",
    "Refactor the manuscript structure for readability without inventing evidence, citations, or bibliography metadata.",
  ],
};

function activeManuscriptEditor() {
  const editor = activeLatexEditor();
  if (!editor) return null;
  if (!/\.(?:tex|bib|sty|cls|bst)$/i.test(editor.file)) return null;
  return { editor, file: editor.file };
}

async function fetchStatus(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal });
  const payload = await response.json();
  return { enabled: Boolean(payload.enabled), reason: payload.reason || (!response.ok ? payload.error : undefined) } as Status;
}

export function LatexCodexAssistant({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ask");
  const [status, setStatus] = useState<Status | null>(null);
  const [actStatus, setActStatus] = useState<Status | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [proposal, setProposal] = useState<ManuscriptProposal | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contextLabel, setContextLabel] = useState("Workspace");

  useEffect(() => {
    const controller = new AbortController();
    const stopOverlayListener = listenForOtherIdeOverlay("codex", () => setOpen(false));
    Promise.all([
      fetchStatus("/api/codex/ask", controller.signal).catch((requestError) => {
        if ((requestError as Error).name === "AbortError") throw requestError;
        return { enabled: false, reason: "Codex status is unavailable." } as Status;
      }),
      fetchStatus("/api/codex/manuscript-act", controller.signal).catch((requestError) => {
        if ((requestError as Error).name === "AbortError") throw requestError;
        return { enabled: false, reason: "Manuscript Act status is unavailable." } as Status;
      }),
    ]).then(([ask, act]) => {
      setStatus(ask);
      setActStatus(act);
    }).catch(() => null);
    return () => {
      controller.abort();
      stopOverlayListener();
    };
  }, []);

  const openAssistant = () => {
    const current = activeManuscriptEditor();
    announceIdeOverlayOpen("codex");
    if (!current) {
      setContextLabel("Workspace · no manuscript source open");
      setOpen(true);
      return;
    }
    const selection = current.editor.selection();
    const selected = current.editor.value().slice(selection.start, selection.end).trim();
    setContextLabel(selected ? `${current.file} · selection` : current.file);
    setOpen(true);
  };

  const modeDescription = useMemo(() => {
    if (mode === "ask") return "Read-only manuscript reasoning";
    if (mode === "draft") return "Read-only draft proposal";
    return "Isolated diff → human review → explicit apply";
  }, [mode]);
  const activeStatus = mode === "act" ? actStatus : status;

  const manuscriptContext = async () => {
    const current = activeManuscriptEditor();
    let build: BuildStatus = {};
    try {
      const response = await fetch(`/api/ide/compile?research=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      if (response.ok) build = await response.json();
    } catch {
      // Compiler diagnostics are optional context and must not block Codex.
    }
    if (!current) return { project: projectId, diagnostics: build.latest?.diagnostics ?? [] };
    const selection = current.editor.selection();
    const value = current.editor.value();
    return {
      project: projectId,
      file: current.file,
      selection: value.slice(selection.start, selection.end).trim(),
      source: value,
      diagnostics: build.latest?.diagnostics ?? [],
    };
  };

  const run = async () => {
    const instruction = prompt.trim();
    if (!instruction || running || !activeStatus?.enabled || (mode === "act" && proposal)) return;
    setRunning(true);
    setError("");
    setAnswer("");
    setCopied(false);
    try {
      const manuscript = await manuscriptContext();
      if (mode === "act") {
        const response = await fetch("/api/codex/manuscript-act", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: instruction, projectId, context: { manuscript } }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || payload.reason || "Could not prepare manuscript changes.");
        setProposal(payload as ManuscriptProposal);
        setAnswer(payload.proposal?.summary || "Codex prepared a manuscript diff for review.");
        return;
      }

      const response = await fetch("/api/codex/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: instruction, mode, context: { manuscript } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.reason || "Codex request failed.");
      setAnswer(payload.answer || "Codex returned no text.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Codex request failed.");
    } finally {
      setRunning(false);
    }
  };

  const copy = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
    } catch {
      setError("Could not copy the Codex response.");
    }
  };

  const resolveProposal = async (action: "apply" | "discard") => {
    const id = proposal?.proposal.id;
    if (!id || running) return;
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/codex/manuscript-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update manuscript proposal.");
      if (action === "discard") {
        setProposal(null);
        setAnswer("Manuscript proposal discarded. No source files were changed.");
        return;
      }
      setProposal(null);
      setAnswer(`Applied reviewed manuscript changes to ${(payload.files ?? []).length} file${(payload.files ?? []).length === 1 ? "" : "s"}. Reloading the IDE from the new source baseline…`);
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update manuscript proposal.");
    } finally {
      setRunning(false);
    }
  };

  const validation = proposal?.validation ?? proposal?.proposal.validation;
  const proposalReady = Boolean(
    proposal &&
    proposal.proposal.valid &&
    proposal.proposal.reviewable &&
    proposal.allowed !== false &&
    proposal.reviewable !== false &&
    proposal.destructive !== true &&
    validation?.valid !== false,
  );

  return (
    <>
      {!open && (
        <button type="button" className={styles.launcher} onClick={openAssistant} title="Codex manuscript assistant">
          ✦ Codex
        </button>
      )}
      {open && (
        <aside className={styles.drawer} aria-label="Codex manuscript assistant">
          <header className={styles.header}>
            <div>
              <strong>Codex · Manuscript</strong>
              <small>{modeDescription}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Codex manuscript assistant">×</button>
          </header>

          <div className={styles.modes} role="group" aria-label="Codex manuscript mode">
            <button type="button" data-active={mode === "ask"} disabled={running} onClick={() => setMode("ask")}><strong>Ask</strong><small>Reason only</small></button>
            <button type="button" data-active={mode === "draft"} disabled={running} onClick={() => setMode("draft")}><strong>Draft</strong><small>Propose text</small></button>
            <button type="button" data-active={mode === "act"} disabled={running} onClick={() => setMode("act")}><strong>Act</strong><small>Review diff</small></button>
          </div>

          <div className={styles.context}>
            <span>Using</span>
            <strong>{contextLabel}</strong>
            <small>{mode === "act"
              ? "Act snapshots saved manuscript sources. Unsaved active-editor changes are refused until saved or reloaded."
              : "Unsaved browser source + latest compiler diagnostics can be included as untrusted context."}</small>
          </div>

          {activeStatus && !activeStatus.enabled && <p className={styles.notice}>{activeStatus.reason || "Codex is unavailable."}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.quickPrompts}>
            {quickPrompts[mode].map((item) => (
              <button type="button" key={item} disabled={running || Boolean(mode === "act" && proposal)} onClick={() => setPrompt(item)}>{item}</button>
            ))}
          </div>

          <div className={styles.composer}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={mode === "ask"
                ? "Ask about the manuscript, diagnostics, or supporting research…"
                : mode === "draft"
                  ? "Describe the text you want Codex to draft without editing files…"
                  : "Describe the manuscript source change. Codex will prepare a reviewable diff only…"}
            />
            <button type="button" className={styles.primary} disabled={running || !prompt.trim() || !activeStatus?.enabled || Boolean(mode === "act" && proposal)} onClick={() => void run()}>
              {running ? "Running…" : mode === "ask" ? "Ask Codex" : mode === "draft" ? "Create draft" : "Prepare reviewed diff"}
            </button>
          </div>

          <div className={styles.answer}>
            {answer ? <pre>{answer}</pre> : <p>{mode === "act"
              ? "Act cannot write directly. It snapshots saved manuscript source, prepares an isolated patch, and waits for explicit review/apply."
              : "Ask/Draft responses are read-only and never silently inserted into manuscript source."}</p>}
            {answer && mode !== "act" && <button type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy response"}</button>}

            {mode === "act" && proposal && (
              <section className={styles.proposal} aria-label="Manuscript proposal review">
                <div className={styles.proposalMeta}>
                  <strong>{proposalReady ? "Ready for review" : "Cannot apply"}</strong>
                  <span>{proposal.proposal.files.length} touched file{proposal.proposal.files.length === 1 ? "" : "s"}</span>
                </div>
                <ul className={styles.files}>
                  {proposal.proposal.files.map((file) => <li key={file}><code>{file}</code></li>)}
                </ul>
                {(validation?.diagnostics?.length ?? 0) > 0 && (
                  <div className={styles.validation}>
                    <strong>Advisory LaTeX diagnostics</strong>
                    {validation?.diagnostics?.slice(0, 12).map((diagnostic, index) => (
                      <p key={`${diagnostic.file ?? "source"}:${diagnostic.line ?? 0}:${index}`}>
                        {diagnostic.file ?? "source"}{diagnostic.line ? `:${diagnostic.line}` : ""} · {diagnostic.message ?? diagnostic.code ?? "Diagnostic"}
                      </p>
                    ))}
                  </div>
                )}
                <div className={styles.patchHeader}>
                  <strong>Exact patch</strong>
                  {proposal.truncated && <span>Preview truncated — proposal is not reviewable</span>}
                </div>
                <pre className={styles.patch}>{proposal.patch}</pre>
                <div className={styles.proposalActions}>
                  <button type="button" className={styles.primary} disabled={running || !proposalReady} onClick={() => void resolveProposal("apply")}>Apply reviewed changes</button>
                  <button type="button" disabled={running} onClick={() => void resolveProposal("discard")}>Discard proposal</button>
                </div>
              </section>
            )}
          </div>

          <footer className={styles.footer}>
            <span>Ask/Draft: read-only</span>
            <span>Act: isolated diff + stale-safe apply</span>
          </footer>
        </aside>
      )}
    </>
  );
}
