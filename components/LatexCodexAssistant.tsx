"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./LatexCodexAssistant.module.css";

type Mode = "ask" | "draft";
type Status = { enabled: boolean; reason?: string };
type CompilerDiagnostic = { severity?: string; file?: string; line?: number; message?: string };

type BuildStatus = {
  latest?: {
    success?: boolean;
    diagnostics?: CompilerDiagnostic[];
  } | null;
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
};

function activeTexEditor() {
  const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label^="Edit "]');
  if (!editor) return null;
  const file = editor.getAttribute("aria-label")?.replace(/^Edit\s+/, "") ?? "";
  if (!file.toLowerCase().endsWith(".tex")) return null;
  return { editor, file };
}

export function LatexCodexAssistant({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ask");
  const [status, setStatus] = useState<Status | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contextLabel, setContextLabel] = useState("Workspace");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/codex/ask", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setStatus({ enabled: Boolean(payload.enabled), reason: payload.reason }))
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") setStatus({ enabled: false, reason: "Codex status is unavailable." });
      });
    return () => controller.abort();
  }, []);

  const openAssistant = () => {
    const current = activeTexEditor();
    if (!current) {
      setContextLabel("Workspace · no TeX source open");
      setOpen(true);
      return;
    }
    const selected = current.editor.value.slice(current.editor.selectionStart, current.editor.selectionEnd).trim();
    setContextLabel(selected ? `${current.file} · selection` : current.file);
    setOpen(true);
  };

  const modeDescription = useMemo(() => mode === "ask" ? "Read-only manuscript reasoning" : "Read-only draft proposal", [mode]);

  const run = async () => {
    const instruction = prompt.trim();
    if (!instruction || running || !status?.enabled) return;
    setRunning(true);
    setError("");
    setAnswer("");
    setCopied(false);
    try {
      const current = activeTexEditor();
      let build: BuildStatus = {};
      try {
        const response = await fetch(`/api/ide/compile?research=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        if (response.ok) build = await response.json();
      } catch {
        // Compiler status is helpful context but must not block Ask/Draft.
      }

      const manuscript = current ? {
        project: projectId,
        file: current.file,
        selection: current.editor.value.slice(current.editor.selectionStart, current.editor.selectionEnd).trim(),
        source: current.editor.value,
        diagnostics: build.latest?.diagnostics ?? [],
      } : {
        project: projectId,
        diagnostics: build.latest?.diagnostics ?? [],
      };

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

  return (
    <>
      {!open && (
        <button type="button" className={styles.launcher} onClick={openAssistant} title="Codex manuscript assistant (Ask/Draft only)">
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
            <button type="button" data-active={mode === "draft"} disabled={running} onClick={() => setMode("draft")}><strong>Draft</strong><small>Propose text only</small></button>
          </div>

          <div className={styles.context}>
            <span>Using</span>
            <strong>{contextLabel}</strong>
            <small>Unsaved browser source + latest compiler diagnostics can be included as untrusted context.</small>
          </div>

          {status && !status.enabled && <p className={styles.notice}>{status.reason || "Codex is unavailable."}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.quickPrompts}>
            {quickPrompts[mode].map((item) => (
              <button type="button" key={item} disabled={running} onClick={() => setPrompt(item)}>{item}</button>
            ))}
          </div>

          <div className={styles.composer}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={mode === "ask" ? "Ask about the manuscript, diagnostics, or supporting research…" : "Describe the text you want Codex to draft without editing files…"}
            />
            <button type="button" className={styles.primary} disabled={running || !prompt.trim() || !status?.enabled} onClick={() => void run()}>
              {running ? "Running…" : mode === "ask" ? "Ask Codex" : "Create draft"}
            </button>
          </div>

          <div className={styles.answer}>
            {answer ? <pre>{answer}</pre> : <p>Codex responses here are read-only. Manuscript Act/editing is intentionally disabled until a stale-safe manuscript review/apply path exists.</p>}
            {answer && <button type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy response"}</button>}
          </div>

          <footer className={styles.footer}>
            <span>Ask/Draft: read-only</span>
            <span>Act does not write manuscripts</span>
          </footer>
        </aside>
      )}
    </>
  );
}
