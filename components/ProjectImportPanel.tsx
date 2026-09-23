"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ProjectImportPanel.module.css";

type SelectedFile = { file: File; path: string };
type Selection = { projectName: string; files: SelectedFile[]; bytes: number };
type ImportResult = {
  imported?: boolean;
  directory?: string;
  files?: number;
  bytes?: number;
  storagePath?: string;
  project?: { id: string; label: string; notes: number };
  error?: string;
};

type FileSystemEntryLike = {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: FileSystemEntryLike[]) => void, error?: (error: DOMException) => void) => void;
  };
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function commonFolder(files: SelectedFile[]) {
  const roots = new Set(files.map((item) => item.path.replace(/\\/g, "/").split("/").filter(Boolean)[0]).filter(Boolean));
  if (roots.size !== 1) return "";
  const [root] = [...roots];
  return files.every((item) => item.path.replace(/\\/g, "/").includes("/")) ? root : "";
}

function selectionFromFiles(files: SelectedFile[]): Selection {
  const filtered = files.filter((item) => ![".DS_Store", "Thumbs.db", "desktop.ini"].includes(item.file.name));
  const projectName = commonFolder(filtered);
  if (!projectName) throw new Error("Choose or drop one project folder, not a loose group of files.");
  const numberedMarkdown = filtered.filter((item) => /^\d+_.*\.md$/i.test(item.path.replace(/\\/g, "/").split("/").pop() ?? ""));
  if (!numberedMarkdown.length) throw new Error("The folder needs at least one numbered Markdown note such as 00_question.md.");
  return {
    projectName,
    files: filtered,
    bytes: filtered.reduce((sum, item) => sum + item.file.size, 0),
  };
}

function readFileEntry(entry: FileSystemEntryLike) {
  return new Promise<File>((resolve, reject) => {
    if (!entry.file) return reject(new Error("Dropped file entry is not readable."));
    entry.file(resolve, reject);
  });
}

async function readDirectory(reader: NonNullable<ReturnType<NonNullable<FileSystemEntryLike["createReader"]>>>) {
  const all: FileSystemEntryLike[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) return all;
    all.push(...batch);
  }
}

async function collectEntry(entry: FileSystemEntryLike, prefix = ""): Promise<SelectedFile[]> {
  const currentPath = `${prefix}${entry.name}`;
  if (entry.isFile) return [{ file: await readFileEntry(entry), path: currentPath }];
  if (!entry.isDirectory || !entry.createReader) return [];
  const children = await readDirectory(entry.createReader());
  const nested = await Promise.all(children.map((child) => collectEntry(child, `${currentPath}/`)));
  return nested.flat();
}

export function ProjectImportPanel({ enabled, reason, storageDirectory }: { enabled: boolean; reason: string; storageDirectory: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    inputRef.current?.setAttribute("webkitdirectory", "");
    inputRef.current?.setAttribute("directory", "");
  }, []);

  const markdownCount = useMemo(() => selection?.files.filter((item) => item.file.name.toLowerCase().endsWith(".md")).length ?? 0, [selection]);

  function accept(files: SelectedFile[]) {
    try {
      setSelection(selectionFromFiles(files));
      setError("");
      setResult(null);
    } catch (nextError) {
      setSelection(null);
      setError(nextError instanceof Error ? nextError.message : "Could not read that project folder.");
    }
  }

  function onInputChange() {
    const files = Array.from(inputRef.current?.files ?? []).map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
    }));
    accept(files);
  }

  async function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    setError("");
    const entries = Array.from(event.dataTransfer.items)
      .map((item) => (item as DataTransferItemWithEntry).webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntryLike => Boolean(entry));
    if (entries.length !== 1 || !entries[0].isDirectory) {
      setError("Drop one project folder at a time. Folder drag-and-drop works in Chromium browsers; the folder picker works everywhere it is supported.");
      return;
    }
    try {
      accept(await collectEntry(entries[0]));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not read the dropped folder.");
    }
  }

  async function upload() {
    if (!selection || busy || !enabled) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.set("projectName", selection.projectName);
      form.set("paths", JSON.stringify(selection.files.map((item) => item.path)));
      for (const item of selection.files) form.append("files", item.file, item.file.name);
      const response = await fetch("/api/research/projects/import", { method: "POST", body: form });
      const payload = await response.json() as ImportResult;
      if (!response.ok) throw new Error(payload.error || "Project import failed.");
      setResult(payload);
      setSelection(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Project import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="project-import-title">
      <div className={styles.heading}>
        <div>
          <span className="kicker">Folder → project</span>
          <h2 id="project-import-title">Import a research folder</h2>
          <p>Pick or drop one folder. Its folder name becomes the research project, numbered Markdown files become the ordered research log, and everything is persisted under <code>{storageDirectory}/</code>.</p>
        </div>
        <span className={`${styles.status} ${enabled ? styles.ready : styles.readonly}`}>{enabled ? "Writable" : "Read only"}</span>
      </div>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ""} ${!enabled ? styles.disabled : ""}`}
        onDragEnter={(event) => { event.preventDefault(); if (enabled) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => void onDrop(event)}
      >
        <input ref={inputRef} className={styles.input} type="file" multiple disabled={!enabled || busy} onChange={onInputChange} />
        <div className={styles.dropIcon} aria-hidden="true">↥</div>
        <strong>{dragging ? "Drop the project folder" : "Drop a folder here"}</strong>
        <span>or</span>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={!enabled || busy}>Choose project folder</button>
        <small>Example: <code>My Project/00_question.md</code>, <code>01_literature.md</code>, <code>02_experiment.md</code></small>
      </div>

      {selection && (
        <div className={styles.selection}>
          <div>
            <span>Ready to import</span>
            <strong>{selection.projectName}</strong>
            <small>{selection.files.length} files · {markdownCount} Markdown · {formatBytes(selection.bytes)}</small>
          </div>
          <button type="button" onClick={() => void upload()} disabled={busy || !enabled}>{busy ? "Importing…" : "Import + index"}</button>
        </div>
      )}

      {!selection && !result && <p className={styles.reason}>{reason}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {result?.imported && (
        <div className={styles.success} role="status">
          <strong>{result.project?.label || result.directory} is indexed.</strong>
          <span>{result.project?.notes ?? 0} notes · {result.files ?? 0} files saved to <code>{result.storagePath}</code>.</span>
          <small>When Docker uses the supplied bind mount, this path is your real host folder—not container-only storage.</small>
          {result.project?.id && (
            <div className={styles.successActions}>
              <button type="button" onClick={() => router.push(`/progress?research=${encodeURIComponent(result.project!.id)}`)}>Open project notes</button>
              <button type="button" onClick={() => router.push(`/insights?research=${encodeURIComponent(result.project!.id)}`)}>Open insights</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
