"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analyzeLatexDocument,
  insertLatexEnvironment,
  insertLatexSection,
  latexEditorCommands,
  toggleLatexLineComments,
  wrapLatexSelection,
  type LatexEditorDiagnostic,
  type LatexOutlineItem,
} from "@/lib/research/latex-editor-tools.mjs";
import styles from "./LatexEditorAssistant.module.css";

type Tab = "commands" | "outline" | "problems";
type Transform = { content: string; selectionStart: number; selectionEnd: number };

type Snapshot = {
  file: string;
  content: string;
  outline: LatexOutlineItem[];
  diagnostics: LatexEditorDiagnostic[];
};

function activeEditor() {
  return document.querySelector<HTMLTextAreaElement>('textarea[aria-label^="Edit "]');
}

function editorFile(editor: HTMLTextAreaElement) {
  return editor.getAttribute("aria-label")?.replace(/^Edit\s+/, "") ?? "";
}

function requireTexEditor() {
  const editor = activeEditor();
  if (!editor) throw new Error("Open a LaTeX source file first.");
  const file = editorFile(editor);
  if (!file.toLowerCase().endsWith(".tex")) throw new Error("Open a .tex source file to use LaTeX editor tools.");
  return { editor, file };
}

function replaceTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (!descriptor?.set) throw new Error("The current editor does not expose a writable text adapter.");
  descriptor.set.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyTransform(editor: HTMLTextAreaElement, transform: Transform) {
  replaceTextareaValue(editor, transform.content);
  requestAnimationFrame(() => {
    editor.focus();
    editor.setSelectionRange(transform.selectionStart, transform.selectionEnd);
  });
}

function offsetForLine(content: string, line: number, column = 1) {
  const rows = content.split("\n");
  const target = Math.max(1, Math.min(rows.length, Math.trunc(line)));
  let offset = 0;
  for (let index = 0; index < target - 1; index += 1) offset += rows[index].length + 1;
  return Math.min(content.length, offset + Math.max(0, Math.trunc(column) - 1));
}

function snapshotFromEditor(editor: HTMLTextAreaElement): Snapshot {
  const analysis = analyzeLatexDocument(editor.value);
  return {
    file: editorFile(editor),
    content: editor.value,
    outline: analysis.outline,
    diagnostics: analysis.diagnostics,
  };
}

export function LatexEditorAssistant() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("commands");
  const [query, setQuery] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot>({ file: "", content: "", outline: [], diagnostics: [] });
  const [error, setError] = useState("");
  const refreshSnapshot = () => {
    const editor = activeEditor();
    setSnapshot(editor ? snapshotFromEditor(editor) : { file: "", content: "", outline: [], diagnostics: [] });
  };
  const commands = useMemo(() => latexEditorCommands(), []);
  const visibleCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return commands.filter((command) => !needle || `${command.label} ${command.group}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    const refresh = () => {
      const editor = activeEditor();
      if (!editor) {
        setSnapshot({ file: "", content: "", outline: [], diagnostics: [] });
        return;
      }
      setSnapshot(snapshotFromEditor(editor));
    };

    let bound: HTMLTextAreaElement | null = null;
    const bind = () => {
      const next = activeEditor();
      if (bound === next) return;
      if (bound) bound.removeEventListener("input", refresh);
      bound = next;
      if (bound) bound.addEventListener("input", refresh);
      refresh();
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });

    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        refreshSnapshot();
        setOpen(true);
        setTab("commands");
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "/" && event.target === activeEditor()) {
        event.preventDefault();
        try {
          const { editor } = requireTexEditor();
          applyTransform(editor, toggleLatexLineComments(editor.value, editor.selectionStart, editor.selectionEnd));
          setError("");
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : "Could not toggle comments.");
          refreshSnapshot();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      observer.disconnect();
      if (bound) bound.removeEventListener("input", refresh);
      window.removeEventListener("keydown", keydown);
    };
  }, []);

  const run = (id: string) => {
    setError("");
    try {
      const { editor } = requireTexEditor();
      let transform: Transform;
      if (id === "toggle-comment") transform = toggleLatexLineComments(editor.value, editor.selectionStart, editor.selectionEnd);
      else if (id === "bold") transform = wrapLatexSelection(editor.value, editor.selectionStart, editor.selectionEnd, "textbf");
      else if (id === "italic") transform = wrapLatexSelection(editor.value, editor.selectionStart, editor.selectionEnd, "textit");
      else if (id === "emphasis") transform = wrapLatexSelection(editor.value, editor.selectionStart, editor.selectionEnd, "emph");
      else if (id === "section" || id === "subsection") transform = insertLatexSection(editor.value, editor.selectionStart, editor.selectionEnd, id);
      else if (["equation", "align", "itemize", "enumerate", "figure", "table"].includes(id)) transform = insertLatexEnvironment(editor.value, editor.selectionStart, editor.selectionEnd, id);
      else throw new Error("Unknown editor command.");
      applyTransform(editor, transform);
      setOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not apply editor command.");
    }
  };

  const jump = (line: number, column = 1) => {
    setError("");
    try {
      const { editor } = requireTexEditor();
      const offset = offsetForLine(editor.value, line, column);
      editor.focus();
      editor.setSelectionRange(offset, offset);
      const lineHeight = 21.9;
      editor.scrollTop = Math.max(0, (line - 4) * lineHeight);
      setOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not navigate to source.");
    }
  };

  return (
    <>
      {!open && (
        <button type="button" className={styles.launcher} onClick={() => { refreshSnapshot(); setOpen(true); }} title="LaTeX editor tools (Ctrl/⌘ + Shift + P)">
          Editor
          {snapshot.diagnostics.length > 0 && <span>{snapshot.diagnostics.length}</span>}
        </button>
      )}
      {open && (
        <aside className={styles.drawer} aria-label="LaTeX editor tools">
          <header className={styles.header}>
            <div>
              <strong>LaTeX editor</strong>
              <small>{snapshot.file || "No source open"}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close editor tools">×</button>
          </header>

          <div className={styles.tabs}>
            <button type="button" data-active={tab === "commands"} onClick={() => setTab("commands")}>Commands</button>
            <button type="button" data-active={tab === "outline"} onClick={() => setTab("outline")}>Outline {snapshot.outline.length ? `(${snapshot.outline.length})` : ""}</button>
            <button type="button" data-active={tab === "problems"} onClick={() => setTab("problems")}>Problems {snapshot.diagnostics.length ? `(${snapshot.diagnostics.length})` : ""}</button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.body}>
            {tab === "commands" && (
              <>
                <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search editor commands…" autoFocus />
                <div className={styles.list}>
                  {visibleCommands.map((command) => (
                    <button type="button" className={styles.command} key={command.id} onClick={() => run(command.id)}>
                      <span><strong>{command.label}</strong><small>{command.group}</small></span>
                      {command.shortcut && <kbd>{command.shortcut}</kbd>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === "outline" && (
              <div className={styles.list}>
                {!snapshot.outline.length && <p className={styles.empty}>No sections or labels found in the active TeX source.</p>}
                {snapshot.outline.map((item, index) => (
                  <button type="button" className={styles.outlineItem} style={{ paddingLeft: `${0.72 + Math.min(item.level, 5) * 0.55}rem` }} key={`${item.kind}-${item.line}-${index}`} onClick={() => jump(item.line, item.column)}>
                    <span>{item.kind === "label" ? "#" : "§"}</span>
                    <span><strong>{item.title}</strong><small>line {item.line} · {item.command}</small></span>
                  </button>
                ))}
              </div>
            )}

            {tab === "problems" && (
              <div className={styles.list}>
                {!snapshot.diagnostics.length && <p className={styles.empty}>No lightweight structural problems detected. The LaTeX compiler remains authoritative.</p>}
                {snapshot.diagnostics.map((diagnostic, index) => (
                  <button type="button" className={styles.problem} data-severity={diagnostic.severity} key={`${diagnostic.code}-${diagnostic.line}-${index}`} onClick={() => jump(diagnostic.line, diagnostic.column)}>
                    <span><strong>{diagnostic.message}</strong><small>{diagnostic.code} · line {diagnostic.line}:{diagnostic.column}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <footer className={styles.footer}>
            <span>Client hints only</span>
            <span>latexmk diagnostics decide build status</span>
          </footer>
        </aside>
      )}
    </>
  );
}
