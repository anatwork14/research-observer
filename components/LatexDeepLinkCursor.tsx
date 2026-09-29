"use client";

import { useEffect, useRef } from "react";
import { activeLatexEditor } from "@/components/latex-editor-adapter";

function offsetAtLine(content: string, line: number) {
  const rows = content.split("\n");
  const safeLine = Math.max(1, Math.min(rows.length, Math.trunc(line)));
  let offset = 0;
  for (let index = 0; index < safeLine - 1; index += 1) offset += rows[index].length + 1;
  return Math.min(content.length, offset);
}

export function LatexDeepLinkCursor({ file, line }: { file?: string; line?: number }) {
  const applied = useRef(false);

  useEffect(() => {
    applied.current = false;
    if (!file || !Number.isFinite(line) || Number(line) <= 0) return;

    let frame = 0;
    const apply = () => {
      if (applied.current) return;
      const editor = activeLatexEditor();
      if (!editor || editor.file !== file) return;
      const offset = offsetAtLine(editor.value(), Number(line));
      editor.focus();
      editor.setSelection(offset, offset, true);
      applied.current = true;
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    };

    schedule();
    window.addEventListener("latex-editor-change", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("latex-editor-change", schedule);
    };
  }, [file, line]);

  return null;
}
