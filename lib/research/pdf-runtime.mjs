import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function preparePdfRuntime(rootDir = process.cwd()) {
  const packagePath = require.resolve("pdfjs-dist/package.json", { paths: [rootDir] });
  const packageDir = path.dirname(packagePath);
  const destination = path.join(rootDir, "public", "_research", "pdfjs");
  await fs.mkdir(destination, { recursive: true });

  const copies = [
    [path.join(packageDir, "build", "pdf.worker.min.mjs"), path.join(destination, "pdf.worker.min.mjs")],
    [path.join(packageDir, "cmaps"), path.join(destination, "cmaps")],
    [path.join(packageDir, "standard_fonts"), path.join(destination, "standard_fonts")],
    [path.join(packageDir, "wasm"), path.join(destination, "wasm")],
  ];

  for (const [source, target] of copies) {
    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(source, target, { recursive: true });
  }

  return destination;
}
