const SECTION_LEVELS = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
};

const WRAP_COMMANDS = new Set(["textbf", "textit", "emph", "texttt"]);
const ENVIRONMENTS = new Set(["equation", "equation*", "align", "align*", "itemize", "enumerate", "figure", "table", "quote", "center"]);

function clampOffset(content, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(content.length, Math.trunc(number)));
}

function stripLatexComment(line) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) return line.slice(0, index);
  }
  return line;
}

function offsetAtLine(lines, lineIndex) {
  let offset = 0;
  for (let index = 0; index < lineIndex; index += 1) offset += lines[index].length + 1;
  return offset;
}

function countBraces(line, state, diagnostics, lineNumber) {
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") state.push({ line: lineNumber, column: index + 1 });
    if (char === "}") {
      if (state.length) state.pop();
      else diagnostics.push({
        severity: "warning",
        code: "latex-unmatched-closing-brace",
        line: lineNumber,
        column: index + 1,
        message: "Closing brace has no matching opening brace.",
      });
    }
  }
}

export function analyzeLatexDocument(value) {
  const content = String(value ?? "").replace(/\r\n/g, "\n");
  const lines = content.split("\n");
  const outline = [];
  const labels = [];
  const diagnostics = [];
  const environments = [];
  const braces = [];
  let hasDocumentBegin = false;
  let hasDocumentEnd = false;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const source = stripLatexComment(lines[index]);
    if (!source.trim()) continue;

    countBraces(source, braces, diagnostics, lineNumber);

    const sectionPattern = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*{([^}]*)}/g;
    let sectionMatch;
    while ((sectionMatch = sectionPattern.exec(source))) {
      outline.push({
        kind: "section",
        level: SECTION_LEVELS[sectionMatch[1]],
        command: sectionMatch[1],
        title: sectionMatch[2].trim() || `Untitled ${sectionMatch[1]}`,
        line: lineNumber,
        column: sectionMatch.index + 1,
      });
    }

    const labelPattern = /\\label\s*{([^}]+)}/g;
    let labelMatch;
    while ((labelMatch = labelPattern.exec(source))) {
      const label = labelMatch[1].trim();
      labels.push({ label, line: lineNumber, column: labelMatch.index + 1 });
      outline.push({ kind: "label", level: 7, command: "label", title: label, line: lineNumber, column: labelMatch.index + 1 });
    }

    const envPattern = /\\(begin|end)\s*{([^}]+)}/g;
    let envMatch;
    while ((envMatch = envPattern.exec(source))) {
      const action = envMatch[1];
      const name = envMatch[2].trim();
      if (name === "document") {
        if (action === "begin") hasDocumentBegin = true;
        else hasDocumentEnd = true;
      }
      if (action === "begin") {
        environments.push({ name, line: lineNumber, column: envMatch.index + 1 });
      } else {
        const current = environments.at(-1);
        if (!current) {
          diagnostics.push({ severity: "error", code: "latex-unmatched-end", line: lineNumber, column: envMatch.index + 1, message: `\\end{${name}} has no matching \\begin.` });
        } else if (current.name !== name) {
          diagnostics.push({ severity: "error", code: "latex-environment-mismatch", line: lineNumber, column: envMatch.index + 1, message: `Expected \\end{${current.name}} before \\end{${name}}.` });
        } else {
          environments.pop();
        }
      }
    }
  }

  for (const environment of environments.slice().reverse()) {
    diagnostics.push({ severity: "error", code: "latex-unclosed-environment", line: environment.line, column: environment.column, message: `\\begin{${environment.name}} is not closed.` });
  }
  for (const brace of braces.slice(-20)) {
    diagnostics.push({ severity: "warning", code: "latex-unclosed-brace", line: brace.line, column: brace.column, message: "Opening brace is not closed." });
  }
  if (hasDocumentBegin && !hasDocumentEnd) {
    diagnostics.push({ severity: "error", code: "latex-missing-end-document", line: lines.length, column: 1, message: "Document starts but has no \\end{document}." });
  }
  if (!hasDocumentBegin && /\\documentclass\b/.test(content)) {
    diagnostics.push({ severity: "warning", code: "latex-missing-document-body", line: 1, column: 1, message: "Document class found without \\begin{document}." });
  }

  const duplicateLabels = new Map();
  for (const item of labels) {
    const existing = duplicateLabels.get(item.label);
    if (existing) {
      diagnostics.push({ severity: "warning", code: "latex-duplicate-label", line: item.line, column: item.column, message: `Duplicate label '${item.label}' (first declared on line ${existing.line}).` });
    } else duplicateLabels.set(item.label, item);
  }

  return {
    lines: lines.length,
    outline,
    labels,
    diagnostics: diagnostics.sort((a, b) => a.line - b.line || a.column - b.column),
  };
}

export function toggleLatexLineComments(value, selectionStart, selectionEnd) {
  const content = String(value ?? "");
  const start = clampOffset(content, selectionStart);
  const end = clampOffset(content, selectionEnd);
  const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = content.indexOf("\n", end);
  const lineEnd = nextBreak < 0 ? content.length : nextBreak;
  const selected = content.slice(lineStart, lineEnd);
  const lines = selected.split("\n");
  const uncomment = lines.every((line) => !line.trim() || /^\s*%/.test(line));
  const transformed = lines.map((line) => {
    if (!line.trim()) return line;
    if (uncomment) return line.replace(/^(\s*)%\s?/, "$1");
    return line.replace(/^(\s*)/, "$1% ");
  }).join("\n");
  const next = `${content.slice(0, lineStart)}${transformed}${content.slice(lineEnd)}`;
  return { content: next, selectionStart: lineStart, selectionEnd: lineStart + transformed.length };
}

export function wrapLatexSelection(value, selectionStart, selectionEnd, command) {
  const content = String(value ?? "");
  if (!WRAP_COMMANDS.has(command)) throw new Error("Unsupported LaTeX wrapping command.");
  const start = clampOffset(content, selectionStart);
  const end = clampOffset(content, selectionEnd);
  const selected = content.slice(start, end);
  const prefix = `\\${command}{`;
  const replacement = `${prefix}${selected}}`;
  return {
    content: `${content.slice(0, start)}${replacement}${content.slice(end)}`,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + selected.length,
  };
}

export function insertLatexEnvironment(value, selectionStart, selectionEnd, environment) {
  const content = String(value ?? "");
  if (!ENVIRONMENTS.has(environment)) throw new Error("Unsupported LaTeX environment.");
  const start = clampOffset(content, selectionStart);
  const end = clampOffset(content, selectionEnd);
  const selected = content.slice(start, end);
  const body = selected || (environment === "itemize" || environment === "enumerate" ? "\\item " : "");
  const replacement = `\\begin{${environment}}\n${body}\n\\end{${environment}}`;
  const bodyStart = start + `\\begin{${environment}}\n`.length;
  return {
    content: `${content.slice(0, start)}${replacement}${content.slice(end)}`,
    selectionStart: bodyStart,
    selectionEnd: bodyStart + body.length,
  };
}

export function insertLatexSection(value, selectionStart, selectionEnd, command = "section") {
  if (!Object.hasOwn(SECTION_LEVELS, command)) throw new Error("Unsupported section command.");
  const content = String(value ?? "");
  const start = clampOffset(content, selectionStart);
  const end = clampOffset(content, selectionEnd);
  const selected = content.slice(start, end) || "Title";
  const replacement = `\\${command}{${selected}}`;
  const innerStart = start + command.length + 2;
  return {
    content: `${content.slice(0, start)}${replacement}${content.slice(end)}`,
    selectionStart: innerStart,
    selectionEnd: innerStart + selected.length,
  };
}

export function latexEditorCommands() {
  return [
    { id: "toggle-comment", label: "Toggle line comment", group: "Edit", shortcut: "Ctrl/⌘ + /" },
    { id: "bold", label: "Bold selection", group: "Format" },
    { id: "italic", label: "Italic selection", group: "Format" },
    { id: "emphasis", label: "Emphasize selection", group: "Format" },
    { id: "section", label: "Insert section", group: "Structure" },
    { id: "subsection", label: "Insert subsection", group: "Structure" },
    { id: "equation", label: "Insert equation", group: "Environment" },
    { id: "align", label: "Insert align", group: "Environment" },
    { id: "itemize", label: "Insert itemize", group: "Environment" },
    { id: "enumerate", label: "Insert enumerate", group: "Environment" },
    { id: "figure", label: "Insert figure", group: "Environment" },
    { id: "table", label: "Insert table", group: "Environment" },
  ];
}
