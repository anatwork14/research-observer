"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Target = { slug: string; title: string; type?: string };

export function EvidenceCaptureDialog({
  paperPath,
  paperTitle,
  page,
  quote,
  relationshipTypes,
  targets,
}: {
  paperPath: string;
  paperTitle: string;
  page: number;
  quote: string;
  relationshipTypes: string[];
  targets: Target[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [comment, setComment] = useState("");
  const [relationshipType, setRelationshipType] = useState(relationshipTypes.includes("supports") ? "supports" : relationshipTypes[0] ?? "");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ slug: string; filename: string } | null>(null);

  function open() {
    setError("");
    setCreated(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperPath,
          page,
          quote,
          comment,
          relationship: target ? { type: relationshipType, target } : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create evidence.");
      setCreated({ slug: payload.slug, filename: payload.filename });
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create evidence.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={open}>Add evidence</button>
      <dialog ref={dialogRef} className="evidence-dialog" onClose={() => setError("")}>
        <form className="evidence-dialog-shell" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <header>
            <div><span className="kicker">PDF evidence</span><h2>Capture durable evidence</h2></div>
            <button type="button" onClick={close} aria-label="Close evidence capture">×</button>
          </header>

          <div className="evidence-source-preview">
            <strong>{paperTitle}</strong>
            <span>Page {page}</span>
            <blockquote>{quote}</blockquote>
          </div>

          <label>
            <span>Research note <small>optional interpretation — not part of the quote</small></span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="Why does this excerpt matter?" />
          </label>

          <fieldset>
            <legend>Typed relationship <small>optional</small></legend>
            <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)} disabled={!target}>
              {relationshipTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">No relationship target</option>
              {targets.map((item) => <option key={item.slug} value={item.slug}>{item.title} · {item.type ?? "note"}</option>)}
            </select>
          </fieldset>

          {error && <p className="evidence-dialog-error">{error}</p>}
          {created && (
            <p className="evidence-dialog-success">
              Created <code>{created.filename}</code>. <Link href={`/progress/${created.slug}`}>Open evidence note →</Link>
            </p>
          )}

          <footer>
            <span>Writes an ordered Markdown evidence note under <code>progress/</code>.</span>
            <button type="submit" className="evidence-save" disabled={saving || Boolean(created)}>
              {saving ? "Saving…" : created ? "Saved" : "Create evidence"}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
