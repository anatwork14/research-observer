"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

type Review = {
  id: string;
  valid: boolean;
  reviewable: boolean;
  doctor?: { code?: number; output?: string };
};

type EditorNote = {
  slug: string;
  filename: string;
  title: string;
  content: string;
  baseSha256: string;
};

type BrowserDraft = {
  content: string;
  baseSha256: string;
  savedAt: number;
};

type DraftSnapshot = {
  note: EditorNote | null;
  content: string;
  dirty: boolean;
  editing: boolean;
};

type Tab = "edit" | "preview" | "changes";

const DRAFT_PREFIX = "observaire-direct-edit-draft-v1:";

function markdownBody(raw: string) {
  const withoutFrontmatter = raw.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n)?/, "");
  return withoutFrontmatter.replace(/^\s*#\s+.+?(?:\r?\n)+/, "");
}

function browserDraftKey(slug: string) {
  return DRAFT_PREFIX + slug;
}

function readBrowserDraft(slug: string): BrowserDraft | null {
  try {
    const raw = window.localStorage.getItem(browserDraftKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrowserDraft>;
    if (typeof parsed.content !== "string" || typeof parsed.baseSha256 !== "string" || typeof parsed.savedAt !== "number") return null;
    return { content: parsed.content, baseSha256: parsed.baseSha256, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function writeBrowserDraft(slug: string, content: string, baseSha256: string) {
  const savedAt = Date.now();
  try {
    window.localStorage.setItem(browserDraftKey(slug), JSON.stringify({ content, baseSha256, savedAt } satisfies BrowserDraft));
    return savedAt;
  } catch {
    return null;
  }
}

function clearBrowserDraft(slug: string) {
  try {
    window.localStorage.removeItem(browserDraftKey(slug));
  } catch {
    // Draft persistence is a convenience layer; source editing still works without it.
  }
}

export function NoteDirectEditor({
  slug,
  filename,
  displayContent,
  linkMap,
}: {
  slug: string;
  filename: string;
  displayContent: string;
  linkMap: Record<string, string>;
}) {
  const router = useRouter();
  const draftSnapshotRef = useRef<DraftSnapshot>({ note: null, content: "", dirty: false, editing: false });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [tab, setTab] = useState<Tab>("edit");
  const [note, setNote] = useState<EditorNote | null>(null);
  const [content, setContent] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [patch, setPatch] = useState("");
  const [doctor, setDoctor] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<BrowserDraft | null>(null);

  const dirty = Boolean(note && content !== note.content);
  const preview = useMemo(() => markdownBody(content), [content]);
  draftSnapshotRef.current = { note, content, dirty, editing };

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    return () => {
      const snapshot = draftSnapshotRef.current;
      if (!snapshot.editing || !snapshot.note || !snapshot.dirty) return;
      writeBrowserDraft(snapshot.note.slug, snapshot.content, snapshot.note.baseSha256);
    };
  }, []);

  useEffect(() => {
    if (!editing || !note || !dirty) return;
    const timer = window.setTimeout(() => {
      const savedAt = writeBrowserDraft(note.slug, content, note.baseSha256);
      if (savedAt) setDraftSavedAt(savedAt);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [content, dirty, editing, note]);

  async function loadEditor() {
    setLoading(true);
    setError("");
    setMessage("");
    setStaleDraft(null);
    try {
      const response = await fetch(`/api/research/note/edit?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.enabled || !payload.note) {
        throw new Error(payload.error || payload.reason || "Direct editing is unavailable.");
      }
      const nextNote = payload.note as EditorNote;
      const storedDraft = readBrowserDraft(nextNote.slug);
      setNote(nextNote);
      setReview(null);
      setPatch("");
      setDoctor("");
      setEditing(true);
      setTab("edit");

      if (storedDraft && storedDraft.content !== nextNote.content) {
        if (storedDraft.baseSha256 === nextNote.baseSha256) {
          setContent(storedDraft.content);
          setDraftSavedAt(storedDraft.savedAt);
          setMessage("Recovered the browser-local draft for this exact source version. The .md file is still unchanged.");
        } else {
          setContent(nextNote.content);
          setDraftSavedAt(null);
          setStaleDraft(storedDraft);
          setMessage("A browser draft from an older source version is available. Restore it only if you want to reconcile it against the latest file.");
        }
      } else {
        setContent(nextNote.content);
        setDraftSavedAt(null);
      }
    } catch (requestError) {
      setEditing(false);
      setError(requestError instanceof Error ? requestError.message : "Could not open the Markdown editor.");
    } finally {
      setLoading(false);
    }
  }

  async function discardStoredReview(id: string) {
    try {
      await fetch("/api/research/note/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discard", id }),
      });
    } catch {
      // Stored reviews are transient and git-ignored; failure to clean one does not block editing.
    }
  }

  function changeContent(next: string) {
    if (review?.id) void discardStoredReview(review.id);
    setReview(null);
    setPatch("");
    setDoctor("");
    setMessage("");
    setContent(next);
    const nextDirty = Boolean(note && next !== note.content);
    draftSnapshotRef.current = { note, content: next, dirty: nextDirty, editing };
    if (note && !nextDirty) {
      clearBrowserDraft(note.slug);
      setDraftSavedAt(null);
    }
  }

  async function reviewChanges() {
    if (!note || !dirty || reviewing) return;
    setReviewing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/research/note/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          slug: note.slug,
          content,
          baseSha256: note.baseSha256,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not review the Markdown changes.");
      setReview(payload.proposal);
      setPatch(payload.patch || "");
      setDoctor(payload.doctor?.output || payload.proposal?.doctor?.output || "");
      setTab("changes");
      setMessage(payload.valid && payload.reviewable
        ? "Review passed. The patch is staged for an explicit save."
        : "Review completed, but validation must pass before saving.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not review the Markdown changes.");
    } finally {
      setReviewing(false);
    }
  }

  async function saveChanges() {
    if (!review?.id || !review.valid || !review.reviewable || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/research/note/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", id: review.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save the reviewed Markdown patch.");
      if (note) clearBrowserDraft(note.slug);
      draftSnapshotRef.current = { note, content, dirty: false, editing: false };
      setDraftSavedAt(null);
      setStaleDraft(null);
      setReview(null);
      setPatch("");
      setDoctor(payload.doctor || "");
      setMessage(`Saved ${payload.filename}. Research validation passed.`);
      if (payload.slug && payload.slug !== slug) {
        router.replace(`/progress/${payload.slug}`);
        return;
      }
      await loadEditor();
      setEditing(true);
      setMessage(`Saved ${payload.filename}. Research validation passed.`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save the Markdown patch.");
    } finally {
      setSaving(false);
    }
  }

  function discardDraft() {
    if (!note) return;
    if (review?.id) void discardStoredReview(review.id);
    clearBrowserDraft(note.slug);
    draftSnapshotRef.current = { note, content: note.content, dirty: false, editing: true };
    setDraftSavedAt(null);
    setStaleDraft(null);
    setContent(note.content);
    setReview(null);
    setPatch("");
    setDoctor("");
    setError("");
    setMessage("Draft discarded. The .md file was not changed.");
    setTab("edit");
  }

  function restoreStaleDraft() {
    if (!staleDraft || !note) return;
    const draft = staleDraft;
    setStaleDraft(null);
    changeContent(draft.content);
    setMessage("Older browser draft restored against the latest source. Review the full diff carefully before saving.");
  }

  function discardStaleDraft() {
    if (!note) return;
    clearBrowserDraft(note.slug);
    setStaleDraft(null);
    setDraftSavedAt(null);
    setMessage("Older browser draft discarded. The current .md source was not changed.");
  }

  function toggleEditor() {
    if (!editing) {
      void loadEditor();
      return;
    }
    if (dirty && !window.confirm("Discard the unsaved browser draft and leave Direct Edit?")) return;
    if (review?.id) void discardStoredReview(review.id);
    if (note && dirty) clearBrowserDraft(note.slug);
    draftSnapshotRef.current = { note, content, dirty: false, editing: false };
    setDraftSavedAt(null);
    setStaleDraft(null);
    setEditing(false);
    setNote(null);
    setContent("");
    setReview(null);
    setPatch("");
    setDoctor("");
    setError("");
    setMessage("");
  }

  const stateLabel = review
    ? review.valid && review.reviewable ? "reviewed" : "blocked"
    : dirty ? "draft" : "clean";

  return (
    <>
      <div className="reader-toolbar direct-edit-toolbar">
        <div><span className="file-chip">MD</span><code>{note?.filename ?? filename}</code></div>
        <div className="direct-edit-controls">
          {editing && <span className={`direct-edit-state ${stateLabel}`}>{stateLabel}</span>}
          {!editing && <span className="readonly">source of truth</span>}
          <button
            type="button"
            role="switch"
            aria-checked={editing}
            className={`direct-edit-toggle ${editing ? "active" : ""}`}
            onClick={toggleEditor}
            disabled={loading || saving}
          >
            <span aria-hidden="true" />
            {loading ? "Opening…" : editing ? "Direct Edit on" : "Direct Edit"}
          </button>
        </div>
      </div>

      {error && <div className="direct-edit-alert error" role="alert"><strong>Direct Edit needs attention</strong><p>{error}</p></div>}
      {message && <div className="direct-edit-alert" aria-live="polite"><strong>{review?.valid ? "Review ready" : "Editor"}</strong><p>{message}</p></div>}
      {staleDraft && (
        <div className="direct-edit-alert" role="status">
          <strong>Older local draft available</strong>
          <p>The source changed after this draft was saved. Restore it only to reconcile manually against the latest source; saving still requires a fresh validated diff.</p>
          <div className="direct-edit-inline-actions">
            <button type="button" onClick={restoreStaleDraft}>Restore for reconciliation</button>
            <button type="button" onClick={discardStaleDraft}>Discard old draft</button>
          </div>
        </div>
      )}

      {!editing && <article><MarkdownRenderer content={displayContent} linkMap={linkMap} /></article>}

      {editing && note && (
        <section className="direct-edit-shell" aria-label="Direct Markdown editor">
          <header className="direct-edit-head">
            <div>
              <span className="kicker">Working tree</span>
              <strong>Edit → preview → review diff → save</strong>
              <small>The live file changes only after a validated patch is explicitly saved.</small>
            </div>
            <div className="direct-edit-tabs" role="tablist" aria-label="Markdown editor view">
              {(["edit", "preview", "changes"] as Tab[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  role="tab"
                  aria-selected={tab === item}
                  className={tab === item ? "active" : ""}
                  onClick={() => setTab(item)}
                  disabled={item === "changes" && !patch}
                >
                  {item === "changes" ? "Changes" : item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </header>

          {tab === "edit" && (
            <textarea
              className="direct-edit-textarea"
              value={content}
              onChange={(event) => changeContent(event.target.value)}
              spellCheck={false}
              aria-label={`Edit ${note.filename}`}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                  event.preventDefault();
                  void reviewChanges();
                }
              }}
            />
          )}

          {tab === "preview" && (
            <div className="direct-edit-preview">
              <MarkdownRenderer content={preview} linkMap={linkMap} />
            </div>
          )}

          {tab === "changes" && (
            <div className="direct-edit-review">
              <div className="direct-edit-review-summary">
                <span className={`codex-validation ${review?.valid && review?.reviewable ? "passed" : "blocked"}`}>
                  {review?.valid && review?.reviewable ? "validation passed" : "save blocked"}
                </span>
                <span>Git-style patch against the version opened in this editor.</span>
              </div>
              <pre>{patch || "Review the draft to generate a patch."}</pre>
              {doctor && (
                <details>
                  <summary>Research doctor output</summary>
                  <pre>{doctor}</pre>
                </details>
              )}
            </div>
          )}

          <footer className="direct-edit-actions">
            <div>
              <span>{dirty ? draftSavedAt ? `Browser draft autosaved · ${new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Unsaved browser draft" : "No local draft changes"}</span>
              <small>⌘/Ctrl + S reviews; it never bypasses diff review or writes the source directly.</small>
            </div>
            <div>
              <button type="button" className="direct-edit-discard" onClick={discardDraft} disabled={!dirty || reviewing || saving}>Discard</button>
              <button type="button" onClick={() => { setTab("preview"); }} disabled={!dirty || reviewing || saving}>Preview</button>
              <button type="button" className="direct-edit-review-button" onClick={() => void reviewChanges()} disabled={!dirty || reviewing || saving}>
                {reviewing ? "Reviewing…" : review ? "Review again" : "Review changes"}
              </button>
              <button
                type="button"
                className="direct-edit-save"
                onClick={() => void saveChanges()}
                disabled={!review?.valid || !review?.reviewable || saving || reviewing}
              >
                {saving ? "Saving…" : "Save to .md"}
              </button>
            </div>
          </footer>
        </section>
      )}
    </>
  );
}
