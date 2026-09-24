"use client";

import { useRef } from "react";

export function EvidenceAssetPreview({ src, name, image }: { src: string; name: string; image: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="asset-preview-trigger" type="button" onClick={() => dialog.current?.showModal()}>Preview</button>
    <dialog ref={dialog} className="asset-preview-dialog" onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <header><strong>{name}</strong><button type="button" onClick={() => dialog.current?.close()} aria-label="Close preview">×</button></header>
      <div className="asset-preview-content">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated media URLs are dimension-unknown workspace assets.
          <img src={src} alt={name} />
        ) : <iframe title={`Preview of ${name}`} src={src} />}
      </div>
      <footer><a href={src} target="_blank" rel="noreferrer">Open original ↗</a></footer>
    </dialog>
  </>;
}
