import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { progressDir } from "@/lib/progress";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".bmp": "image/bmp",
  ".pdf": "application/pdf", ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg",
  ".ogg": "video/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
  ".aac": "audio/aac", ".flac": "audio/flac",
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const root = path.resolve(progressDir());
  const requested = path.resolve(root, ...parts);
  if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
    return new NextResponse("Invalid media path", { status: 400 });
  }

  try {
    const bytes = await fs.readFile(requested);
    const type = TYPES[path.extname(requested).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Media not found", { status: 404 });
  }
}
