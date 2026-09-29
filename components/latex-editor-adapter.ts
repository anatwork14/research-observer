export type LatexEditorAdapter = {
  file: string;
  value(): string;
  selection(): { start: number; end: number };
  setValue(value: string, selectionStart?: number, selectionEnd?: number): void;
  setSelection(start: number, end: number, scroll?: boolean): void;
  focus(): void;
  domTarget?: HTMLElement;
};

let activeAdapter: LatexEditorAdapter | null = null;
const listeners = new Set<() => void>();

export function activeLatexEditor() {
  return activeAdapter;
}

export function setActiveLatexEditor(adapter: LatexEditorAdapter | null) {
  activeAdapter = adapter;
  notifyLatexEditorChange();
}

export function notifyLatexEditorChange() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("latex-editor-change"));
}

export function subscribeLatexEditor(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
