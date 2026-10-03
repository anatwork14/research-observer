import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseLspFrames, runTexlabProtocol, texlabStatus } from "../lib/research/texlab.mjs";

function frame(payload) {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

test("parseLspFrames keeps partial frames buffered", () => {
  const first = frame({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  const second = frame({ jsonrpc: "2.0", method: "window/logMessage", params: { message: "hello" } });
  const joined = Buffer.from(first + second, "utf8");
  const split = joined.length - 7;
  const partial = parseLspFrames(joined.subarray(0, split));
  assert.equal(partial.messages.length, 1);
  assert.ok(partial.rest.length > 0);
  const completed = parseLspFrames(Buffer.concat([partial.rest, joined.subarray(split)]));
  assert.equal(completed.messages.length, 1);
  assert.equal(completed.messages[0].method, "window/logMessage");
});

test("TexLab protocol normalizes diagnostics, symbols, completions, and server requests", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-texlab-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fake = path.join(root, "fake-texlab.mjs");
  await fs.writeFile(fake, `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.stdout.write("texlab 99.0.0\\n");
  process.exit(0);
}
let buffer = Buffer.alloc(0);
let openUri = "";
function send(payload) {
  const body = JSON.stringify(payload);
  process.stdout.write("Content-Length: " + Buffer.byteLength(body, "utf8") + "\\r\\n\\r\\n" + body);
}
function parse() {
  while (buffer.length) {
    const boundary = buffer.indexOf("\\r\\n\\r\\n");
    if (boundary < 0) return;
    const header = buffer.subarray(0, boundary).toString("utf8");
    const match = header.match(/Content-Length:\\s*(\\d+)/i);
    if (!match) process.exit(2);
    const length = Number(match[1]);
    const start = boundary + 4;
    if (buffer.length < start + length) return;
    const message = JSON.parse(buffer.subarray(start, start + length).toString("utf8"));
    buffer = buffer.subarray(start + length);
    if (message.id === 1 && message.method === "initialize") {
      send({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } });
      send({ jsonrpc: "2.0", id: 77, method: "workspace/configuration", params: { items: [{ section: "texlab" }] } });
    } else if (message.method === "textDocument/didOpen") {
      openUri = message.params.textDocument.uri;
    } else if (message.id === 77 && Array.isArray(message.result)) {
      send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: {
        uri: openUri,
        diagnostics: [{ severity: 2, message: "Fake warning", source: "texlab", code: "fake", range: { start: { line: 1, character: 2 }, end: { line: 1, character: 5 } } }],
      } });
    } else if (message.id === 2) {
      send({ jsonrpc: "2.0", id: 2, result: [{ name: "Introduction", kind: 13, selectionRange: { start: { line: 3, character: 0 }, end: { line: 3, character: 8 } }, children: [{ name: "child", kind: 13, selectionRange: { start: { line: 4, character: 1 }, end: { line: 4, character: 3 } } }] }] });
    } else if (message.id === 3) {
      send({ jsonrpc: "2.0", id: 3, result: { items: [{ label: "\\\\section", kind: 14, detail: "section command", insertText: "\\\\section{}", insertTextFormat: 1, textEdit: { newText: "\\\\section{}", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } } } }] } });
    }
  }
}
process.stdin.on("data", (chunk) => { buffer = Buffer.concat([buffer, chunk]); parse(); });
`, "utf8");
  await fs.chmod(fake, 0o755);

  const status = await texlabStatus({ command: fake });
  assert.equal(status.available, true);
  assert.match(status.version, /99\.0\.0/);

  const fileUri = pathToFileURL(path.join(root, "main.tex")).href;
  const result = await runTexlabProtocol({
    command: fake,
    cwd: root,
    fileUri,
    content: "\\documentclass{article}\n\\begin{document}\nHello\n\\section{Introduction}\n\\end{document}\n",
    position: { line: 0, column: 2 },
    timeoutMs: 2_000,
  });

  assert.deepEqual(result.diagnostics, [{
    severity: "warning",
    message: "Fake warning",
    source: "texlab",
    code: "fake",
    range: { start: { line: 2, column: 3 }, end: { line: 2, column: 6 } },
  }]);
  assert.equal(result.symbols.length, 2);
  assert.deepEqual(result.symbols.map((item) => item.name), ["Introduction", "child"]);
  assert.equal(result.symbols[0].range.start.line, 4);
  assert.equal(result.completions.length, 1);
  assert.equal(result.completions[0].label, "\\section");
  assert.equal(result.completions[0].insertText, "\\section{}");
  assert.equal(result.completions[0].snippet, false);
  assert.deepEqual(result.completions[0].range, { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } });
});

test("TexLab status degrades cleanly when the binary is unavailable", async () => {
  const status = await texlabStatus({ command: path.join(os.tmpdir(), "definitely-not-observaire-texlab") });
  assert.equal(status.available, false);
  assert.equal(status.enabled, true);
});
