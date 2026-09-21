# Research Observer

Research Observer is a convention-driven Next.js workspace for research progress. It is intentionally not tied to a thesis: use it for literature exploration, experiments, model development, field notes, design research, lab work, or any other research process.

## The only required convention

Put Markdown files in `progress/` and prefix each filename with an ordered number:

```text
progress/
├── 00_start_here.md
├── 01_problem_and_questions.md
├── 02_first_experiment.md
├── 03_results.md
└── figures/
    ├── accuracy.svg
    ├── ablation.png
    └── demo.mp4
```

Files matching `XX_*.md` (or any numeric prefix such as `100_*.md`) are discovered automatically and sorted by the numeric prefix. There is no JavaScript list to maintain.

Run locally:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Markdown features

Research notes support GitHub-Flavored Markdown, tables, task lists, fenced code, links between progress notes, and KaTeX math through `remark-math` / `rehype-katex`.

```md
Inline math: $E = mc^2$

$$
\operatorname{score}(x) = \frac{1}{1 + e^{-x}}
$$
```

Links to another ordered note become internal Research Observer navigation automatically:

```md
See [the experiment](02_first_experiment.md).
```

## Figures and research media

Relative media paths are served from inside `progress/`. Standard Markdown image syntax is enough:

```md
![Accuracy by epoch](figures/accuracy.svg)
![Ablation table](figures/ablation.png)
![PDF figure](figures/system-diagram.pdf)
![Experiment demo](figures/demo.mp4)
![Audio sample](figures/sample.wav)
```

The renderer supports common browser-viewable image formats (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `svg`, `bmp`), PDF, video (`mp4`, `webm`, `ogv`/`ogg`), and audio (`mp3`, `wav`, `m4a`, `aac`, `flac`). Remote `https://` media also works.

> Browser support still determines whether a particular codec can becoded. For maximum portability, prefer SVG/PNG/WebP for figures, PDF for multi-page figures, MP4/WebM for video, and MP3/WAV for audio.

## Optional frontmatter

No frontmatter is required. If you want richer labels, add:

```yaml
---
title: First retrieval experiment
summary: Testing whether reranking improves recall under a fixed latency budget.
status: validating
date: 2026-09-22
tags: [retrieval, reranking, experiment]
---
```

Without frontmatter, Research Observer uses the first `# Heading` as the title, then falls back to the filename.

## How it works

- `lib/progress.ts` scans and sorts `progress/*.md` on the server.
- `app/progress/[slug]/page.tsx` renders each note with automatic previous/next navigation and inferred Markdown links.
- `components/MarkdownRenderer.tsx` handles GFM, KaTeX, internal note links, and research media.
- `app/media/[...path]/route.ts` securely serves relative assets stored under `progress/`.

## Deploy

This is a normal Next.js app and can be deployed anywhere Next.js is supported. Because research notes are read from the project filesystem, commit the `progress/` folder with the app before building/deploying.

## License

MIT.
