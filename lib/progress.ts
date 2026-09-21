import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const PROGRESS_DIR = path.join(process.cwd(), "progress");
const FILE_PATTERN = /^(\d+)_.*\.md$/i;

export type ProgressEntry = {
  filename: string;
  slug: string;
  order: number;
  title: string;
  summary: string;
  status?: string;
  date?: string;
  tags: string[];
  content: string;
  words: number;
  readingMinutes: number;
  linkedSlugs: string[];
};

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.md$/i, "")
    .replace(/^\d+_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function firstHeading(content: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveSummary(content: string) {
  const plain = stripMarkdown(content);
  return plain.length > 180 ? `${plain.slice(0, 177)}…` : plain;
}

function referencedMarkdownSlugs(content: string) {
  return [...content.matchAll(/\[[^\]]*\]\((?:\.\/|\.\.\/)?([^)#]+\.md)(?:#[^)]+)?\)/gi)]
    .map((match) => path.basename(match[1], ".md"));
}

export async function getProgressEntries(): Promise<ProgressEntry[]> {
  let filenames: string[] = [];
  try {
    filenames = await fs.readdir(PROGRESS_DIR);
  } catch {
    return [];
  }

  const ordered = filenames
    .filter((name) => FILE_PATTERN.test(name))
    .sort((a, b) => {
      const ao = Number(a.match(FILE_PATTERN)?.[1] ?? 0);
      const bo = Number(b.match(FILE_PATTERN)?.[1] ?? 0);
      return ao - bo || a.localeCompare(b);
    });

  return Promise.all(
    ordered.map(async (filename) => {
      const raw = await fs.readFile(path.join(PROGRESS_DIR, filename), "utf8");
      const { data, content } = matter(raw);
      const words = stripMarkdown(content).split(/\s+/).filter(Boolean).length;
      const summary = typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim()
        : deriveSummary(content);

      return {
        filename,
        slug: filename.replace(/\.md$/i, ""),
        order: Number(filename.match(FILE_PATTERN)?.[1] ?? 0),
        title: typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : firstHeading(content) ?? titleFromFilename(filename),
        summary,
        status: typeof data.status === "string" ? data.status : undefined,
        date: data.date instanceof Date
          ? data.date.toISOString().slice(0, 10)
          : typeof data.date === "string"
            ? data.date
            : undefined,
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        content,
        words,
        readingMinutes: Math.max(1, Math.ceil(words / 220)),
        linkedSlugs: referencedMarkdownSlugs(content),
      } satisfies ProgressEntry;
    }),
  );
}

export async function getProgressEntry(slug: string) {
  const entries = await getProgressEntries();
  return entries.find((entry) => entry.slug === slug) ?? null;
}

export function progressDir() {
  return PROGRESS_DIR;
}
