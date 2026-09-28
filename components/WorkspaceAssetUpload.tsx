"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Mode = "paper" | "evidence";

export function WorkspaceAssetUpload({ mode, research = "" }: { mode: Mode; research?: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [open, setOpen] = useState(false);
  const isEvidence = mode === "evidence";

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (research) form.set("research", research);
      if (isEvidence) { form.set("title", title); form.set("comment", comment); }
      const response = await fetch(isEvidence ? "/api/evidence" : "/api/papers", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setSaved(isEvidence ? result.filename : result.path);
      setFile(null);
      setTitle("");
      setComment("");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="asset-upload-container">
      <button className="asset-upload-trigger" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Close" : "Add new..."}
      </button>
      {open && <form className="asset-upload panel" onSubmit={(event) => void submit(event)}>
      <div className="asset-upload-copy">
        <span className="kicker">{isEvidence ? "Add evidence" : "Add to library"}</span>
        <h2>{isEvidence ? "Submit a PDF or image" : "Upload a research PDF"}</h2>
        <p>{isEvidence ? "The file and its Markdown evidence note will be saved in the workspace." : "PDFs are saved under progress/papers and open in the built-in reader."}</p>
      </div>
      <label className="asset-upload-file">
        <span>Choose file</span>
        <input type="file" accept={isEvidence ? ".pdf,.png,.jpg,.jpeg,.gif,.webp,.avif,.bmp,application/pdf,image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp" : ".pdf,application/pdf"} onChange={(event) => { const selected = event.target.files?.[0] ?? null; setPreview(selected ? URL.createObjectURL(selected) : ""); setFile(selected); setError(""); setSaved(""); }} required={!file} />
        {file && <small>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</small>}
      </label>
      {isEvidence && <label><span>Evidence title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Defaults to the filename" maxLength={240} /></label>}
      {isEvidence && <label><span>Research note <small>optional interpretation</small></span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Why does this artifact matter?" /></label>}
      {file && preview && <div className="asset-upload-preview">
        <span>Preview</span>
        {file.type.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview avoids uploading before preview.
          <img src={preview} alt={file.name} />
        ) : file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? <iframe title={`Preview of ${file.name}`} src={preview} /> : <p>Preview unavailable for this file type.</p>}
      </div>}
      {error && <p className="asset-upload-message error" role="alert">{error}</p>}
      {saved && <p className="asset-upload-message success" role="status">Saved <code>{saved}</code>.</p>}
      <button className="asset-upload-submit" type="submit" disabled={!file || busy}>{busy ? "Uploading…" : isEvidence ? "Save evidence" : "Upload PDF"}</button>
      <small className="asset-upload-limit">PDF and image uploads are limited to 64 MB and checked on the server.</small>
      </form>}
    </div>
  );
}
