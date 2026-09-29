import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
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

async function requireResolvedCitation(build, root, name, label) {
  const buildDir = path.join(root, ".research-observer", "latex-builds", "default", build.id);
  await requireFile(path.join(buildDir, `${name}.pdf`), `${label} PDF`);
  const bblPath = path.join(buildDir, `${name}.bbl`);
  await requireFile(bblPath, `${label} bibliography`);
  const bbl = await fs.readFile(bblPath, "utf8");
  if (!bbl.trim() || !/Toolchain verification fixture/.test(bbl)) fail(`${label} bibliography does not contain the fixture record.`);
  const finalLog = await fs.readFile(path.join(buildDir, `${name}.log`), "utf8");
  if (/Citation [`'][^`']+[`'].*undefined|Reference [`'][^`']+[`'].*undefined|There were undefined references|Please \(re\)run (?:BibTeX|Biber)/i.test(finalLog)) {
    fail(`${label} compile left unresolved citation or reference diagnostics.\n${finalLog.slice(-4000)}`);
  }
  const text = await new Promise((resolve, reject) => {
    const child = spawn("gs", ["-q", "-dBATCH", "-dNOPAUSE", "-sDEVICE=txtwrite", "-o", "-", path.join(buildDir, `${name}.pdf`)], { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => code === 0
      ? resolve(Buffer.concat(stdout).toString("utf8"))
      : reject(new Error(Buffer.concat(stderr).toString("utf8") || `Ghostscript exited ${code}`)));
  });
  if (!/Observaire\s+Test/.test(text)) fail(`${label} PDF does not visibly render its cited bibliography author.`);
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
    await requireResolvedCitation(classic, root, "classic", "Classic BibTeX");

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
    await requireResolvedCitation(biblatex, root, "biblatex", "biblatex/Biber");

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
