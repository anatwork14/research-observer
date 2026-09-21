# Thesis Observer

`thesis-viewer.html` is a static, read-only frontend for the nine thesis Markdown sources in this folder.

## Run locally

From this folder, start a small local server:

```bash
python3 -m http.server 8765
```

Then open [http://127.0.0.1:8765/thesis-viewer.html](http://127.0.0.1:8765/thesis-viewer.html).

Serving the folder is needed because browsers block `fetch()` when an HTML file is opened directly with `file://`. If you cannot run a server, use **Load folder** in the viewer to select the Markdown files from Finder.

The viewer uses the existing Markdown as the source of truth and renders it with Marked, DOMPurify, KaTeX, and Highlight.js loaded from public CDNs. The relationship map is a visual index of the document links and thesis sequence; it does not modify any source file.
