import { NextResponse } from "next/server";
import { getProgressEntries } from "@/lib/progress";

export const runtime = "nodejs";

function plainText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~|`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptAround(text: string, query: string) {
  const lower = text.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, 140) + (text.length > 140 ? "…" : "");
  const start = Math.max(0, index - 55);
  const end = Math.min(text.length, index + query.length + 85);
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ results: [] });

  const needle = query.toLowerCase();
  const entries = await getProgressEntries();

  const results = entries
    .map((entry) => {
      const title = entry.title.toLowerCase();
      const summary = entry.summary.toLowerCase();
      const status = (entry.status ?? "").toLowerCase();
      const tags = entry.tags.join(" ").toLowerCase();
      const body = plainText(entry.content);
      const bodyLower = body.toLowerCase();

      let score = 0;
      let matchedBy = "content";
      if (title === needle) { score += 120; matchedBy = "title"; }
      else if (title.startsWith(needle)) { score += 90; matchedBy = "title"; }
      else if (title.includes(needle)) { score += 70; matchedBy = "title"; }
      if (tags.includes(needle)) { score += 45; if (matchedBy === "content") matchedBy = "tag"; }
      if (status.includes(needle)) { score += 35; if (matchedBy === "content") matchedBy = "status"; }
      if (summary.includes(needle)) { score += 30; if (matchedBy === "content") matchedBy = "summary"; }
      if (bodyLower.includes(needle)) score += 15;
      if (!score) return null;

      const source = matchedBy === "summary" ? entry.summary : body;
      return {
        slug: entry.slug,
        order: entry.order,
        title: entry.title,
        status: entry.status,
        excerpt: excerptAround(source, query),
        matchedBy,
        score,
      };
    })
    .filter((result): result is NonNullable<typeof result> => Boolean(result))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 12)
    .map(({ score: _score, ...result }) => result);

  return NextResponse.json({ results });
}
