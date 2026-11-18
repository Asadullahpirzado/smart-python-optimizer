/* Core: state, API, router, editor abstraction, helpers */
const S3 = window.SPO3D;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = (n, d = 1) => (n === null || n === undefined || isNaN(n)) ? '–' : Number(n).toFixed(d);
const PAL = ['#2563EB', '#7C3AED', '#0D9488', '#059669', '#D97706', '#E11D48'];
const NAV_SECTIONS = [
  {
    title: 'Core Tools',
    items: [
      ['editor', 'Optimize Code', '✏️', '#F5F3FF'],
      ['dashboard', 'Overview', '📊', '#EFF6FF']
    ]
  },
  {
    title: 'Frontend & IR',
    items: [
      ['compiler', 'Compiler Analysis', '🧩', '#F0FDFA'],
      ['cfg', 'Control Flow Graph', '🕸️', '#ECFDF5']
    ]
  },
  {
    title: 'Optimization Engine',
    items: [
      ['results', 'Optimization Results', '⚡', '#FFFBEB'],
      ['algorithms', 'Algorithm Analysis', '🧠', '#FFF1F2'],
      ['compare', 'Code Comparison', '🔀', '#EFF6FF']
    ]
  },
  {
    title: 'Metrics & Performance',
    items: [
      ['complexity', 'Complexity Analyzer', '📈', '#F5F3FF'],
      ['benchmark', 'Performance Benchmarking', '⏱️', '#F0FDFA'],
      ['history', 'Optimization History', '🕘', '#ECFDF5']
    ]
  },
  {
    title: 'Academic Reports & Tutor',
    items: [
      ['reports', 'Reports & Downloads', '📄', '#FFFBEB'],
      ['final', 'Final Academic Report', '📑', '#EFF6FF'],
      ['tutor', 'Voice Tutor Pyro', '🎓', '#F5F3FF']
    ]
  },
  {
    title: 'Configuration',
    items: [
      ['settings', 'Settings & Passes', '⚙️', '#F1F5F9']
    ]
  }
];
const NAV = NAV_SECTIONS.flatMap(s => s.items);
const DEFAULT_SETTINGS = {
  passes: {inlining: true, constant_propagation: true, constant_folding: true, cse: true, copy_propagation: true, dead_code: true, licm: true,
           strength_reduction: true, loop_unrolling: true, unused_imports: false},
  iteration_limit: 5, assume_numeric: false, assume_script: true, unroll_max_trip: 4, unroll_max_nodes: 60, inline_max_nodes: 25,
  bench_timeout: 30, bench_repeats: 5, lang: 'en', voice: true, rate: 1, quality: 'high', theme: 'bright'};

const state = {files: [], active: 0, settings: structuredClone(DEFAULT_SETTINGS), pages: {}, charts: {}, editors: []};
const store = {
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('spo') || 'null');
      if (s) {
        state.files = s.files || [];
        state.active = s.active || 0;
        state.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), s.settings || {});
        state.settings.passes = Object.assign({}, DEFAULT_SETTINGS.passes, (s.settings || {}).passes || {});
        state.settings.theme = 'bright';
      }
    } catch (e) {}
  },
  save() { try { localStorage.setItem('spo', JSON.stringify({files: state.files.map(f => ({name: f.name, code: f.code})), active: state.active, settings: state.settings})); return true; } catch (e) { return false; } }
};
const file = () => state.files[state.active];
function ensureFile() { if (!state.files.length) state.files.push({name: 'untitled.py', code: ''}); if (state.active >= state.files.length) state.active = 0; }

/* ---------- toasts / progress / api ---------- */
function toast(msg, kind = '') { if (kind === 'ok' && window.SPO3D) SPO3D.pulse('#34D399'); const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4200); }
let progTimer = null, hudStage = null;
function hudOn() { if (!S3.on()) return null; const box = $('#hud'); if (!box) return null; if (!hudStage || hudStage.disposed) { hudStage = S3.pipeline($('#hudStage')); } return hudStage; }
function progress(label, steps) {
  const box = $('#progress'), bar = $('i', box), txt = $('span', box), hud = hudOn(); let i = 0, manualText = ''; box.classList.remove('hidden'); if (hud) { $('#hud').classList.remove('hidden'); S3.pulse('#4285F4'); }
  const tick = () => { txt.textContent = manualText || (steps ? steps[Math.min(i, steps.length - 1)] : label); const n = steps ? steps.length : 8; bar.style.width = Math.min(92, 8 + i * (84 / n)) + '%'; if (hud) hud.setProgress(Math.min(.95, i / n)); i++; };
  tick(); clearInterval(progTimer); progTimer = setInterval(tick, 450);
  const finish = () => { clearInterval(progTimer); bar.style.width = '100%'; if (hud) hud.finish(); setTimeout(() => { box.classList.add('hidden'); bar.style.width = '0'; if (hud) $('#hud').classList.add('hidden'); }, 700); };
  finish.update = text => { manualText = text; txt.textContent = text; bar.style.width = Math.min(96, parseFloat(bar.style.width) || 8) + '%'; };
  return finish;
}
async function api(path, body, method = 'POST', timeoutMs = 120000) {
  const opt = {method, headers: {'Content-Type': 'application/json'}};
  if (body !== undefined && method !== 'GET') opt.body = JSON.stringify(body);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs); opt.signal = controller.signal;
  let r; try { r = await fetch(path, opt); } catch (e) {
    if (e.name === 'AbortError') throw new Error(`The request timed out after ${Math.round(timeoutMs / 1000)} seconds. The page is responsive again; try fewer files or a smaller project.`);
    throw new Error('Cannot reach the server. Is it running?');
  } finally { clearTimeout(timer); }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error((j && j.error) || ('Request failed (' + r.status + ')')); err.lineno = j && j.lineno; throw err; }
  return j;
}
function download(name, content, type = 'text/plain') { const b = content instanceof Blob ? content : new Blob([content], {type}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

/* ---------- lazy CDN libraries ---------- */
const libs = {};
function tryScript(url, ms = 9000) {
  return new Promise(res => { const s = document.createElement('script'); let done = false;
    const fin = v => { if (!done) { done = true; if (!v) s.remove(); res(v); } };
    s.src = url; s.onload = () => fin(true); s.onerror = () => fin(false); document.head.appendChild(s); setTimeout(() => fin(false), ms); });
}
async function loadAny(key, urls, test) {
  if (test()) return true;
  if (!libs[key]) libs[key] = (async () => { for (const u of urls) { if (await tryScript(u) && test()) return true; } return test(); })();
  const ok = await libs[key]; if (!ok) delete libs[key]; return ok;
}
const V = '/static/js/vendor/';
const ensureChart = async () => { await loadAny('chart', [V + 'chart.umd.min.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js', 'https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js'], () => !!window.Chart); return window.Chart; };
const ensureCy = async () => { await loadAny('cy', [V + 'cytoscape.min.js', 'https://cdn.jsdelivr.net/npm/cytoscape@3.28.1/dist/cytoscape.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js', 'https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js'], () => !!window.cytoscape); return window.cytoscape; };
async function drawChart(id, cfg) {
  const el = document.getElementById(id); if (!el) return;
  const C = await ensureChart();
  if (!C) { el.replaceWith(Object.assign(document.createElement('div'), {className: 'muted', textContent: 'Chart.js could not be loaded. Run  python download_libs.py  once (needs internet), then refresh with Ctrl+F5.'})); return; }
  if (state.charts[id]) state.charts[id].destroy();
  state.charts[id] = new C(el, cfg);
}
function destroyCharts() { if (window.SPO3D) SPO3D.disposeAll(); Object.values(state.charts).forEach(c => { try { c.destroy(); } catch (e) {} }); state.charts = {}; state.editors.forEach(e => { try { e.dispose(); } catch (x) {} }); state.editors = []; }

/* ---------- editor abstraction (Monaco with textarea fallback) ---------- */
let monacoP = null;
function loadMonaco() {
  if (monacoP) return monacoP;
  monacoP = new Promise(res => {
    const to = setTimeout(() => res(null), 1000);
    const base = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min';
    const s = document.createElement('script'); s.src = base + '/vs/loader.js';
    s.onerror = () => { clearTimeout(to); res(null); };
    s.onload = () => {
      try {
        window.MonacoEnvironment = {getWorkerUrl: () => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`self.MonacoEnvironment={baseUrl:'${base}/'};importScripts('${base}/vs/base/worker/workerMain.js');`)};
        require.config({paths: {vs: base + '/vs'}});
        require(['vs/editor/editor.main'], () => { clearTimeout(to); res(window.monaco); }, () => { clearTimeout(to); res(null); });
      } catch (e) { clearTimeout(to); res(null); }
    };
    document.head.appendChild(s);
  });
  return monacoP;
}
async function createEditor(box, value, {readOnly = false, onChange} = {}) {
  const monaco = await loadMonaco();
  let api;
  if (monaco) {
    const ed = monaco.editor.create(box, {value, language: 'python', theme: 'vs', automaticLayout: true, minimap: {enabled: false}, readOnly, fontSize: 13, scrollBeyondLastLine: false, fontFamily: "'JetBrains Mono',Consolas,monospace", renderLineHighlight: readOnly ? 'none' : 'line'});
    let dec = [];
    if (onChange) ed.onDidChangeModelContent(() => onChange(ed.getValue()));
    api = {get: () => ed.getValue(), set: v => ed.setValue(v),
      mark: r => { dec = ed.deltaDecorations(dec, r.map(x => ({range: new monaco.Range(x.from, 1, x.to, 1), options: {isWholeLine: true, className: x.cls}}))); },
      reveal: l => ed.revealLineInCenter(l), dispose: () => ed.dispose(), monaco: true};
  } else if (!readOnly) {
    const ta = document.createElement('textarea'); ta.value = value; ta.spellcheck = false; box.appendChild(ta);
    ta.addEventListener('input', () => onChange && onChange(ta.value));
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
    api = {get: () => ta.value, set: v => { ta.value = v; }, mark() {}, reveal() {}, dispose() {}};
  } else {
    const wrap = document.createElement('div'); wrap.className = 'plain-lines'; box.appendChild(wrap);
    const render = (text, marks = []) => { wrap.innerHTML = ''; text.split('\n').forEach((l, i) => { const d = document.createElement('div'); d.dataset.n = i + 1; d.textContent = l || ' '; const m = marks.find(x => i + 1 >= x.from && i + 1 <= x.to); if (m) d.className = m.cls.replace('mk-', 'ln-'); wrap.appendChild(d); }); };
    let text = value; render(text);
    api = {get: () => text, set: v => { text = v; render(v); }, mark: r => render(text, r), reveal: l => { const d = wrap.children[l - 1]; if (d) d.scrollIntoView({block: 'center'}); }, dispose() {}};
  }
  state.editors.push(api); return api;
}

/* ---------- navigation ---------- */
/* ---------- navigation ---------- */
function buildNav() {
  $('#nav').innerHTML = NAV_SECTIONS.map(sec => `
    <div class="nav-section">
      <div class="nav-heading">${sec.title}</div>
      ${sec.items.map(([id, label, ic, bg]) => `<a href="#${id}" data-id="${id}"><i style="background:${bg}">${ic}</i>${label}</a>`).join('')}
    </div>
  `).join('');
}

function refreshFileSel() {
  ensureFile(); const sel = $('#fileSel');
  sel.innerHTML = state.files.map((f, i) => `<option value="${i}" ${i === state.active ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
}
function currentRoute() { const h = location.hash.slice(1) || 'editor'; return NAV.some(n => n[0] === h) ? h : 'editor'; }

function setStatus(text, kind = 'ready') {
  const pill = $('#compilerStatus');
  if (!pill) return;
  pill.className = `status-pill ${kind}`;
  const t = pill.querySelector('.status-text') || pill;
  t.textContent = text;
}

async function render() {
  if (window.Voice) { if (Voice.currentOwner !== 'guide') Voice.stop(); Voice.avatar = S3 && S3.teacher ? [S3.teacher] : null; }
  destroyCharts(); const id = currentRoute(); $('#side').classList.remove('open');
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.id === id));
  const navItem = NAV.find(n => n[0] === id);
  $('#title').textContent = navItem ? navItem[1] : 'Dashboard'; refreshFileSel();
  const f = file();
  if (f) {
    if (f.opt) setStatus(`Optimized (${f.opt.changes.length} changes)`, 'opt');
    else if (f.analysis) setStatus(`Analyzed (${f.analysis.stats.lines} lines)`, 'ready');
    else setStatus('Compiler Ready', 'ready');
  }
  const view = $('#view'); view.innerHTML = ''; view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  try { await state.pages[id](view); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`; }
}

/* ---------- actions shared by many pages ---------- */
const ANALYZE_STEPS = ['Lexical analysis…', 'Parsing → AST…', 'Semantic analysis & symbol table…', 'Building IR & control-flow graphs…', 'Data-flow analysis & SSA…', 'Complexity & algorithm analysis…'];
const OPT_STEPS = ['Parsing & validating…', 'Building IR / CFG…', 'Constant propagation & folding…', 'Common subexpression elimination…', 'Dead code & copy propagation…', 'Loop optimizations…', 'Algorithmic analysis…', 'Validating transformations…', 'Generating optimized code…'];
function syncEditorToFile() { const ed = state.pages._editor; if (ed && currentRoute() === 'editor' && state.pages._editorFile === file()) file().code = ed.get(); }

async function doAnalyze(quiet) {
  syncEditorToFile(); const f = file(); if (!f.code.trim()) { toast('Add some Python code first.', 'warn'); return false; }
  setStatus('Analyzing AST & CFG…', 'busy');
  const done = progress('', ANALYZE_STEPS);
  try {
    f.analysis = await api('/api/analyze', {code: f.code, settings: state.settings});
    f.analysisCode = f.code;
    setStatus(`Analyzed (${f.analysis.stats.lines} lines, ${f.analysis.ast.total_nodes} AST nodes)`, 'ready');
    if (!quiet) toast('Analysis complete', 'ok');
    return true;
  } catch (e) {
    setStatus('Analysis Error', 'err');
    toast(e.message + (e.lineno ? ` (line ${e.lineno})` : ''), 'err');
    return false;
  } finally { done(); }
}

async function doOptimize(extra = {}) {
  syncEditorToFile(); const f = file(); if (!f.code.trim()) { toast('Add some Python code first.', 'warn'); return false; }
  setStatus('Optimizing Pipeline (10 Passes)…', 'busy');
  const done = progress('', OPT_STEPS);
  try {
    const s = Object.assign({}, state.settings, extra);
    const optRes = await api('/api/optimize', {code: f.code, filename: f.name, settings: s});
    f.opt = optRes;
    f.optCode = f.code;
    f.bench = null; f.validation = null;
    setStatus(`Optimized: ${f.opt.changes.length} transformations applied`, 'opt');
    toast(`Done: ${f.opt.changes.length} optimizations applied in ${f.opt.elapsed_ms} ms`, 'ok');
    return true;
  } catch (e) {
    setStatus('Optimization Error', 'err');
    toast(e.message + (e.lineno ? ` (line ${e.lineno})` : ''), 'err');
    return false;
  } finally { done(); }
}

function needs(view, what, fn) {
  view.innerHTML = `<div class="card empty"><h3>${what === 'opt' ? 'No optimization yet' : 'No analysis yet'}</h3><p>${esc(file().name)} has not been ${what === 'opt' ? 'optimized' : 'analyzed'} yet.</p>
  <div style="margin-top:14px"><button class="btn primary" id="runNow">${what === 'opt' ? '⚡ Optimize now' : '🔍 Analyze now'}</button> <a class="btn" href="#editor">Open editor</a></div></div>`;
  $('#runNow').onclick = async () => { const ok = what === 'opt' ? await doOptimize() : await doAnalyze(); if (ok) render(); };
}
const stale = f => f.analysis && f.analysisCode !== f.code;
const card = (title, body, cls = '') => `<div class="card ${cls}"><h3>${title}</h3>${body}</div>`;
const stat = (v, label, c) => `<div class="card stat" style="--c:${c}"><b>${v}</b><span>${label}</span></div>`;
const table = (heads, rows, cls = '') => `<div class="scroll ${cls}"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;


/* ---------- 3D viewport helpers (3D first, original 2D library as fallback) ---------- */
const slot = (id, cls = '', h) => `<div class="s3 ${cls}" id="${id}"${h ? ` style="--h:${h}px"` : ''}></div>`;
const vslot = (id, cls = '', canvasH = 200) => S3.on() ? slot(id, cls) : `<canvas id="${id}" height="${canvasH}"></canvas>`;
function viz(id, fn3d, fallback2d) {
  const el = document.getElementById(id); if (!el) return null;
  if (S3.on() && el.tagName === 'DIV') return fn3d(el);
  if (fallback2d) fallback2d(); else el.innerHTML = '<div class="s3-fallback">3D view is off. Turn it on in Settings → 3D quality.</div>'; return null;
}
function applyTheme() { document.documentElement.dataset.theme = 'bright'; }
function lang() { return state.settings.lang || 'en'; }

/* ---------- boot ---------- */
window.addEventListener('DOMContentLoaded', () => {
  store.load(); ensureFile(); applyTheme(); buildNav(); refreshFileSel(); Voice.enabled = state.settings.voice !== false; Voice.rate = state.settings.rate || 1; Voice.voiceURI = state.settings.voiceURI || '';
  $('#burger').onclick = () => $('#side').classList.toggle('open');
  $('#fileSel').onchange = e => { syncEditorToFile(); state.active = +e.target.value; store.save(); render(); };
  $('#quickAnalyze').onclick = async () => { if (await doAnalyze()) location.hash = '#compiler'; };
  $('#quickOptimize').onclick = async () => { if (await doOptimize()) location.hash = '#results'; };
  const ls = $('#langSel'); ls.innerHTML = LANGS.map(l => `<option value="${l.code}">${l.name}</option>`).join(''); ls.value = lang(); ls.onchange = () => { state.settings.lang = ls.value; store.save(); document.documentElement.lang = ls.value; if (currentRoute() === 'tutor' || currentRoute() === 'final') render(); };
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeunload', () => { syncEditorToFile(); store.save(); });
  if (S3.on()) { S3.initTilt($('#main')); }
  render();
});
