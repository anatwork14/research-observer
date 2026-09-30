export type LatexEditorDiagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  line: number;
  column: number;
  message: string;
};

export type LatexOutlineItem = {
  kind: "section" | "label";
  level: number;
  command: string;
  title: string;
  line: number;
  column: number;
};

export type LatexEditorTransform = {
  content: string;
  selectionStart: number;
  selectionEnd: number;
};

export function analyzeLatexDocument(value: string): {
  lines: number;
  outline: LatexOutlineItem[];
  labels: Array<{ label: string; line: number; column: number }>;
  diagnostics: LatexEditorDiagnostic[];
};

export function toggleLatexLineComments(value: string, selectionStart: number, selectionEnd: number): LatexEditorTransform;
export function wrapLatexSelection(value: string, selectionStart: number, selectionEnd: number, command: "textbf" | "textit" | "emph" | "texttt"): LatexEditorTransform;
export function insertLatexEnvironment(value: string, selectionStart: number, selectionEnd: number, environment: string): LatexEditorTransform;
export function insertLatexSection(value: string, selectionStart: number, selectionEnd: number, command?: string): LatexEditorTransform;
export function insertObservaireClaimAnchor(value: string, selectionStart: number): LatexEditorTransform;
export function insertObservaireClaimEvidenceRelation(value: string, selectionStart: number, selectionEnd?: number): LatexEditorTransform;
export function latexEditorCommands(): Array<{ id: string; label: string; group: string; shortcut?: string }>;
