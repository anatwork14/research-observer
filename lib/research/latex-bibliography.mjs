import path from "node:path";

function cleanBibFile(value) {
  const raw = String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!raw || path.posix.isAbsolute(raw)) throw new Error("Choose a project-relative .bib file.");
  const normalized = path.posix.normalize(raw);
  if (normalized === ".." || normalized.startsWith("../") || !normalized.toLowerCase().endsWith(".bib")) {
    throw new Error("Choose a project-relative .bib file.");
  }
  return normalized;
}

function applyInsertions(content, edits) {
  return [...edits]
    .sort((a, b) => b.index - a.index)
    .reduce((next, edit) => `${next.slice(0, edit.index)}${edit.text}${next.slice(edit.index)}`, content);
}

export function mapLatexOffsetThroughInsertions(offset, edits) {
  const safe = Math.max(0, Number.isFinite(Number(offset)) ? Number(offset) : 0);
  return safe + edits.reduce((delta, edit) => delta + (edit.index <= safe ? edit.text.length : 0), 0);
}

export function configureLatexBibliographySource(content, bibFile) {
  const source = String(content ?? "").replace(/\r\n/g, "\n");
  const file = cleanBibFile(bibFile);
  const beginMatch = /\\begin\s*{document}/i.exec(source);
  const endMatch = /\\end\s*{document}/i.exec(source);
  if (!beginMatch || !endMatch || endMatch.index <= beginMatch.index) {
    throw new Error("The active TeX source needs a normal document environment before bibliography setup can be inserted.");
  }

  const usesBiblatex = /\\usepackage(?:\s*\[[^\]]*\])?\s*{[^}]*\bbiblatex\b[^}]*}/i.test(source)
    || /\\addbibresource\s*{/i.test(source);
  const edits = [];

  if (usesBiblatex) {
    const escapedFile = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasResource = new RegExp(`\\\\addbibresource\\s*{\\s*${escapedFile}\\s*}`, "i").test(source);
    if (!hasResource) edits.push({ index: beginMatch.index, text: `\\addbibresource{${file}}\n` });
    if (!/\\printbibliography\b/i.test(source)) edits.push({ index: endMatch.index, text: "\n\\printbibliography\n" });
    return {
      content: applyInsertions(source, edits),
      changed: edits.length > 0,
      mode: "biblatex",
      bibFile: file,
      edits,
      message: edits.length ? `Configured biblatex to use ${file}.` : `${file} is already configured with biblatex.`,
    };
  }

  const existingBibliography = /\\bibliography\s*{([^}]*)}/i.exec(source);
  const library = file.replace(/\.bib$/i, "");
  if (existingBibliography) {
    const libraries = existingBibliography[1].split(",").map((item) => item.trim()).filter(Boolean);
    const alreadySelected = libraries.includes(library) || libraries.includes(file);
    return {
      content: source,
      changed: false,
      mode: "bibtex-existing",
      bibFile: file,
      edits,
      message: alreadySelected
        ? `${file} is already referenced by the existing BibTeX bibliography.`
        : `This document already references ${libraries.join(", ") || "another BibTeX library"}. Edit that bibliography command explicitly before switching libraries.`,
    };
  }

  const hasStyle = /\\bibliographystyle\s*{[^}]+}/i.test(source);
  const block = hasStyle
    ? `\n\\bibliography{${library}}\n`
    : `\n\\bibliographystyle{plain}\n\\bibliography{${library}}\n`;
  edits.push({ index: endMatch.index, text: block });
  return {
    content: applyInsertions(source, edits),
    changed: true,
    mode: "bibtex",
    bibFile: file,
    edits,
    message: hasStyle
      ? `Connected ${file} to the existing BibTeX style.`
      : `Added a basic BibTeX bibliography using ${file} and the plain style.`,
  };
}
