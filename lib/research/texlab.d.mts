export type TexlabPosition = { line: number; column?: number; character?: number };
export type TexlabPublicPosition = { line: number; column: number };
export type TexlabRange = { start: TexlabPublicPosition; end: TexlabPublicPosition };
export type TexlabDiagnostic = {
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source?: string;
  code?: string;
  range?: TexlabRange;
};
export type TexlabSymbol = { name: string; detail?: string; kind: string; range?: TexlabRange };
export type TexlabCompletion = {
  label: string;
  detail?: string;
  kind?: string;
  insertText: string;
  snippet: boolean;
  range?: TexlabRange;
};
export type TexlabAnalysis = {
  projectId?: string;
  file?: string;
  diagnostics: TexlabDiagnostic[];
  symbols: TexlabSymbol[];
  completions: TexlabCompletion[];
};
export type TexlabStatus = { enabled: boolean; available: boolean; command: string; version?: string; reason?: string };

export function texlabCommand(): string;
export function texlabEnabled(): boolean;
export function parseLspFrames(buffer: Buffer | Uint8Array | string): { messages: unknown[]; rest: Buffer };
export function texlabStatus(options?: { command?: string }): Promise<TexlabStatus>;
export function runTexlabProtocol(options: {
  command?: string;
  cwd: string;
  fileUri: string;
  content: string;
  position?: TexlabPosition;
  timeoutMs?: number;
}): Promise<TexlabAnalysis>;
export function inspectLatexWithTexlab(options: {
  rootDir?: string;
  projectId?: string;
  file: string;
  content: string;
  position?: TexlabPosition;
  command?: string;
}): Promise<TexlabAnalysis>;
