# LaTeX toolchain verification

Observaire has two complementary LaTeX verification commands. They intentionally prove different things.

## 1. Application-service verification

```bash
npm run verify:latex
```

This executes the real Node service used by the IDE (`compileLatexProject`, forward SyncTeX, reverse SyncTeX) in an isolated temporary Observaire workspace.

It requires the current environment to provide:

- `latexmk`
- pdfLaTeX
- XeLaTeX
- LuaLaTeX
- BibTeX
- Biber
- SyncTeX

This is the stronger integration check because it exercises the same service layer used by `/api/ide/compile` and `/api/ide/synctex`.

If `latexmk` is not installed on the host, this command should fail clearly rather than silently skipping compilation.

## 2. Prebuilt-container toolchain verification

```bash
npm run verify:latex:container
```

This is a verification-only fallback for environments where the Observaire Docker image cannot be built reliably (for example, a temporary Debian mirror/index failure).

It runs a standalone Bash smoke test in a digest-pinned TeX Live container and does **not** build or execute the Observaire runtime image.

The repository is mounted read-only. Test documents and all generated files live in a temporary directory inside the container and are removed afterward.

The verifier checks:

- `latexmk` availability;
- pdfLaTeX compilation;
- XeLaTeX compilation;
- LuaLaTeX compilation;
- `-synctex=1` output;
- unrestricted shell escape remains disabled;
- classic BibTeX creates a rendered `.bbl`;
- biblatex/Biber creates a rendered `.bbl`;
- SyncTeX forward lookup returns page/x/y;
- SyncTeX reverse lookup returns the original source file and a positive line number.

Passing this command validates the external TeX toolchain contract. It does **not** replace `npm run verify:latex`, because the standalone container does not exercise the Observaire Node compile service.

## Reproducibility and platform

The default verification container is pinned by image digest rather than only by a mutable tag.

The currently configured fallback targets `linux/amd64`. This is deliberate because the selected prebuilt TeX Live verification image publishes an amd64 runtime. Docker Desktop can run it under emulation on Apple Silicon.

Advanced verification environments may override the defaults deliberately:

```bash
OBSERVAIRE_LATEX_VERIFY_IMAGE=<trusted-image> \
OBSERVAIRE_LATEX_VERIFY_PLATFORM=<platform> \
npm run verify:latex:container
```

Do not replace the repository default with an unpinned `latest` image.

## Merge/release interpretation

A strong verification state is:

```text
npm run check:full             PASS
npm run verify:latex           PASS
npm run verify:latex:container PASS
browser IDE compile            PASS
forward/reverse SyncTeX        PASS
Compose recreation             PASS
```

If only the container verifier passes, record that the external TeX Live stack is verified but application-service and browser/container integration remain outstanding.

If the main Observaire image build fails for infrastructure reasons while the pinned toolchain verifier passes, do not misreport the branch as fully merge-ready; retain the runtime-image/persistence check as an explicit gap.
