import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  compileLatexProject,
  createLatexSource,
  forwardSyncLatex,
  latexToolchainStatus,
  reverseSyncLatex,
} from "../lib/research/latex-ide.mjs";

function fail(message) {
  throw new Error(message);
}

async function requireFile(file, label) {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) fail(`${label} was not generated: ${file}`);
}

async function compileOrFail(root, mainFile, engine) {
  const build = await compileLatexProject({ rootDir: root, projectId: "default", mainFile, engine });
  if (!build.success) {
    fail(`${engine} failed for ${mainFile}:\n${build.log.slice(-8000)}`);
  }
  return build;
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-latex-verify-"));
  const previousLatex = process.env.RESEARCH_OBSERVER_LATEX;
  process.env.RESEARCH_OBSERVER_LATEX = "1";

  try {
    await fs.mkdir(path.join(root, "progress"), { recursive: true });
    await fs.writeFile(
      path.join(root, "research-observer.config.json"),
      JSON.stringify({ manuscriptsDir: "manuscripts" }),
      "utf8",
    );

    const toolchain = await latexToolchainStatus();
    if (!toolchain.latexmk.available) fail("latexmk is unavailable. Run this command inside the project Docker image or install latexmk.");
    if (!toolchain.synctex.available) fail("SyncTeX is unavailable.");

    const basic = `\\documentclass{article}
\\usepackage[T1]{fontenc}
\\begin{document}
\\section{Smoke test}
Observaire LaTeX verification.\\label{sec:smoke}
See Section~\\ref{sec:smoke}.
\\end{document}
`;
    await createLatexSource({ rootDir: root, projectId: "default", file: "main.tex", content: basic });

    const engineBuilds = {};
    for (const engine of ["pdflatex", "xelatex", "lualatex"]) {
      const build = await compileOrFail(root, "main.tex", engine);
      engineBuilds[engine] = { id: build.id, durationMs: build.durationMs, diagnostics: build.diagnostics.length };
    }

    const pdfBuild = await compileOrFail(root, "main.tex", "pdflatex");
    const forward = await forwardSyncLatex({
      rootDir: root,
      projectId: "default",
      buildId: pdfBuild.id,
      file: "main.tex",
      line: 5,
      column: 0,
    });
    const reverse = await reverseSyncLatex({
      rootDir: root,
      projectId: "default",
      buildId: pdfBuild.id,
      page: forward.page,
      x: forward.x,
      y: forward.y,
    });
    if (reverse.file !== "main.tex" || reverse.line < 1) {
      fail(`SyncTeX reverse mapping returned an unexpected source: ${JSON.stringify(reverse)}`);
    }

    await createLatexSource({
      rootDir: root,
      projectId: "default",
      file: "references.bib",
      content: `@misc{observaire2026,
  author = {Observaire Test},
  title = {Toolchain verification fixture},
  year = {2026}
}
`,
    });
    await createLatexSource({
      rootDir: root,
      projectId: "default",
      file: "classic.tex",
      content: `\\documentclass{article}
\\begin{document}
Classic BibTeX citation~\\cite{observaire2026}.
\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}
`,
    });
    const classic = await compileOrFail(root, "classic.tex", "pdflatex");
    await requireFile(
      path.join(root, ".research-observer", "latex-builds", "default", classic.id, "classic.bbl"),
      "Classic BibTeX bibliography",
    );

    await createLatexSource({
      rootDir: root,
      projectId: "default",
      file: "biblatex.tex",
      content: `\\documentclass{article}
\\usepackage[backend=biber]{biblatex}
\\addbibresource{references.bib}
\\begin{document}
Biber citation~\\cite{observaire2026}.
\\printbibliography
\\end{document}
`,
    });
    const biblatex = await compileOrFail(root, "biblatex.tex", "pdflatex");
    await requireFile(
      path.join(root, ".research-observer", "latex-builds", "default", biblatex.id, "biblatex.bbl"),
      "biblatex/Biber bibliography",
    );

    const summary = {
      ok: true,
      latexmk: toolchain.latexmk.version,
      synctex: toolchain.synctex.version,
      engines: engineBuilds,
      classicBibtex: { id: classic.id, diagnostics: classic.diagnostics.length },
      biber: { id: biblatex.id, diagnostics: biblatex.diagnostics.length },
      synctexRoundTrip: {
        forward: { page: forward.page, x: forward.x, y: forward.y },
        reverse: { file: reverse.file, line: reverse.line, column: reverse.column },
      },
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    process.env.RESEARCH_OBSERVER_LATEX = previousLatex;
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
