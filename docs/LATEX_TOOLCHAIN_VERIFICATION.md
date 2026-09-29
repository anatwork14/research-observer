# LaTeX toolchain verification

Observaire has three complementary LaTeX verification layers. They intentionally prove different things.

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

This is the core service check because it exercises the same service layer used by `/api/ide/compile` and `/api/ide/synctex`.

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

Passing this command validates the external TeX toolchain contract. It does **not** replace the Observaire project-image check because the standalone container does not execute Observaire's Node compile service from the shipped image.

## 3. Observaire project-image verification

Build the system/TeX layer only:

```bash
npm run verify:latex:project-toolchain
```

This targets the repository Dockerfile's `latex-toolchain` stage. Debian APT retries/timeouts and cache mounts isolate the heavyweight TeX install from npm/application layers and make infrastructure failures easier to localize.

Then run the full app-image service check:

```bash
npm run verify:latex:project-app
```

The command builds the Dockerfile `app` target and runs `scripts/verify-latex-toolchain.mjs` directly with Node inside the resulting image. It deliberately does not use Compose.

The runtime container is hardened for verification:

- no user research/annotation/manuscript bind mounts;
- no external Observaire state volume;
- read-only root filesystem;
- isolated writable `/tmp` tmpfs only;
- network disabled;
- all Linux capabilities dropped;
- `no-new-privileges` enabled.

That makes `verify:latex:project-app` the authoritative shipped-image service check: it proves the image contains the toolchain and that Observaire's actual compile/SyncTeX service works without touching user data.

## Reproducibility and platform

The default prebuilt verification container is pinned by image digest rather than only by a mutable tag.

The currently configured fallback targets `linux/amd64`. This is deliberate because the selected prebuilt TeX Live verification image publishes an amd64 runtime. Docker Desktop can run it under emulation on Apple Silicon.

Advanced verification environments may override the fallback defaults deliberately:

```bash
OBSERVAIRE_LATEX_VERIFY_IMAGE=<trusted-image> \
OBSERVAIRE_LATEX_VERIFY_PLATFORM=<platform> \
npm run verify:latex:container
```

The project-app verifier may also target an explicit platform/image name when needed:

```bash
OBSERVAIRE_LATEX_PROJECT_PLATFORM=<platform> \
OBSERVAIRE_LATEX_PROJECT_IMAGE=<local-image-name> \
npm run verify:latex:project-app
```

Do not replace the repository default fallback with an unpinned `latest` image.

## Merge/release interpretation

A strong verification state is:

```text
npm run check:full                    PASS
npm run verify:latex:container        PASS
npm run verify:latex:project-toolchain PASS
npm run verify:latex:project-app      PASS
browser IDE compile                   PASS
forward/reverse SyncTeX               PASS
Compose recreation                    PASS
```

If only the prebuilt-container verifier passes, record that the external TeX Live stack is verified but the Observaire image/service integration remains outstanding.

If `verify:latex:project-toolchain` passes but `verify:latex:project-app` fails, the system packages are available and the defect is in the app image or Node service integration rather than raw TeX installation.

If the main Observaire image build fails for infrastructure reasons while the pinned toolchain verifier passes, do not misreport the branch as fully merge-ready; retain the runtime-image/persistence check as an explicit gap.
