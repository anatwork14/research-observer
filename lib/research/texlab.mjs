import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileResearchWorkspace } from "./compiler.mjs";
import { readLatexSource } from "./latex-ide.mjs";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_PROTOCOL_BYTES = 4 * 1024 * 1024;
const MAX_ITEMS = 200;
const DEFAULT_TIMEOUT_MS = 8_000;

const SYMBOL_KINDS = {
  1: "file", 2: "module", 3: "namespace", 4: "package", 5: "class", 6: "method", 7: "property", 8: "field",
  9: "constructor", 10: "enum", 11: "interface", 12: "function", 13: "variable", 14: "constant", 15: "string", 16: "number",
  17: "boolean", 18: "array", 19: "object", 20: "key", 21: "null", 22: "enum-member", 23: "struct", 24: "event", 25: "operator", 26: "type-parameter",
};

const COMPLETION_KINDS = {
  1: "text", 2: "method", 3: "function", 4: "constructor", 5: "field", 6: "variable", 7: "class", 8: "interface",
  9: "module", 10: "property", 11: "unit", 12: "value", 13: "enum", 14: "keyword", 15: "snippet", 16: "color", 17: "file",
  18: "reference", 19: "folder", 20: "enum-member", 21: "constant", 22: "struct", 23: "event", 24: "operator", 25: "type-parameter",
};

function cleanProjectId(value) {
  const id = String(value ?? "default").trim() || "default";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Project id must use lowercase kebab-case.");
  return id;
}

function safeConfiguredDir(root, value, fallback) {
  const configured = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const resolved = path.resolve(root, configured);
  if (resolved === root || !resolved.startsWith(root + path.sep)) throw new Error(`${fallback} directory must stay inside the repository.`);
  return resolved;
}

function cleanContent(value) {
  const content = String(value ?? "").replace(/\r\n/g, "\n");
  if (Buffer.byteLength(content, "utf8") > MAX_SOURCE_BYTES) throw new Error("Manuscript source file is too large for TexLab analysis.");
  return content;
}

function commandName(command) {
  return path.basename(String(command || "texlab"));
}

export function texlabCommand() {
  return process.env.OBSERVAIRE_TEXLAB_BIN?.trim() || "texlab";
}

export function texlabEnabled() {
  return process.env.RESEARCH_OBSERVER_TEXLAB !== "0";
}

function encodeMessage(payload) {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

export function parseLspFrames(buffer) {
  let rest = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? "");
  const messages = [];
  while (rest.length) {
    const boundary = rest.indexOf("\r\n\r\n");
    if (boundary < 0) break;
    const header = rest.subarray(0, boundary).toString("utf8");
    const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)/i);
    if (!match) throw new Error("TexLab returned an invalid LSP frame.");
    const length = Number.parseInt(match[1], 10);
    if (!Number.isFinite(length) || length < 0 || length > MAX_PROTOCOL_BYTES) throw new Error("TexLab returned an oversized LSP frame.");
    const start = boundary + 4;
    if (rest.length < start + length) break;
    const body = rest.subarray(start, start + length).toString("utf8");
    messages.push(JSON.parse(body));
    rest = rest.subarray(start + length);
  }
  return { messages, rest };
}

function lspPosition(position) {
  return {
    line: Math.max(0, Number(position?.line) || 0),
    character: Math.max(0, Number(position?.character ?? position?.column) || 0),
  };
}

function publicPosition(position) {
  return {
    line: Math.max(0, Number(position?.line) || 0) + 1,
    column: Math.max(0, Number(position?.character) || 0) + 1,
  };
}

function publicRange(range) {
  if (!range?.start || !range?.end) return undefined;
  return { start: publicPosition(range.start), end: publicPosition(range.end) };
}

function normalizeDiagnostics(items = []) {
  return items.slice(0, MAX_ITEMS).map((item) => ({
    severity: item?.severity === 1 ? "error" : item?.severity === 2 ? "warning" : item?.severity === 4 ? "hint" : "info",
    message: String(item?.message ?? "TexLab diagnostic"),
    source: typeof item?.source === "string" ? item.source : "texlab",
    code: item?.code === undefined || item?.code === null ? undefined : String(item.code),
    range: publicRange(item?.range),
  }));
}

function symbolRange(item) {
  return item?.selectionRange || item?.range || item?.location?.range;
}

function flattenSymbols(items = [], out = []) {
  for (const item of items) {
    if (out.length >= MAX_ITEMS) break;
    if (typeof item?.name !== "string") continue;
    out.push({
      name: item.name,
      detail: typeof item.detail === "string" ? item.detail : undefined,
      kind: SYMBOL_KINDS[item.kind] || `kind-${item.kind ?? "unknown"}`,
      range: publicRange(symbolRange(item)),
    });
    if (Array.isArray(item.children)) flattenSymbols(item.children, out);
  }
  return out;
}

function normalizeCompletions(result) {
  const items = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : [];
  return items.slice(0, MAX_ITEMS).flatMap((item) => {
    if (typeof item?.label !== "string" || !item.label) return [];
    const edit = item.textEdit;
    const range = edit?.range || edit?.replace || edit?.insert;
    const insertText = typeof edit?.newText === "string"
      ? edit.newText
      : typeof item.insertText === "string"
        ? item.insertText
        : item.label;
    return [{
      label: item.label,
      detail: typeof item.detail === "string" ? item.detail : undefined,
      kind: COMPLETION_KINDS[item.kind] || undefined,
      insertText,
      snippet: item.insertTextFormat === 2,
      range: publicRange(range),
    }];
  });
}

function spawnCapture(command, args, { cwd, timeoutMs = 4_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const cap = (value, chunk) => (value + chunk.toString("utf8")).slice(-24_000);
    child.stdout.on("data", (chunk) => { stdout = cap(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = cap(stderr, chunk); });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    child.once("error", (error) => finish({ code: 1, stdout, stderr, error }));
    child.once("close", (code) => finish({ code: typeof code === "number" ? code : 1, stdout, stderr }));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ code: 1, stdout, stderr, timedOut: true });
    }, timeoutMs);
  });
}

export async function texlabStatus({ command = texlabCommand() } = {}) {
  if (!texlabEnabled()) return { enabled: false, available: false, command: commandName(command), reason: "TexLab is disabled by RESEARCH_OBSERVER_TEXLAB=0." };
  const result = await spawnCapture(command, ["--version"]);
  const version = (result.stdout || result.stderr || "").split(/\r?\n/).find(Boolean)?.slice(0, 300) || "";
  return {
    enabled: true,
    available: result.code === 0,
    command: commandName(command),
    version,
    ...(result.error ? { reason: result.error.message } : result.timedOut ? { reason: "TexLab version check timed out." } : {}),
  };
}

export function runTexlabProtocol({ command = texlabCommand(), cwd, fileUri, content, position, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let buffer = Buffer.alloc(0);
    let stderr = "";
    let diagnostics = [];
    let symbols = [];
    let completions = [];
    let initialized = false;
    let symbolsDone = false;
    let completionDone = !position;
    let settled = false;
    let settleTimer;

    const cleanup = () => {
      clearTimeout(timeout);
      clearTimeout(settleTimer);
      if (!child.killed) child.kill("SIGTERM");
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const finishSoon = () => {
      if (!initialized || !symbolsDone || !completionDone || settled) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ diagnostics, symbols, completions });
      }, 180);
    };
    const send = (payload) => {
      if (!child.stdin.destroyed) child.stdin.write(encodeMessage(payload));
    };
    const startRequests = () => {
      send({ jsonrpc: "2.0", method: "initialized", params: {} });
      send({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: { textDocument: { uri: fileUri, languageId: "latex", version: 1, text: content } },
      });
      send({ jsonrpc: "2.0", id: 2, method: "textDocument/documentSymbol", params: { textDocument: { uri: fileUri } } });
      if (position) {
        send({
          jsonrpc: "2.0",
          id: 3,
          method: "textDocument/completion",
          params: { textDocument: { uri: fileUri }, position: lspPosition(position), context: { triggerKind: 1 } },
        });
      }
    };
    const onMessage = (message) => {
      if (message?.method === "textDocument/publishDiagnostics" && message?.params?.uri === fileUri) {
        diagnostics = normalizeDiagnostics(message.params.diagnostics);
        finishSoon();
        return;
      }
      if (message?.id === 1) {
        if (message.error) return fail(new Error(message.error.message || "TexLab initialization failed."));
        initialized = true;
        startRequests();
        return;
      }
      if (message?.id === 2) {
        if (message.error) return fail(new Error(message.error.message || "TexLab document symbols failed."));
        symbols = flattenSymbols(Array.isArray(message.result) ? message.result : []);
        symbolsDone = true;
        finishSoon();
        return;
      }
      if (message?.id === 3) {
        if (message.error) return fail(new Error(message.error.message || "TexLab completion failed."));
        completions = normalizeCompletions(message.result);
        completionDone = true;
        finishSoon();
      }
    };

    child.stdout.on("data", (chunk) => {
      try {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > MAX_PROTOCOL_BYTES * 2) throw new Error("TexLab protocol output exceeded the analysis limit.");
        const parsed = parseLspFrames(buffer);
        buffer = parsed.rest;
        for (const message of parsed.messages) onMessage(message);
      } catch (error) {
        fail(error);
      }
    });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString("utf8")).slice(-24_000); });
    child.once("error", (error) => fail(new Error(`Could not start TexLab: ${error.message}`)));
    child.once("close", (code) => {
      if (!settled) fail(new Error(`TexLab exited before analysis completed${stderr ? `: ${stderr.split(/\r?\n/).find(Boolean)}` : ` (code ${code ?? 1})`}.`));
    });

    const timeout = setTimeout(() => fail(new Error("TexLab analysis timed out.")), timeoutMs);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        processId: null,
        rootUri: pathToFileURL(cwd).href,
        capabilities: { textDocument: { documentSymbol: {}, completion: { completionItem: { snippetSupport: false } }, publishDiagnostics: {} } },
        clientInfo: { name: "observaire", version: "2.1.0" },
      },
    });
  });
}

async function resolveTarget(rootDir, projectId, file) {
  const root = path.resolve(rootDir);
  const id = cleanProjectId(projectId);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  if (!workspace.projects.some((project) => project.id === id)) throw new Error("Choose a research project that exists in this workspace.");
  const source = await readLatexSource({ rootDir: root, projectId: id, file });
  if (!source.file.toLowerCase().endsWith(".tex")) throw new Error("TexLab analysis requires a .tex source file.");
  const manuscriptsRoot = safeConfiguredDir(root, workspace.config.manuscriptsDir, "manuscripts");
  const projectRoot = path.join(manuscriptsRoot, id);
  const absolute = path.join(projectRoot, ...source.file.split("/"));
  return { projectId: id, file: source.file, projectRoot, fileUri: pathToFileURL(absolute).href };
}

export async function inspectLatexWithTexlab({
  rootDir = process.cwd(),
  projectId = "default",
  file,
  content,
  position,
  command = texlabCommand(),
} = {}) {
  if (!texlabEnabled()) throw new Error("TexLab language intelligence is disabled in this environment.");
  const target = await resolveTarget(rootDir, projectId, file);
  const source = cleanContent(content);
  const result = await runTexlabProtocol({ command, cwd: target.projectRoot, fileUri: target.fileUri, content: source, position });
  return { projectId: target.projectId, file: target.file, ...result };
}
