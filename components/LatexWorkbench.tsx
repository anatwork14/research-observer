"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { LatexCitationReferences } from "@/components/LatexCitationReferences";
import { activeLatexEditor, notifyLatexEditorChange, setActiveLatexEditor, type LatexEditorAdapter } from "@/components/latex-editor-adapter";
import styles from "./LatexWorkbench.module.css";

const LatexPdfPreview = dynamic(() => import("@/components/LatexPdfPreview"), {
  ssr: false,
  loading: () => <p className={styles.previewHint}>Loading PDF preview…</p>,
});
const LatexCodeEditor = dynamic(() => import("@/components/LatexCodeEditor").then((module) => module.LatexCodeEditor), { ssr: false });

type Engine = "pdflatex" | "xelatex" | "lualatex";
type WorkspaceFile = {
  path: string;
  extension: string;
  bytes: number;
  editable: boolean;
  kind: "source" | "resource";
  hidden: boolean;
};
type Workspace = {
  project: { id: string; label: string };
  files: WorkspaceFile[];
  mainFile: string;
  engine: Engine;
  updatedAt: string | null;
  enabled?: boolean;
  reason?: string;
};
type Source = { file: string; content: string; baseSha256: string };
type Diagnostic = { severity: "error" | "warning"; file?: string; line?: number; message: string };
type Build = {
  id: string;
  project: string;
  mainFile: string;
  engine: Engine;
  success: boolean;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
  pdfUrl: string;
  diagnostics: Diagnostic[];
  createdAt: string;
  log: string;
};
type Toolchain = {
  compileEnabled?: boolean;
  writesEnabled?: boolean;
  latexmk?: { available?: boolean; version?: string; error?: string };
  synctex?: { available?: boolean; version?: string; error?: string };
};
type SyncMark = { page: number; x: number; y: number; width: number; height: number };
type CursorTarget = { line: number; column: number } | null;

function templateFor(file: string) {
  if (!file.toLowerCase().endsWith(".tex")) return "";
  return `\\documentclass{article}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Research manuscript}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Start writing here.

\\end{document}
`;
}

function lineColumnAt(content: string, offset: number) {
  const safe = Math.max(0, Math.min(content.length, offset));
  const before = content.slice(0, safe);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1)?.length ?? 0 };
}

function offsetAtLineColumn(content: string, line: number, column: number) {
  const rows = content.split("\n");
  const safeLine = Math.max(1, Math.min(rows.length, Math.trunc(line)));
  let offset = 0;
  for (let index = 0; index < safeLine - 1; index += 1) offset += rows[index].length + 1;
  return Math.min(content.length, offset + Math.max(0, Math.min(rows[safeLine - 1]?.length ?? 0, Math.trunc(column))));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload.error || "Request failed."), { status: response.status });
  return payload;
}

export function LatexWorkbench({
  projectId,
  initialFile,
  initialLine,
}: {
  projectId: string;
  initialFile?: string;
  initialLine?: number;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFile, setNewFile] = useState("main.tex");
  const [showHidden, setShowHidden] = useState(false);
  const [build, setBuild] = useState<Build | null>(null);
  const [toolchain, setToolchain] = useState<Toolchain>({});
  const [building, setBuilding] = useState(false);
  const [previewTab, setPreviewTab] = useState<"pdf" | "log">("pdf");
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfWidth, setPdfWidth] = useState(620);
  const [pdfViewport, setPdfViewport] = useState({ width: 612, height: 792 });
  const [syncMark, setSyncMark] = useState<SyncMark | null>(null);
  const [pendingCursor, setPendingCursor] = useState<CursorTarget>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mobileFiles, setMobileFiles] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [editorMode, setEditorMode] = useState<"textarea" | "codemirror">("textarea");

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const lineRef = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const updateMode = () => setEditorMode(media.matches ? "codemirror" : "textarea");
    updateMode();
    media.addEventListener("change", updateMode);
    return () => media.removeEventListener("change", updateMode);
  }, []);

  const onCodeMirrorAdapter = useCallback((adapter: LatexEditorAdapter | null) => {
    if (editorMode === "codemirror") setActiveLatexEditor(adapter);
  }, [editorMode]);

  const updateEditorContent = useCallback((next: string) => {
    setContent(next);
    setDirty(next !== source?.content);
    notifyLatexEditorChange();
  }, [source?.content]);

  useEffect(() => {
    if (editorMode !== "textarea" || !source || !editorRef.current) return;
    const textarea = editorRef.current;
    const adapter: LatexEditorAdapter = {
      file: source.file,
      value: () => textarea.value,
      selection: () => ({ start: textarea.selectionStart, end: textarea.selectionEnd }),
      setValue: (next, start, end = start) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
        descriptor?.set?.call(textarea, next);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        if (start !== undefined) textarea.setSelectionRange(start, end ?? start);
      },
      setSelection: (start, end) => textarea.setSelectionRange(start, end),
      focus: () => textarea.focus(),
      domTarget: textarea,
    };
    setActiveLatexEditor(adapter);
    return () => { if (activeLatexEditor() === adapter) setActiveLatexEditor(null); };
  }, [editorMode, source]);

  const refreshWorkspace = useCallback(async () => {
    const payload = await jsonRequest(`/api/ide/files?research=${encodeURIComponent(projectId)}`);
    setWorkspace(payload);
    return payload as Workspace;
  }, [projectId]);

  const openFile = useCallback(async (file: string, cursor?: CursorTarget) => {
    setLoadingFile(true);
    setError("");
    try {
      const payload = await jsonRequest(`/api/ide/files?research=${encodeURIComponent(projectId)}&file=${encodeURIComponent(file)}`) as Source;
      setSource(payload);
      setContent(payload.content);
      setDirty(false);
      setPendingCursor(cursor ?? null);
      setMobileFiles(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not open manuscript file.");
    } finally {
      setLoadingFile(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      jsonRequest(`/api/ide/files?research=${encodeURIComponent(projectId)}`),
      jsonRequest(`/api/ide/compile?research=${encodeURIComponent(projectId)}`),
    ]).then(([nextWorkspace, compileStatus]) => {
      if (cancelled) return;
      setWorkspace(nextWorkspace as Workspace);
      setToolchain(compileStatus.toolchain ?? {});
      setBuild(compileStatus.latest ?? null);
      if (compileStatus.latest?.success) setPreviewTab("pdf");
      const requested = initialFile
        ? nextWorkspace.files.find((file: WorkspaceFile) => file.path === initialFile && file.editable && !file.hidden)?.path
        : undefined;
      const first = nextWorkspace.files.find((file: WorkspaceFile) => file.editable && !file.hidden)?.path;
      const preferred = requested || nextWorkspace.mainFile || first;
      const cursor = requested && Number.isFinite(initialLine) && Number(initialLine) > 0
        ? { line: Math.max(1, Math.trunc(Number(initialLine))), column: 0 }
        : undefined;
      if (preferred) void openFile(preferred, cursor);
    }).catch((requestError) => {
      if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load LaTeX workspace.");
    });
    return () => { cancelled = true; };
  }, [initialFile, initialLine, openFile, projectId, refreshWorkspace]);

  useEffect(() => {
    if (!pendingCursor) return;
    const frame = window.requestAnimationFrame(() => {
      const editor = activeLatexEditor();
      if (!editor) return;
      const offset = offsetAtLineColumn(content, pendingCursor.line, pendingCursor.column);
      editor.focus();
      editor.setSelection(offset, offset, true);
      if (lineRef.current && editorRef.current) {
        const lineHeight = 21.9;
        editorRef.current.scrollTop = Math.max(0, (pendingCursor.line - 4) * lineHeight);
        lineRef.current.scrollTop = editorRef.current.scrollTop;
      }
      setPendingCursor(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [content, editorMode, pendingCursor]);

  useEffect(() => {
    const target = previewRef.current;
    if (!target) return;
    const update = () => setPdfWidth(Math.max(280, Math.min(900, target.clientWidth - 34)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, [mobilePreview, previewTab]);

  const visibleFiles = useMemo(
    () => (workspace?.files ?? []).filter((file) => showHidden || !file.hidden),
    [showHidden, workspace?.files],
  );
  const sourceFiles = useMemo(() => (workspace?.files ?? []).filter((file) => file.editable && !file.hidden), [workspace?.files]);
  const lineNumbers = useMemo(() => Array.from({ length: Math.max(1, content.split("\n").length) }, (_, index) => index + 1).join("\n"), [content]);

  const save = useCallback(async () => {
    if (!source || !dirty) return source;
    setError("");
    try {
      const next = await jsonRequest("/api/ide/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", research: projectId, file: source.file, content, baseSha256: source.baseSha256 }),
      }) as Source;
      setSource(next);
      setContent(next.content);
      setDirty(false);
      setMessage("Saved.");
      await refreshWorkspace();
      return next;
    } catch (requestError) {
      const status = (requestError as { status?: number }).status;
      setError(requestError instanceof Error ? requestError.message : "Could not save manuscript source.");
      if (status === 409) setMessage("Reload the file before saving to avoid overwriting external changes.");
      return null;
    }
  }, [content, dirty, projectId, refreshWorkspace, source]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  const createFile = async () => {
    const file = newFile.trim();
    if (!file) return;
    setError("");
    try {
      const created = await jsonRequest("/api/ide/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", research: projectId, file, content: templateFor(file) }),
      }) as Source;
      await refreshWorkspace();
      setNewFileOpen(false);
      setNewFile("main.tex");
      setSource(created);
      setContent(created.content);
      setDirty(false);
      setMessage(`${created.file} created.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create manuscript file.");
    }
  };

  const toggleHidden = async (file: WorkspaceFile) => {
    if (!workspace) return;
    setError("");
    try {
      const next = await jsonRequest("/api/ide/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: file.hidden ? "restore" : "hide", research: projectId, file: file.path }),
      }) as Workspace;
      setWorkspace((current) => ({ ...(current ?? next), ...next }));
      if (!file.hidden && source?.file === file.path) {
        setSource(null);
        setContent("");
        setDirty(false);
      }
      setMessage(file.hidden ? `${file.path} restored.` : `${file.path} hidden. Nothing was deleted.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update file visibility.");
    }
  };

  const configure = async (next: { mainFile?: string; engine?: Engine }) => {
    setError("");
    try {
      const updated = await jsonRequest("/api/ide/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "configure", research: projectId, ...next }),
      }) as Workspace;
      setWorkspace((current) => ({ ...(current ?? updated), ...updated }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update LaTeX configuration.");
    }
  };

  const compile = async () => {
    if (!workspace?.mainFile) {
      setError("Choose a main .tex file before compiling.");
      return;
    }
    setBuilding(true);
    setError("");
    setMessage("Building LaTeX…");
    try {
      if (dirty) {
        const saved = await save();
        if (!saved) return;
      }
      const response = await fetch("/api/ide/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research: projectId, mainFile: workspace.mainFile, engine: workspace.engine }),
      });
      const payload = await response.json();
      if (!response.ok && !payload.id) throw new Error(payload.error || "LaTeX compilation failed.");
      setBuild(payload);
      setSyncMark(null);
      setPdfPage(1);
      setPreviewTab(payload.success ? "pdf" : "log");
      setMobilePreview(true);
      setMessage(payload.success ? `Build completed in ${(payload.durationMs / 1000).toFixed(1)}s.` : "Build failed. Open the log for diagnostics.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "LaTeX compilation failed.");
      setPreviewTab("log");
      setMobilePreview(true);
    } finally {
      setBuilding(false);
    }
  };

  const forwardSync = async () => {
    const editor = activeLatexEditor();
    if (!build?.success || !source || !editor) return;
    setError("");
    try {
      if (dirty) {
        const saved = await save();
        if (!saved) return;
      }
      const cursor = lineColumnAt(content, editor.selection().start);
      const result = await jsonRequest("/api/ide/synctex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "forward", research: projectId, buildId: build.id, file: source.file, ...cursor }),
      }) as SyncMark;
      setSyncMark(result);
      setPdfPage(result.page);
      setPreviewTab("pdf");
      setMobilePreview(true);
      setMessage(`Synced ${source.file}:${cursor.line} → PDF page ${result.page}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "SyncTeX forward search failed.");
    }
  };

  const reverseSync = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!build?.success || !toolchain.synctex?.available) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * pdfViewport.width;
    const y = ((event.clientY - box.top) / box.height) * pdfViewport.height;
    setError("");
    try {
      const result = await jsonRequest("/api/ide/synctex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reverse", research: projectId, buildId: build.id, page: pdfPage, x, y }),
      }) as { file: string; line: number; column: number };
      await openFile(result.file, { line: result.line, column: result.column });
      setMobilePreview(false);
      setMessage(`Synced PDF page ${pdfPage} → ${result.file}:${result.line}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "SyncTeX reverse search failed.");
    }
  };

  const openDiagnostic = async (diagnostic: Diagnostic) => {
    if (!diagnostic.file) return;
    await openFile(diagnostic.file, diagnostic.line ? { line: diagnostic.line, column: 0 } : null);
    setMobilePreview(false);
  };

  const syncStyle = useMemo(() => {
    if (!syncMark || syncMark.page !== pdfPage || !pdfViewport.width || !pdfViewport.height) return undefined;
    const width = syncMark.width > 0 ? syncMark.width : 32;
    const height = syncMark.height > 0 ? syncMark.height : 12;
    return {
      left: `${Math.max(0, Math.min(100, syncMark.x / pdfViewport.width * 100))}%`,
      top: `${Math.max(0, Math.min(100, syncMark.y / pdfViewport.height * 100))}%`,
      width: `${Math.max(0.7, Math.min(100, width / pdfViewport.width * 100))}%`,
      height: `${Math.max(0.7, Math.min(100, height / pdfViewport.height * 100))}%`,
    };
  }, [pdfPage, pdfViewport.height, pdfViewport.width, syncMark]);

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button type="button" onClick={() => setMobileFiles((value) => !value)}>Files</button>
          <button type="button" className={styles.primary} disabled={building || !workspace?.mainFile || toolchain.latexmk?.available === false} onClick={() => void compile()}>{building ? "Building…" : "Build PDF"}</button>
          <button type="button" disabled={!dirty || !source || workspace?.enabled === false} onClick={() => void save()}>Save</button>
          <button type="button" disabled={!build?.success || !source || toolchain.synctex?.available === false} onClick={() => void forwardSync()}>Sync PDF</button>
          <button type="button" onClick={() => setMobilePreview((value) => !value)}>Preview</button>
        </div>
        <div className={styles.toolbarGroup}>
          <label>
            <span className={styles.fileMeta}>Main </span>
            <select value={workspace?.mainFile ?? ""} disabled={!sourceFiles.length} onChange={(event) => void configure({ mainFile: event.target.value })}>
              {!sourceFiles.length && <option value="">No .tex files</option>}
              {sourceFiles.filter((file) => file.extension === ".tex").map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
            </select>
          </label>
          <label>
            <span className={styles.fileMeta}>Engine </span>
            <select value={workspace?.engine ?? "pdflatex"} onChange={(event) => void configure({ engine: event.target.value as Engine })}>
              <option value="pdflatex">pdfLaTeX</option>
              <option value="xelatex">XeLaTeX</option>
              <option value="lualatex">LuaLaTeX</option>
            </select>
          </label>
        </div>
        {dirty && <span className={styles.dirty}>Unsaved changes</span>}
      </div>

      <div className={styles.grid}>
        <aside className={styles.sidebar} data-mobile-hidden={!mobileFiles}>
          <div className={styles.sidebarHeader}>
            <strong>{workspace?.project.label ?? "Manuscript"}</strong>
            <button type="button" className={styles.iconButton} onClick={() => setNewFileOpen((value) => !value)} title="Add source file">＋</button>
          </div>
          {newFileOpen ? (
            <form className={styles.newFile} onSubmit={(event) => { event.preventDefault(); void createFile(); }}>
              <input value={newFile} onChange={(event) => setNewFile(event.target.value)} placeholder="chapters/results.tex" autoFocus />
              <div className={styles.toolbarGroup}>
                <button type="submit">Create</button>
                <button type="button" onClick={() => setNewFileOpen(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className={styles.sidebarTools}>
              <label><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} /> Hidden</label>
              <span>{workspace?.files.filter((file) => !file.hidden).length ?? 0} files</span>
            </div>
          )}
          <div className={styles.fileList}>
            {visibleFiles.map((file) => (
              <div className={styles.fileRow} key={file.path}>
                <button
                  type="button"
                  className={styles.fileButton}
                  data-active={source?.file === file.path}
                  data-hidden={file.hidden}
                  disabled={!file.editable || loadingFile}
                  onClick={() => file.editable && !file.hidden && void openFile(file.path)}
                  title={`${file.path} · ${formatBytes(file.bytes)}`}
                >
                  {file.kind === "source" ? "⌘ " : "▧ "}{file.path}
                </button>
                <button type="button" className={styles.iconButton} onClick={() => void toggleHidden(file)} title={file.hidden ? "Restore file" : "Hide file (soft delete)"}>{file.hidden ? "↶" : "◌"}</button>
              </div>
            ))}
            {!visibleFiles.length && <p className={styles.previewHint}>No manuscript files yet. Create <strong>main.tex</strong> to start.</p>}
          </div>
        </aside>

        <section className={styles.editorPane}>
          <div className={styles.editorHeader}>
            <strong>{source?.file ?? "No source open"}</strong>
            <span className={styles.fileMeta}>{loadingFile ? "Loading…" : source ? `${content.split("\n").length} lines` : "Create or open a source file"}</span>
            {source && <div className={styles.editorModes} role="group" aria-label="Editor mode">
              <button type="button" aria-pressed={editorMode === "codemirror"} onClick={() => setEditorMode("codemirror")}>CodeMirror</button>
              <button type="button" aria-pressed={editorMode === "textarea"} onClick={() => setEditorMode("textarea")}>Plain editor</button>
            </div>}
          </div>
          <div className={styles.editorWrap} data-editor-mode={editorMode}>
            {source ? (
              editorMode === "codemirror" ? (
                <LatexCodeEditor file={source.file} value={content} onChange={updateEditorContent} onAdapter={onCodeMirrorAdapter} />
              ) : (
                <>
                  <pre ref={lineRef} className={styles.lineNumbers} aria-hidden="true">{lineNumbers}</pre>
                  <textarea
                    ref={editorRef}
                    className={styles.editor}
                    value={content}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    onChange={(event) => updateEditorContent(event.target.value)}
                    onScroll={(event) => { if (lineRef.current) lineRef.current.scrollTop = event.currentTarget.scrollTop; }}
                    onKeyDown={(event) => {
                      if (event.key === "Tab") {
                        event.preventDefault();
                        const target = event.currentTarget;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const next = `${content.slice(0, start)}  ${content.slice(end)}`;
                        updateEditorContent(next);
                        requestAnimationFrame(() => target.setSelectionRange(start + 2, start + 2));
                      }
                    }}
                    aria-label={`Edit ${source.file}`}
                  />
                </>
              )
            ) : (
              <div className={styles.emptyEditor}>
                <div>
                  <h2>Research manuscript IDE</h2>
                  <p>Create a TeX source, compile it, inspect diagnostics, and jump between source and PDF with SyncTeX.</p>
                </div>
              </div>
            )}
          </div>
          {source && <LatexCitationReferences projectId={projectId} file={source.file} content={content} revision={source.baseSha256} />}
        </section>

        <aside className={styles.previewPane} data-mobile-hidden={!mobilePreview}>
          <div className={styles.previewHeader}>
            <div className={styles.previewTabs}>
              <button type="button" data-active={previewTab === "pdf"} onClick={() => setPreviewTab("pdf")}>PDF</button>
              <button type="button" data-active={previewTab === "log"} onClick={() => setPreviewTab("log")}>Log {build?.diagnostics.length ? `(${build.diagnostics.length})` : ""}</button>
            </div>
            <span className={styles.fileMeta}>{build ? `${build.engine} · ${build.success ? "built" : "failed"}` : "Not built"}</span>
          </div>
          <div className={styles.previewBody} ref={previewRef}>
            {previewTab === "pdf" ? (
              build?.success && build.pdfUrl ? (
                <>
                  <div className={styles.pdfControls}>
                    <button type="button" disabled={pdfPage <= 1} onClick={() => { setSyncMark(null); setPdfPage((page) => Math.max(1, page - 1)); }}>←</button>
                    <span>Page {pdfPage} / {pdfPages || "—"}</span>
                    <button type="button" disabled={!pdfPages || pdfPage >= pdfPages} onClick={() => { setSyncMark(null); setPdfPage((page) => Math.min(pdfPages, page + 1)); }}>→</button>
                  </div>
                  <LatexPdfPreview
                    file={build.pdfUrl}
                    pageNumber={pdfPage}
                    width={pdfWidth}
                    className={styles.pdfCanvas}
                    title={toolchain.synctex?.available ? "Double-click to jump back to LaTeX source" : undefined}
                    onDoubleClick={(event) => void reverseSync(event)}
                    onDocumentLoad={(pages) => { setPdfPages(pages); setPdfPage((page) => Math.min(Math.max(1, page), pages)); }}
                    onPageLoad={(width, height) => setPdfViewport({ width, height })}
                  >
                    {syncStyle && <span className={styles.syncMark} style={syncStyle} />}
                  </LatexPdfPreview>
                </>
              ) : (
                <p className={styles.previewHint}>Build the selected main TeX file to generate a PDF preview. After a successful build, <strong>Sync PDF</strong> jumps from the editor cursor to the PDF; double-clicking the PDF performs reverse SyncTeX.</p>
              )
            ) : (
              <div className={styles.logPane}>
                {build?.diagnostics?.length ? (
                  <div className={styles.diagnostics}>
                    {build.diagnostics.map((diagnostic, index) => (
                      <button key={`${diagnostic.file ?? "build"}-${diagnostic.line ?? 0}-${index}`} type="button" className={styles.diagnostic} data-severity={diagnostic.severity} onClick={() => void openDiagnostic(diagnostic)}>
                        <small>{diagnostic.file ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ""}` : diagnostic.severity}</small>
                        {diagnostic.message}
                      </button>
                    ))}
                  </div>
                ) : <p className={styles.previewHint}>No parsed diagnostics for the latest build.</p>}
                <pre className={styles.log}>{build?.log || "Compile the manuscript to see latexmk output here."}</pre>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className={styles.statusbar}>
        <div className={styles.statusLeft}>
          {error ? <span className={styles.error}>{error}</span> : <span>{message || workspace?.reason || "Ready."}</span>}
        </div>
        <div className={styles.statusRight}>
          <span>latexmk {toolchain.latexmk?.available ? "✓" : "—"}</span>
          <span>SyncTeX {toolchain.synctex?.available ? "✓" : "—"}</span>
          {build && <span className={build.success ? styles.success : styles.error}>{build.success ? "Build OK" : `Exit ${build.exitCode}`}</span>}
        </div>
      </footer>
    </div>
  );
}