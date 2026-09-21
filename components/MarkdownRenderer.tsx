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

function isExternal(src: string) {
  return /^(https?:|data:|blob:)/i.test(src);
}

function mediaUrl(src: string) {
  if (!src || isExternal(src) || src.startsWith("/")) return src;
  const cleaned = src.replace(/^\.\//, "").replace(/^(\.\.\/)+/, "");
  return `/media/${cleaned.split("/").map(encodeURIComponent).join("/")}`;
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

function markdownTarget(href: string) {
  const [file, hash] = href.split("#");
  const base = file.split("/").pop();
  if (!base?.toLowerCase().endsWith(".md")) return null;
  const slug = base.replace(/\.md$/i, "");
  return `/progress/${slug}${hash ? `#${hash}` : ""}`;
}

export function MarkdownRenderer({ content }: { content: string }) {
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
            const internal = markdownTarget(href);
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
