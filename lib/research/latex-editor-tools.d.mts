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

export function analyzeLatexDocument(value: string): {
  lines: number;
  outline: LatexOutlineItem[];
  labels: Array<{ label: string; line: number; column: number }>;
  diagnostics: LatexEditorDiagnostic[];
};

export function toggleLatexLineComments(value: string, selectionStart: number, selectionEnd: number): { content: string; selectionStart: number; selectionEnd: number };
export function wrapLatexSelection(value: string, selectionStart: number, selectionEnd: number, command: "textbf" | "textit" | "emph" | "texttt"): { content: string; selectionStart: number; selectionEnd: number };
export function insertLatexEnvironment(value: string, selectionStart: number, selectionEnd: number, environment: string): { content: string; selectionStart: number; selectionEnd: number };
export function insertLatexSection(value: string, selectionStart: number, selectionEnd: number, command?: string): { content: string; selectionStart: number; selectionEnd: number };
export function latexEditorCommands(): Array<{ id: string; label: string; group: string; shortcut?: string }>;
