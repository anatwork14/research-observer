"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type CreatedNote = { slug: string; filename: string; title: string; research: string };

export function NewResearchNoteDialog({
  types,
  projects,
  research,
  enabled,
}: {
  types: string[];
  projects: Array<{ id: string; label: string }>;
  research: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [type, setType] = useState(types.includes("note") ? "note" : types[0] ?? "");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedNote | null>(null);

  function open() {
    setError("");
    setCreated(null);
    dialogRef.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !enabled) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/research/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary, type, body, research }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create the note.");
      setCreated(payload as CreatedNote);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="new-note-trigger" type="button" onClick={open} disabled={!enabled} title={!enabled ? "Note creation is disabled" : undefined}>Add new note</button>
      <dialog ref={dialogRef} className="new-note-dialog" onClose={() => setError("")}>
        <form className="new-note-form" onSubmit={(event) => void submit(event)}>
          <header>
            <div><span className="kicker">New research note</span><h2>Create a note</h2><p>Saved under the current project and checked by the research compiler.</p></div>
            <button type="button" className="new-note-close" onClick={() => dialogRef.current?.close()} aria-label="Close note creation">×</button>
          </header>
          <label><span>Title</span><input required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label>
          <label><span>Summary</span><input required maxLength={800} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What is this note about?" /></label>
          <label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}>{types.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Starting notes <small>optional Markdown</small></span><textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add an initial question, context, or next step." /></label>
          <p className="new-note-project">Project: <strong>{projects.find((project) => project.id === research)?.label ?? "All projects (default)"}</strong></p>
          {error && <p role="alert" className="new-note-error">{error}</p>}
          {created && <p role="status" className="new-note-success">Created <code>{created.filename}</code>. <Link href={`/progress/${created.slug}${created.research ? `?research=${encodeURIComponent(created.research)}` : ""}`}>Open note →</Link></p>}
          <footer><small>The note is created as an ordered Markdown file. Reopen it to edit its contents.</small><button className="new-note-save" type="submit" disabled={saving || Boolean(created)}>{saving ? "Creating…" : created ? "Created" : "Create note"}</button></footer>
        </form>
      </dialog>
    </>
  );
}
