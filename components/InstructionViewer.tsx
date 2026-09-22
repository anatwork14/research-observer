"use client";

import { useMemo, useState } from "react";

type InstructionSource = {
  key: string;
  label: string;
  path: string;
  content: string;
};

export function InstructionViewer({ sources }: { sources: InstructionSource[] }) {
  const [active, setActive] = useState(sources[0]?.key ?? "");
  const [copied, setCopied] = useState<"active" | "all" | null>(null);
  const selected = sources.find((source) => source.key === active) ?? sources[0];

  const combined = useMemo(() => {
    const preface = [
      "# Research Observer — LLM authoring instruction pack",
      "",
      "Use the following repository instructions when generating or editing Research Observer Markdown.",
      "Treat them as authoritative. Do not invent facts, citations, measurements, relationships, source metadata, or target files.",
      "",
    ].join("\n");
    return preface + sources.map((source) => `## Source: ${source.path}\n\n${source.content.trim()}\n`).join("\n");
  }, [sources]);

  async function copy(kind: "active" | "all") {
    const text = kind === "all" ? combined : selected?.content ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  }

  if (!selected) return null;

  return (
    <section className="instruction-workbench">
      <aside className="instruction-sources panel" aria-label="Instruction sources">
        <span className="kicker">Canonical sources</span>
        <nav>
          {sources.map((source) => (
            <button
              key={source.key}
              className={source.key === active ? "active" : ""}
              onClick={() => setActive(source.key)}
              aria-pressed={source.key === active}
            >
              <strong>{source.label}</strong>
              <small>{source.path}</small>
            </button>
          ))}
        </nav>

        <div className="instruction-copy-all">
          <button onClick={() => void copy("all")}>
            {copied === "all" ? "Copied complete pack ✓" : "Copy complete LLM prompt"}
          </button>
          <p>Includes every displayed source with an instruction-pack preface.</p>
        </div>
      </aside>

      <section className="instruction-reader panel">
        <header>
          <div>
            <span className="file-chip">MD</span>
            <code>{selected.path}</code>
          </div>
          <button onClick={() => void copy("active")}>
            {copied === "active" ? "Copied ✓" : "Copy source"}
          </button>
        </header>
        <pre>{selected.content}</pre>
      </section>
    </section>
  );
}
