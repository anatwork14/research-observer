# Research Observer

Research Observer is a local-first viewer for the retention-constrained peer reuse thesis workspace. It connects the thesis Markdown sources into one navigable interface with a relationship map, Markdown rendering, and KaTeX equations.

## Run the viewer

From this directory:

```bash
python3 -m http.server 8765
```

Open [http://127.0.0.1:8765/thesis-viewer.html](http://127.0.0.1:8765/thesis-viewer.html).

The viewer reads the existing Markdown files without modifying them. It renders standard Markdown, fenced code, internal Markdown links, and both inline and display LaTeX delimiters, including the `\[ ... \]` style used in the thesis sources.

If a browser does not allow local fetches, use the **Load folder** control in the viewer to select the Markdown files directly.

## Included workspace artifacts

- `00_Research_Map.md` through `07_References_Literature_Evidence.md` — the thesis document sequence
- `Note.md` — execution decisions and immediate work
- `figures/` — source diagrams and rendered figures
- `review/` — current review and validation artifacts (archive snapshots are excluded)
- `threat_aware_dynamic_gossip_ieee.tex` and its PDF — the LaTeX manuscript source/output
- `thesis-viewer.html`, `thesis-viewer.css`, `thesis-viewer.js` — the frontend viewer

The large `ieee-diagram-skills-bundle/` source bundle and archived thesis ZIP are intentionally excluded from this repository; they are source/tooling archives rather than viewer inputs.

## License

The repository retains the MIT license from the upstream GitHub project.
