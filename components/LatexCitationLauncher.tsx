"use client";

import { useEffect, useState } from "react";
import { configureLatexBibliographySource, mapLatexOffsetThroughInsertions } from "@/lib/research/latex-bibliography.mjs";
import { LatexCitationDrawer } from "./LatexCitationDrawer";
import styles from "./LatexCitationLauncher.module.css";
import { activeLatexEditor, notifyLatexEditorChange } from "./latex-editor-adapter";
import { announceIdeOverlayOpen, listenForOtherIdeOverlay } from "./ide-overlay-coordinator";

function activeLatexTextarea() {
  return activeLatexEditor();
}

function validateLatexTarget() {
  const editor = activeLatexTextarea();
  if (!editor) throw new Error("Open a LaTeX source file before inserting a citation.");
  if (!editor.file.toLowerCase().endsWith(".tex")) throw new Error("Open a .tex source file before inserting a citation.");
  return editor;
}

export function LatexCitationLauncher({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => listenForOtherIdeOverlay("citations", () => setOpen(false)), []);

  const openDrawer = () => {
    announceIdeOverlayOpen("citations");
    setOpen(true);
  };

  const insertCitation = (key: string) => {
    const editor = validateLatexTarget();
    const { start, end } = editor.selection();
    const token = `\\cite{${key}}`;
    const value = editor.value();
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    const cursor = start + token.length;
    editor.setValue(next, cursor, cursor);
    editor.focus();
    notifyLatexEditorChange();
  };

  const configureBibliography = (bibFile: string) => {
    const editor = validateLatexTarget();
    const { start, end } = editor.selection();
    const result = configureLatexBibliographySource(editor.value(), bibFile);
    if (!result.changed) return result.message;

    editor.setValue(result.content);
    const mappedStart = mapLatexOffsetThroughInsertions(start, result.edits);
    const mappedEnd = mapLatexOffsetThroughInsertions(end, result.edits);
    editor.setSelection(mappedStart, mappedEnd);
    editor.focus();
    notifyLatexEditorChange();
    return result.message;
  };

  return (
    <>
      {!open && (
        <button type="button" className={styles.launcher} onClick={openDrawer}>
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
