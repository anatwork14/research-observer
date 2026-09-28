"use client";

import { useState } from "react";
import { configureLatexBibliographySource, mapLatexOffsetThroughInsertions } from "@/lib/research/latex-bibliography.mjs";
import { LatexCitationDrawer } from "./LatexCitationDrawer";
import styles from "./LatexCitationLauncher.module.css";

function activeLatexTextarea() {
  return document.querySelector<HTMLTextAreaElement>('textarea[aria-label^="Edit "]');
}

function validateLatexTarget() {
  const editor = activeLatexTextarea();
  if (!editor) throw new Error("Open a LaTeX source file before inserting a citation.");
  const file = editor.getAttribute("aria-label")?.replace(/^Edit\s+/, "") ?? "";
  if (!file.toLowerCase().endsWith(".tex")) throw new Error("Open a .tex source file before inserting a citation.");
  return editor;
}

function replaceTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (!descriptor?.set) throw new Error("The current editor does not expose a writable text adapter.");
  descriptor.set.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export function LatexCitationLauncher({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  const insertCitation = (key: string) => {
    const editor = validateLatexTarget();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const token = `\\cite{${key}}`;
    const next = `${editor.value.slice(0, start)}${token}${editor.value.slice(end)}`;
    replaceTextareaValue(editor, next);
    requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + token.length;
      editor.setSelectionRange(cursor, cursor);
    });
  };

  const configureBibliography = (bibFile: string) => {
    const editor = validateLatexTarget();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const result = configureLatexBibliographySource(editor.value, bibFile);
    if (!result.changed) return result.message;

    replaceTextareaValue(editor, result.content);
    const mappedStart = mapLatexOffsetThroughInsertions(start, result.edits);
    const mappedEnd = mapLatexOffsetThroughInsertions(end, result.edits);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(mappedStart, mappedEnd);
    });
    return result.message;
  };

  return (
    <>
      {!open && (
        <button type="button" className={styles.launcher} onClick={() => setOpen(true)}>
          Citations
        </button>
      )}
      <LatexCitationDrawer
        projectId={projectId}
        open={open}
        onClose={() => setOpen(false)}
        validateInsert={() => { validateLatexTarget(); }}
        onInsert={(key) => insertCitation(key)}
        onConfigureBibliography={configureBibliography}
        onLibraryChanged={() => undefined}
      />
    </>
  );
}
