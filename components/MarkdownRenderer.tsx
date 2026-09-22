import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const imageTypes = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp"]);
const videoTypes = new Set(["mp4", "webm", "ogv", "ogg"]);
const audioTypes = new Set(["mp3", "wav", "m4a", "aac", "flac"]);

function extension(src: string) {
  return src.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
}

function isDirectUrl(src: string) {
  return /^(https?:|data:|blob:|mailto:|tel:)/i.test(src) || src.startsWith("/") || src.startsWith("#");
}

function mediaUrl(src: string) {
  if (!src || isDirectUrl(src)) return src;

  const suffixIndex = src.search(/[?#]/);
  const pathname = suffixIndex >= 0 ? src.slice(0, suffixIndex) : src;
  const suffix = suffixIndex >= 0 ? src.slice(suffixIndex) : "";
  const cleaned = pathname.replace(/^\.\//, "").replace(/^(\.\.\/)+/, "");
  const encoded = cleaned.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/_research/media/${encoded}${suffix}`;
}

function Media({ src, alt }: { src: string; alt?: string }) {
  const ext = extension(src);
  const resolved = mediaUrl(src);
  const caption = alt?.trim();

  if (imageTypes.has(ext)) {
    return (
      <figure className="research-media">
        {/* eslint-disable-next-line @next/next/no-img-element -- Markdown research assets have arbitrary, unknown dimensions. */}
        <img src={resolved} alt={caption ?? "Research figure"} loading="lazy" />
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    );
  }
  if (ext === "pdf") {
    return <figure className="research-media"><object data={resolved} type="application/pdf" className="pdf-frame"><p><a href={resolved}>Open PDF figure</a></p></object>{caption && <figcaption>{caption}</figcaption>}</figure>;
  }
  if (videoTypes.has(ext)) {
    return <figure className="research-media"><video controls preload="metadata" src={resolved}>{caption}</video>{caption && <figcaption>{caption}</figcaption>}</figure>;
  }
  if (audioTypes.has(ext)) {
    return <figure className="research-media"><audio controls preload="metadata" src={resolved} />{caption && <figcaption>{caption}</figcaption>}</figure>;
  }
  return <figure className="research-media unsupported"><a href={resolved}>Open media: {caption || src}</a></figure>;
}

function markdownTarget(href: string, linkMap: Record<string, string>) {
  const [file, hash] = href.split("#");
  const base = file.split("/").pop();
  if (!base?.toLowerCase().endsWith(".md")) return null;
  const slug = base.replace(/\.md$/i, "");
  const route = linkMap[slug] ?? slug;
  return `/progress/${route}${hash ? `#${hash}` : ""}`;
}

export function MarkdownRenderer({
  content,
  linkMap = {},
}: {
  content: string;
  linkMap?: Record<string, string>;
}) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSlug, rehypeKatex]}
        components={{
          img: ({ src = "", alt = "" }) => <Media src={src} alt={alt} />,
          a: ({ href = "", children, ...props }) => {
            const { node, ...anchorProps } = props;
            void node;
            const internal = markdownTarget(href, linkMap);
            if (internal) return <Link href={internal}>{children}</Link>;
            const external = /^https?:\/\//i.test(href);
            return <a href={mediaUrl(href)} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} {...anchorProps}>{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
