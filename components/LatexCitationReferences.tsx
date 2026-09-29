"use client";

import { useEffect, useState } from "react";
import type { LatexCitationReference } from "@/lib/research/latex-citations.mjs";
import styles from "./LatexCitationReferences.module.css";

type Resolution = { citations: LatexCitationReference[] };

export function LatexCitationReferences({ projectId, file, content, revision }: { projectId: string; file: string; content: string; revision: string }) {
  const [citations, setCitations] = useState<LatexCitationReference[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      fetch("/api/ide/citations", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", research: projectId, file, content }),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Could not resolve citation keys.");
          return payload as Resolution;
        })
        .then((payload) => {
          if (active) {
            setCitations(payload.citations);
            setError("");
          }
        })
        .catch((requestError: unknown) => {
          if (active) setError(requestError instanceof Error ? requestError.message : "Could not resolve citation keys.");
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [content, file, projectId, revision]);

  if (!file || !/\.tex$/i.test(file) || (!citations.length && !error)) return null;

  return (
    <section className={styles.panel} aria-label="Citation references">
      <header><strong>Citation references</strong><span>Resolved from visible project .bib files</span></header>
      {error && <p role="status">{error}</p>}
      {citations.map((citation, index) => (
        <article className={styles.reference} key={`${citation.file}:${citation.start}:${index}`}>
          <code>{citation.key}</code>
          <span className={styles.status} data-status={citation.status}>
            {citation.status === "resolved" ? "Resolved" : citation.status === "ambiguous" ? "Choose a source" : "No source match"}
          </span>
          {citation.bibFiles.length > 0 && <small>{citation.bibFiles.join(", ")}</small>}
          {citation.choices.length > 0 && (
            <nav aria-label={`Sources for ${citation.key}`}>
              {citation.choices.map((choice) => (
                <span key={choice.slug}>
                  <a href={choice.researchHref}>{choice.title}</a>
                  {choice.paperHref && <> · <a href={choice.paperHref}>PDF</a></>}
                </span>
              ))}
            </nav>
          )}
        </article>
      ))}
    </section>
  );
}
