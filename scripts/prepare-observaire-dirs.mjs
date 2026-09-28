import fs from "node:fs/promises";
import path from "node:path";

function hostPath(value, fallback) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (raw.includes("\0")) throw new Error("Observaire storage path contains an invalid null byte.");
  return path.resolve(process.cwd(), raw);
}

const directories = [
  ["research", hostPath(process.env.OBSERVAIRE_RESEARCH_DIR, "./progress")],
  ["annotations", hostPath(process.env.OBSERVAIRE_ANNOTATIONS_DIR, "./annotations")],
  ["manuscripts", hostPath(process.env.OBSERVAIRE_MANUSCRIPTS_DIR, "./manuscripts")],
];

for (const [label, directory] of directories) {
  await fs.mkdir(directory, { recursive: true, mode: 0o775 });
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error(`${label} storage path is not a directory: ${directory}`);
  console.log(`[observaire] ${label}: ${directory}`);
}
