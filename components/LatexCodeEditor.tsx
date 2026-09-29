"use client";

import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LatexEditorAdapter } from "./latex-editor-adapter";
import styles from "./LatexCodeEditor.module.css";

const bibtex: StreamParser<unknown> = {
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/%.*$/)) return "comment";
    if (stream.match(/@[A-Za-z]+(?=\s*[({])/)) return "meta";
    if (stream.match(/(?:author|title|year|journal|booktitle|publisher|doi|url|file|volume|number|pages|note|edition|month|isbn)\b(?=\s*=)/i)) return "propertyName";
    if (stream.match(/"(?:\\.|[^"\\])*"?/)) return "string";
    if (stream.match(/[{}(),=]/)) return "punctuation";
    if (stream.match(/\d+/)) return "number";
    stream.next();
    return null;
  },
};

export function LatexCodeEditor({ file, value, onChange, onAdapter }: {
  file: string;
  value: string;
  onChange: (value: string) => void;
  onAdapter: (adapter: LatexEditorAdapter | null) => void;
}) {
  const [view, setView] = useState<EditorView | null>(null);
  const isBib = file.toLowerCase().endsWith(".bib");
  const extensions = useMemo(() => [StreamLanguage.define(isBib ? bibtex : stex)], [isBib]);
  const onUpdate = useCallback((next: EditorView) => setView(next), []);

  useEffect(() => {
    if (!view) return;
    const adapter: LatexEditorAdapter = {
      file,
      value: () => view.state.doc.toString(),
      selection: () => ({ start: view.state.selection.main.from, end: view.state.selection.main.to }),
      setValue: (next, selectionStart, selectionEnd = selectionStart) => {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
          ...(selectionStart === undefined ? {} : { selection: { anchor: selectionStart, head: selectionEnd } }),
        });
        onChange(next);
      },
      setSelection: (start, end, scroll = false) => view.dispatch({
        selection: { anchor: start, head: end },
        ...(scroll ? { scrollIntoView: true } : {}),
      }),
      focus: () => view.focus(),
      domTarget: view.dom,
    };
    onAdapter(adapter);
    return () => onAdapter(null);
  }, [file, onAdapter, onChange, view]);

  return (
    <div className={styles.host} aria-label={`CodeMirror editor for ${file}`}>
      <CodeMirror
        value={value}
        height="100%"
        className={styles.editor}
        extensions={extensions}
        onCreateEditor={onUpdate}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: true, bracketMatching: true, closeBrackets: true, indentOnInput: true }}
      />
    </div>
  );
}
