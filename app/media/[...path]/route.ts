import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { progressDir } from "@/lib/progress";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".ogg": "video/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

type ByteRange = { start: number; end: number };

function inside(root: string, candidate: string) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function parseRange(value: string | null, size: number): ByteRange | "invalid" | null {
  if (!value) return null;
  if (value.includes(",")) return "invalid";

  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";

  let start: number;
  let end: number;

  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) {
    return "invalid";
  }

  return { start, end };
}

async function resolveMedia(parts: string[]) {
  const lexicalRoot = path.resolve(progressDir());
  const lexicalRequested = path.resolve(lexicalRoot, ...parts);

  if (!inside(lexicalRoot, lexicalRequested)) {
    return { error: new NextResponse("Invalid media path", { status: 400 }) } as const;
  }

  try {
    const [realRoot, realRequested] = await Promise.all([
      fs.realpath(lexicalRoot),
      fs.realpath(lexicalRequested),
    ]);

    if (!inside(realRoot, realRequested)) {
      return { error: new NextResponse("Invalid media path", { status: 400 }) } as const;
    }

    const stat = await fs.stat(realRequested);
    if (!stat.isFile()) {
      return { error: new NextResponse("Media not found", { status: 404 }) } as const;
    }

    const extension = path.extname(realRequested).toLowerCase();
    const contentType = TYPES[extension];
    if (!contentType) {
      return { error: new NextResponse("Unsupported media type", { status: 415 }) } as const;
    }

    return { path: realRequested, stat, contentType } as const;
  } catch {
    return { error: new NextResponse("Media not found", { status: 404 }) } as const;
  }
}

async function respond(request: Request, context: { params: Promise<{ path: string[] }> }, headOnly: boolean) {
  const { path: parts } = await context.params;
  const resolved = await resolveMedia(parts);
  if ("error" in resolved) return resolved.error;

  const size = resolved.stat.size;
  const etag = '"research-' + size.toString(16) + "-" + Math.trunc(resolved.stat.mtimeMs).toString(16) + '"';
  const lastModified = resolved.stat.mtime.toUTCString();

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Last-Modified": lastModified,
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  }

  const requestedRange = parseRange(request.headers.get("range"), size);
  if (requestedRange === "invalid") {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": "bytes */" + size, "Accept-Ranges": "bytes" },
    });
  }

  const range = requestedRange ?? { start: 0, end: Math.max(0, size - 1) };
  const partial = requestedRange !== null;
  const length = size === 0 ? 0 : range.end - range.start + 1;

  const headers: Record<string, string> = {
    "Content-Type": resolved.contentType,
    "Content-Length": String(length),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600, must-revalidate",
    ETag: etag,
    "Last-Modified": lastModified,
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
  };

  if (partial) {
    headers["Content-Range"] = "bytes " + range.start + "-" + range.end + "/" + size;
  }

  if (headOnly || size === 0) {
    return new NextResponse(null, { status: partial ? 206 : 200, headers });
  }

  const nodeStream = createReadStream(resolved.path, { start: range.start, end: range.end });
  const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new NextResponse(body, { status: partial ? 206 : 200, headers });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return respond(request, context, false);
}

export async function HEAD(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return respond(request, context, true);
}
