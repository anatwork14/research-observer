/* Thesis Observer — static, local-first Markdown viewer. */
const FILES = [
  { id: '00_Research_Map.md', short: 'Research map', subtitle: 'orientation', kind: 'map' },
  { id: '01_Motivation_Problem_Gap.md', short: 'Motivation + gap', subtitle: 'problem framing', kind: 'problem' },
  { id: '02_Research_Questions_Hypotheses_Contributions.md', short: 'Questions + claims', subtitle: 'decision gates', kind: 'claims' },
  { id: '03_Datasets_Preprocessing_Client_Architecture.md', short: 'Data + clients', subtitle: 'information boundaries', kind: 'data' },
  { id: '04_Methodology_System_Model_Algorithm.md', short: 'System + method', subtitle: 'peer reuse algorithm', kind: 'method' },
  { id: '05_Experimental_Design_Protocol.md', short: 'Experimental protocol', subtitle: 'metrics + feasibility', kind: 'protocol' },
  { id: '06_Baselines_Ablations_Comparison_Plan.md', short: 'Baselines + ablations', subtitle: 'fair comparison', kind: 'baselines' },
  { id: '07_References_Literature_Evidence.md', short: 'Evidence + anchors', subtitle: 'novelty boundaries', kind: 'evidence' },
  { id: 'Note.md', short: 'Execution note', subtitle: 'immediate work', kind: 'note' },
];

const EDGES = [['00','01'], ['00','02'], ['00','03'], ['00','04'], ['00','05'], ['00','06'], ['00','07'], ['00','08'], ['01','02'], ['01','07'], ['02','03'], ['02','04'], ['02','05'], ['03','04'], ['03','07'], ['04','05'], ['04','07'], ['05','06'], ['06','07'], ['08','00']];
const POSITIONS = [[150,30],[62,70],[238,70],[38,144],[116,122],[184,122],[262,145],[100,210],[211,210]];
const state = { selected: new URLSearchParams(location.search).get('file') || FILES[0].id, sources: new Map(), customNames: [], search: '', paletteIndex: 0 };

const $ = (id) => document.getElementById(id);
const fileById = (id) => FILES.find((file) => file.id === id) || FILES[0];
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const displayTitle = (file) => file.short;

function renderFileList() {
  const query = state.search.trim().toLowerCase();
  const visible = FILES.filter((file) => `${file.id} ${file.short} ${file.subtitle}`.toLowerCase().includes(query));
  $('file-list').innerHTML = visible.length ? visible.map((file) => {
    const index = String(FILES.indexOf(file)).padStart(2, '0');
    const linked = EDGES.some(([a, b]) => (a === index || b === index));
    return `<button class="file-item ${linked ? 'is-linked' : ''}" data-file="${file.id}" aria-current="${state.selected === file.id}"><span class="file-index">${index}</span><span class="file-label"><span class="file-title">${file.short}</span><span class="file-subtitle">${file.subtitle}</span></span><i class="file-state" aria-hidden="true"></i></button>`;
  }).join('') : '<div class="empty-state"><p>No matching documents.</p></div>';
  $('file-count').textContent = String(FILES.length).padStart(2, '0');
  document.querySelectorAll('[data-file]').forEach((button) => button.addEventListener('click', () => selectFile(button.dataset.file)));
}

function renderGraph() {
  const svg = $('connection-graph');
  svg.innerHTML = `${EDGES.map(([a, b]) => { const p1 = POSITIONS[Number(a)]; const p2 = POSITIONS[Number(b)]; return `<line class="graph-edge" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" />`; }).join('')}${FILES.map((file, index) => { const [x, y] = POSITIONS[index]; const selected = file.id === state.selected; return `<g class="graph-node ${selected ? 'selected' : ''}" data-file="${file.id}" tabindex="0" role="button" aria-label="Open ${file.short}"><circle cx="${x}" cy="${y}" r="${selected ? 17 : 14}" /><text x="${x}" y="${y}">${String(index).padStart(2, '0')}</text></g>`; }).join('')}`;
  svg.querySelectorAll('[data-file]').forEach((node) => { node.addEventListener('click', () => selectFile(node.dataset.file)); node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') selectFile(node.dataset.file); }); });
}

function renderRelated() {
  const index = FILES.findIndex((file) => file.id === state.selected);
  const related = [...new Set(EDGES.flatMap(([a, b]) => Number(a) === index ? [Number(b)] : Number(b) === index ? [Number(a)] : []))].slice(0, 4);
  $('related-title').textContent = related.length ? 'Related documents' : 'Nearby threads';
  $('related-list').innerHTML = related.map((relatedIndex) => `<button class="related-item" data-file="${FILES[relatedIndex].id}"><span class="related-number">${String(relatedIndex).padStart(2, '0')}</span><span>${FILES[relatedIndex].short}</span></button>`).join('');
  $('related-list').querySelectorAll('[data-file]').forEach((button) => button.addEventListener('click', () => selectFile(button.dataset.file)));
}

function renderOutline() {
  const headings = [...$('markdown-body').querySelectorAll('h1, h2, h3')];
  $('outline-list').innerHTML = headings.length ? headings.map((heading, index) => { heading.id = heading.id || `heading-${index}`; return `<a class="outline-link level-${heading.tagName.substring(1)}" href="#${heading.id}">${heading.textContent}</a>`; }).join('') : '<span class="muted">No headings</span>';
}

function renderMathAndCode() {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement($('markdown-body'), { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }, { left: '$', right: '$', display: false }], throwOnError: false, strict: false });
  }
  document.querySelectorAll('pre code').forEach((block) => { if (window.hljs) hljs.highlightElement(block); });
}

function markdownToHtml(source) {
  // Marked treats a bare `\[` line as an escaped Markdown character. Normalize
  // the delimiters used by the thesis into KaTeX-friendly dollar delimiters
  // before parsing, while leaving the formula body untouched.
  const normalizedSource = source
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, formula) => `\n$$\n${formula}\n$$`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_, formula) => `$${formula}$`);
  const renderer = new marked.Renderer();
  renderer.link = ({ href, title, text }) => `<a href="${href || '#'}"${title ? ` title="${title}"` : ''}>${text}</a>`;
  marked.setOptions({ renderer, gfm: true, breaks: false, headerIds: false, mangle: false });
  return DOMPurify.sanitize(marked.parse(normalizedSource), { ADD_ATTR: ['target'] });
}

async function loadSource(file) {
  if (state.sources.has(file.id)) return state.sources.get(file.id);
  try { const response = await fetch(encodeURI(file.id)); if (!response.ok) throw new Error('HTTP ' + response.status); const source = await response.text(); state.sources.set(file.id, source); return source; }
  catch (error) { return null; }
}

async function selectFile(id) {
  const file = fileById(id); state.selected = file.id; state.search = ''; $('file-search').value = ''; history.replaceState(null, '', `?file=${encodeURIComponent(file.id)}`); renderFileList(); renderGraph(); renderRelated(); $('reader-file').textContent = file.id; $('markdown-body').innerHTML = '<div class="loading-state"><span class="spinner"></span><p>Loading document…</p></div>';
  const source = await loadSource(file);
  if (!source) { $('markdown-body').innerHTML = `<div class="empty-state"><p>Could not fetch <strong>${file.id}</strong>.<br />Serve this folder locally with <code>python3 -m http.server</code>, or use <strong>Load folder</strong> above.</p></div>`; $('word-count').textContent = '— words'; $('math-count').textContent = 'Math rendering waiting'; return; }
  $('markdown-body').innerHTML = markdownToHtml(source); renderMathAndCode(); renderOutline();
  $('word-count').textContent = `${source.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words`; const mathMatches = source.match(/\$\$|\\\(|\\\[|\$[^$]+\$/g) || []; $('math-count').textContent = mathMatches.length ? `${mathMatches.length} math expressions rendered` : 'No math blocks';
  document.querySelectorAll('.markdown-body a[href$=".md"], .markdown-body a[href*=".md#"]').forEach((link) => link.addEventListener('click', (event) => { const target = decodeURIComponent(link.getAttribute('href').split('#')[0].split('/').pop()); if (FILES.some((candidate) => candidate.id === target)) { event.preventDefault(); selectFile(target); } }));
}

function renderPalette() { const query = $('palette-search').value.trim().toLowerCase(); const matches = FILES.filter((file) => `${file.id} ${file.short} ${file.subtitle}`.toLowerCase().includes(query)); state.paletteIndex = Math.min(state.paletteIndex, Math.max(0, matches.length - 1)); $('palette-results').innerHTML = matches.map((file, index) => `<button class="palette-result ${index === state.paletteIndex ? 'selected' : ''}" data-file="${file.id}"><span class="palette-result-index">${String(FILES.indexOf(file)).padStart(2, '0')}</span><span class="palette-result-label">${file.short}<small> · ${file.subtitle}</small></span></button>`).join(''); $('palette-results').querySelectorAll('[data-file]').forEach((button) => button.addEventListener('click', () => { closePalette(); selectFile(button.dataset.file); })); }
function openPalette() { $('command-palette').hidden = false; $('palette-search').value = ''; state.paletteIndex = 0; renderPalette(); setTimeout(() => $('palette-search').focus(), 0); }
function closePalette() { $('command-palette').hidden = true; }

function bindEvents() {
  $('file-search').addEventListener('input', (event) => { state.search = event.target.value; renderFileList(); });
  $('open-map').addEventListener('click', () => selectFile('00_Research_Map.md'));
  $('focus-reader').addEventListener('click', () => { $('markdown-body').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('toggle-outline').addEventListener('click', () => $('outline').classList.toggle('is-visible'));
  $('next-file').addEventListener('click', () => selectFile(FILES[(FILES.findIndex((file) => file.id === state.selected) + 1) % FILES.length].id));
  $('copy-link').addEventListener('click', async () => { await navigator.clipboard?.writeText(location.href); $('copy-link').innerHTML = '✓ <span>Copied</span>'; setTimeout(() => { $('copy-link').innerHTML = '↗ <span>Share</span>'; }, 1400); });
  $('theme-toggle').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('thesis-viewer-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });
  $('folder-input').addEventListener('change', async (event) => { const files = [...event.target.files].filter((file) => file.name.endsWith('.md')); for (const file of files) state.sources.set(file.name, await file.text()); $('source-state').textContent = `${files.length} local Markdown sources`; $('indexed-time').textContent = 'just now'; selectFile(state.selected); });
  $('palette-search').addEventListener('input', () => { state.paletteIndex = 0; renderPalette(); });
  $('palette-search').addEventListener('keydown', (event) => { const results = [...$('palette-results').querySelectorAll('[data-file]')]; if (event.key === 'ArrowDown') { event.preventDefault(); state.paletteIndex = Math.min(state.paletteIndex + 1, results.length - 1); renderPalette(); } if (event.key === 'ArrowUp') { event.preventDefault(); state.paletteIndex = Math.max(state.paletteIndex - 1, 0); renderPalette(); } if (event.key === 'Enter' && results[state.paletteIndex]) { closePalette(); selectFile(results[state.paletteIndex].dataset.file); } if (event.key === 'Escape') closePalette(); });
  document.querySelector('[data-close-palette]').addEventListener('click', closePalette);
  document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); } if (event.key === '/' && document.activeElement.tagName !== 'INPUT') { event.preventDefault(); $('file-search').focus(); } if (event.key === 'Escape' && !$('command-palette').hidden) closePalette(); });
}

function init() { if (localStorage.getItem('thesis-viewer-theme') === 'dark') document.body.classList.add('dark'); renderFileList(); renderGraph(); renderRelated(); bindEvents(); selectFile(state.selected); }
init();
