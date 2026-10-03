"use client";

import { useEffect, useState } from "react";
import { activeLatexEditor, notifyLatexEditorChange } from "./latex-editor-adapter";
import styles from "./LatexLanguageIntelligence.module.css";

type Position = { line: number; column: number };
type Range = { start: Position; end: Position };
type Status = { enabled: boolean; available: boolean; command: string; version?: string; reason?: string };
type Diagnostic = { severity: "error" | "warning" | "info" | "hint"; message: string; source?: string; code?: string; range?: Range };
type SymbolItem = { name: string; detail?: string; kind: string; range?: Range };
type Completion = { label: string; detail?: string; kind?: string; insertText: string; snippet: boolean; range?: Range };
type Analysis = { file: string; diagnostics: Diagnostic[]; symbols: SymbolItem[]; completions: Completion[]; status?: Status };

function lineColumnAt(content: string, offset: number) {
  const safe = Math.max(0, Math.min(content.length, offset));
  const before = content.slice(0, safe);
  const rows = before.split("\n");
  return { line: rows.length - 1, column: rows.at(-1)?.length ?? 0 };
}

function offsetAt(content: string, position: Position) {
  const rows = content.split("\n");
  const line = Math.max(1, Math.min(rows.length, Math.trunc(position.line)));
  let offset = 0;
  for (let index = 0; index < line - 1; index += 1) offset += rows[index].length + 1;
  const column = Math.max(1, Math.trunc(position.column));
  return Math.min(content.length, offset + Math.min(rows[line - 1]?.length ?? 0, column - 1));
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload.error || "TexLab request failed."), { status: response.status, payload });
  return payload;
}

export function LatexLanguageIntelligence({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analyzedContent, setAnalyzedContent] = useState("");
  const [analyzedFile, setAnalyzedFile] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    jsonRequest("/api/ide/texlab")
      .then((payload) => { if (!cancelled) setStatus(payload as Status); })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not inspect TexLab.");
      });
    return () => { cancelled = true; };
  }, []);

  const analyze = async () => {
    const editor = activeLatexEditor();
    if (!editor) {
      setError("Open a LaTeX source file first.");
      return;
    }
    if (!editor.file.toLowerCase().endsWith(".tex")) {
      setError("TexLab language intelligence is available for .tex source files.");
      return;
    }
    const content = editor.value();
    const selection = editor.selection();
    const position = lineColumnAt(content, selection.end);
    setLoading(true);
    setError("");
    try {
      const payload = await jsonRequest("/api/ide/texlab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research: projectId, file: editor.file, content, position }),
      }) as Analysis;
      setAnalysis(payload);
      if (payload.status) setStatus(payload.status);
      setAnalyzedContent(content);
      setAnalyzedFile(editor.file);
      setCursorOffset(selection.end);
    } catch (requestError) {
      const payload = (requestError as { payload?: { status?: Status } }).payload;
      if (payload?.status) setStatus(payload.status);
      setError(requestError instanceof Error ? requestError.message : "TexLab analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const jump = (range?: Range) => {
    const editor = activeLatexEditor();
    if (!editor || !range) return;
    const offset = offsetAt(editor.value(), range.start);
    editor.focus();
    editor.setSelection(offset, offset, true);
  };

  const applyCompletion = (completion: Completion) => {
    const editor = activeLatexEditor();
    if (!editor) {
      setError("Open the analyzed LaTeX source before applying a completion.");
      return;
    }
    if (completion.snippet) {
      setError("Snippet completions are shown for reference but are not auto-applied.");
      return;
    }
    const current = editor.value();
    if (editor.file !== analyzedFile || current !== analyzedContent) {
      setError("The editor changed after TexLab analysis. Refresh language intelligence before applying a completion.");
      return;
    }
    const start = completion.range ? offsetAt(current, completion.range.start) : cursorOffset;
    const end = completion.range ? offsetAt(current, completion.range.end) : cursorOffset;
    const next = current.slice(0, start) + completion.insertText + current.slice(end);
    const cursor = start + completion.insertText.length;
    editor.setValue(next, cursor, cursor);
    editor.focus();
    notifyLatexEditorChange();
    setAnalysis(null);
    setAnalyzedContent("");
    setAnalyzedFile("");
    setCursorOffset(0);
    setError("");
  };

  const available = Boolean(status?.enabled && status?.available);

  return (
    <div className={styles.shell}>
      <section className={styles.status} data-available={available ? "true" : "false"}>
        <div>
          <strong>TexLab language intelligence</strong>
          <small>
            {status === null
              ? "Checking optional language server…"
              : available
                ? `${status.version || status.command} · on-demand analysis`
                : status.reason || `${status.command} is not available in this environment.`}
          </small>
        </div>
        <button type="button" onClick={() => void analyze()} disabled={loading || !available}>
          {loading ? "Analyzing…" : "Analyze buffer"}
        </button>
      </section>

      <p className={styles.authority}>TexLab provides advisory language-server hints. <code>latexmk</code> compiler diagnostics remain authoritative for build status.</p>
      {error && <p className={styles.error}>{error}</p>}

      {analysis && (
        <div className={styles.results}>
          <section>
            <header><strong>Diagnostics</strong><span>{analysis.diagnostics.length}</span></header>
            {!analysis.diagnostics.length && <p className={styles.empty}>TexLab published no diagnostics for this buffer.</p>}
            <div className={styles.items}>
              {analysis.diagnostics.map((item, index) => (
                <button type="button" key={`${item.message}-${index}`} className={styles.item} data-severity={item.severity} onClick={() => jump(item.range)} disabled={!item.range}>
                  <span><strong>{item.message}</strong><small>{[item.source, item.code, item.range ? `line ${item.range.start.line}:${item.range.start.column}` : ""].filter(Boolean).join(" · ")}</small></span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <header><strong>Document symbols</strong><span>{analysis.symbols.length}</span></header>
            {!analysis.symbols.length && <p className={styles.empty}>No TexLab document symbols returned.</p>}
            <div className={styles.items}>
              {analysis.symbols.map((item, index) => (
                <button type="button" key={`${item.name}-${index}`} className={styles.item} onClick={() => jump(item.range)} disabled={!item.range}>
                  <span><strong>{item.name}</strong><small>{[item.kind, item.detail, item.range ? `line ${item.range.start.line}` : ""].filter(Boolean).join(" · ")}</small></span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <header><strong>Completions at cursor</strong><span>{analysis.completions.length}</span></header>
            {!analysis.completions.length && <p className={styles.empty}>No completion candidates returned at the analyzed cursor.</p>}
            <div className={styles.items}>
              {analysis.completions.map((item, index) => (
                <button type="button" key={`${item.label}-${index}`} className={styles.completion} onClick={() => applyCompletion(item)} title={item.snippet ? "Snippet completions are not auto-applied." : "Apply completion to the unchanged analyzed buffer."}>
                  <span><strong>{item.label}</strong><small>{[item.kind, item.detail, item.snippet ? "snippet · preview only" : "plain edit"].filter(Boolean).join(" · ")}</small></span>
                  <b>{item.snippet ? "View" : "Insert"}</b>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
