"use client";

import { useMemo, useState } from "react";
import styles from "./ChatGPTWebPrompt.module.css";

const PLACEHOLDER = "{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}";

export function ChatGPTWebPrompt({ template }: { template: string }) {
  const [topic, setTopic] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const replacement = topic.trim() || PLACEHOLDER;
    return template.replaceAll(PLACEHOLDER, replacement);
  }, [template, topic]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`panel ${styles.card}`} aria-labelledby="chatgpt-web-prompt-title">
      <div className={styles.heading}>
        <div>
          <span className="kicker">ChatGPT Web</span>
          <h2 id="chatgpt-web-prompt-title">One input → an Observaire-ready research starter pack</h2>
          <p>
            Enter only your topic, idea, or hypothesis. The generated prompt carries the stable-ID, linking,
            provenance, falsifiability, and output-format rules needed for reliable Observaire indexing.
          </p>
        </div>
        <span className={styles.badge}>not Codex</span>
      </div>

      <label className={styles.topicField}>
        <span>Topic / idea / hypothesis</span>
        <textarea
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          rows={3}
          placeholder="e.g. Retrieval-augmented generation can reduce unsupported claims in medical question answering"
        />
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => void copyPrompt()}>
          {copied ? "Copied prompt ✓" : topic.trim() ? "Copy ready prompt" : "Copy template"}
        </button>
        <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className={styles.secondary}>
          Open ChatGPT ↗
        </a>
      </div>

      <details className={styles.preview}>
        <summary>Preview generated prompt</summary>
        <pre>{prompt}</pre>
      </details>

      <p className={styles.note}>
        The web prompt deliberately uses a temporary high filename range because ChatGPT cannot see your existing repository.
        Stable IDs remain canonical, so filenames can be safely renumbered before import without changing research identity.
      </p>
    </section>
  );
}
