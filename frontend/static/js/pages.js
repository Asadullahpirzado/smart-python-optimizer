/* Page renderers */
const P = state.pages;
const PASS_LABEL = {inlining: 'Function inlining', constant_propagation: 'Constant propagation', constant_folding: 'Constant folding', cse: 'Common subexpression elimination',
  copy_propagation: 'Copy propagation', dead_code: 'Dead code elimination', licm: 'Loop-invariant code motion', strength_reduction: 'Strength reduction',
  loop_unrolling: 'Loop unrolling', unused_imports: 'Unused import removal', recommendations: 'Approved suggestions'};
const PASS_SHORT = {inlining: 'Inlining', constant_propagation: 'Const prop', constant_folding: 'Const fold', cse: 'CSE', copy_propagation: 'Copy prop', dead_code: 'Dead code', licm: 'LICM', strength_reduction: 'Strength', loop_unrolling: 'Unroll', unused_imports: 'Imports', recommendations: 'Approved'};
const dc = (id, fn3d, cfg) => viz(id, fn3d, () => drawChart(id, cfg));
const escTip = s => String(s ?? '').replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));

function astGraph(outline) {
  const nodes = [], edges = [], DC = ['#A78BFA', '#4285F4', '#2DD4BF', '#34D399', '#FB923C', '#F472B6']; let n = 0;
  (function walk(o, depth, parent) {
    const id = 'n' + n++;
    const isStmt = /^(def|class|async)/.test(o.label) || ['For', 'While', 'If', 'Try', 'With', 'FunctionDef', 'ClassDef', 'Return', 'Assign'].some(k => o.label.startsWith(k));
    const isExpr = ['BinOp', 'UnaryOp', 'Compare', 'Call', 'Attribute', 'Subscript'].some(k => o.label.startsWith(k));
    const shape = isStmt ? 'prism' : isExpr ? 'capsule' : 'sphere';
    const key = depth <= 1 || isStmt;
    nodes.push({
      id,
      label: depth <= 1 || key ? o.label.slice(0, 26) : '',
      shape,
      size: [depth === 0 ? 1.2 : key ? .72 : .4],
      color: DC[depth % 6],
      glow: depth === 0 || key,
      tipTitle: o.label,
      tip: o.line ? ['line ' + o.line, isStmt ? 'Statement Construct' : isExpr ? 'Expression Operation' : 'Literal / Identifier'] : []
    });
    if (parent) edges.push({from: parent, to: id});
    (o.children || []).forEach(c => walk(c, depth + 1, id));
  })(outline, 0, null);
  return {nodes, edges, layout: 'tree'};
}

const PASS_COLOR = k => PAL[Object.keys(PASS_LABEL).indexOf(k) % PAL.length];
const SAFETY = {auto: ['green', 'Auto-applied (safe)'], suggested: ['orange', 'Suggestion – needs approval'], manual: ['pink', 'Manual verification']};

/* Helper to parse TAC instructions into Compiler Construction Quadruples */
function parseTacQuadruples(text) {
  const lines = (text || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const quads = [];
  lines.forEach((line, idx) => {
    let op = '', arg1 = '–', arg2 = '–', res = '–';
    if (line.includes(':') && !line.includes('=')) {
      op = 'LABEL'; arg1 = line.replace(':', '');
    } else if (line.startsWith('goto ')) {
      op = 'GOTO'; res = line.replace('goto ', '').trim();
    } else if (line.startsWith('if ')) {
      const parts = line.replace('if ', '').split(' goto ');
      op = 'IF_GOTO'; arg1 = parts[0] || '–'; res = parts[1] || '–';
    } else if (line.startsWith('return')) {
      op = 'RETURN'; arg1 = line.replace('return', '').trim() || '–';
    } else if (line.includes('=')) {
      const sides = line.split('=').map(s => s.trim());
      res = sides[0];
      const rhs = sides[1] || '';
      const mBin = rhs.match(/^(\S+)\s*([\+\-\*\/\%\&\|\^\<\>]|\=\=|\!\=|\>\=|\<\=)\s*(\S+)$/);
      if (mBin) {
        op = mBin[2]; arg1 = mBin[1]; arg2 = mBin[3];
      } else {
        const mUn = rhs.match(/^(not|\-|\~)\s*(\S+)$/);
        if (mUn) {
          op = mUn[1]; arg1 = mUn[2];
        } else {
          op = 'ASSIGN'; arg1 = rhs;
        }
      }
    } else {
      op = 'OP'; arg1 = line;
    }
    quads.push([idx + 1, `<code>${esc(op)}</code>`, `<code>${esc(arg1)}</code>`, `<code>${esc(arg2)}</code>`, `<b><code>${esc(res)}</code></b>`]);
  });
  return quads;
}

/* ===== Dashboard ===== */
P.dashboard = async view => {
  let st = {programs: 0, optimizations: 0, avg_node_reduction_pct: 0, avg_time_improvement_pct: null, by_pass: {}}, hist = [];
  try { [st, hist] = await Promise.all([api('/api/stats', undefined, 'GET'), api('/api/history', undefined, 'GET')]); } catch (e) { toast(e.message, 'err'); }
  
  view.innerHTML = `
    <div class="grid g4">
      ${stat(st.programs, 'Programs analyzed', PAL[0])}
      ${stat(st.optimizations, 'Optimizations performed', PAL[3])}
      ${stat(fmt(st.avg_node_reduction_pct) + '%', 'Average code size reduction', PAL[4])}
      ${stat(st.avg_time_improvement_pct == null ? '–' : fmt(st.avg_time_improvement_pct) + '%', 'Average measured speedup', PAL[1])}
    </div>

    <!-- 3D Grand Compiler Factory Pipeline Studio Hero -->
    ${S3.on() ? `
    <div class="card" style="margin-top:18px">
      <div class="row">
        <div>
          <h3 style="margin:0">3D Compiler Execution Pipeline Studio</h3>
          <span class="muted" style="font-size:12.5px">Real-time 3D simulation of code travelling through all 8 compilation stages on the assembly line. Click any station or mechanism to inspect that phase.</span>
        </div>
      </div>
      ${slot('compilerPipeHero', 'tall')}
    </div>
    ` : ''}

    <!-- Compiler Architecture & Pipeline Stepper -->
    <div class="card" style="margin-top:18px">
      <div class="row">
        <div>
          <h3 style="margin:0">Compiler Architecture &amp; Execution Pipeline</h3>
          <span class="muted" style="font-size:12.5px">Click any phase to navigate directly into its compilation details and intermediate structures.</span>
        </div>
      </div>
      <div class="pipe-container" style="margin-top:14px">
        <div class="pipe-step" data-nav="compiler" data-tab="1">
          <div class="p-num">Phase 01</div>
          <div class="p-title">Lexer (Tokens)</div>
          <div class="p-desc">Token categories, keywords &amp; DFA</div>
        </div>
        <div class="pipe-step" data-nav="compiler" data-tab="2">
          <div class="p-num">Phase 02</div>
          <div class="p-title">Parser (AST)</div>
          <div class="p-desc">Abstract Syntax Tree &amp; 3D hierarchy</div>
        </div>
        <div class="pipe-step" data-nav="compiler" data-tab="3">
          <div class="p-num">Phase 03</div>
          <div class="p-title">Semantic Analyzer</div>
          <div class="p-desc">Symbol tables, scopes &amp; diagnostics</div>
        </div>
        <div class="pipe-step" data-nav="compiler" data-tab="4">
          <div class="p-num">Phase 04</div>
          <div class="p-title">TAC IR &amp; CFG</div>
          <div class="p-desc">Three-Address Code &amp; basic blocks</div>
        </div>
        <div class="pipe-step" data-nav="compiler" data-tab="6">
          <div class="p-num">Phase 05</div>
          <div class="p-title">SSA Form</div>
          <div class="p-desc">Dominance frontiers &amp; φ-functions</div>
        </div>
        <div class="pipe-step" data-nav="results">
          <div class="p-num">Phase 06</div>
          <div class="p-title">Pass Manager</div>
          <div class="p-desc">10 Iterative optimization passes</div>
        </div>
        <div class="pipe-step" data-nav="compare">
          <div class="p-num">Phase 07</div>
          <div class="p-title">Code Gen &amp; Diff</div>
          <div class="p-desc">AST unparsing &amp; side-by-side diff</div>
        </div>
        <div class="pipe-step" data-nav="compare">
          <div class="p-num">Phase 08</div>
          <div class="p-title">Validation</div>
          <div class="p-desc">Differential testing &amp; sandbox checks</div>
        </div>
      </div>
    </div>

    <!-- Quick Compiler Benchmark Presets -->
    <div class="card" style="margin-top:18px">
      <h3 style="margin-bottom:8px">Compiler Feature Demonstration Presets</h3>
      <p class="muted" style="margin-bottom:14px">One-click test programs demonstrating specific compiler optimization and algorithmic analysis capabilities:</p>
      <div class="row">
        <button class="btn ghost" id="qsSmall">⚡ Full Optimization Suite (demo_small.py)</button>
        <button class="btn ghost" id="qsConst">🔢 Constant Folding &amp; DCE</button>
        <button class="btn ghost" id="qsLicm">🔄 LICM &amp; CSE Expressions</button>
        <button class="btn ghost" id="qsMemo">🧠 Recursion &amp; Memoization</button>
        <button class="btn ghost" id="qsLarge">📚 1200+ Line Compiler Stress Test</button>
        <span class="sp"></span>
        <a class="btn primary" href="#editor">✏️ Open Code Editor</a>
      </div>
    </div>

    <div class="grid g2" style="margin-top:18px">
      ${card('Optimization Pass Distribution', Object.keys(st.by_pass).length ? vslot('chDist', 'short', 230) : '<p class="muted">Optimize a program to visualize pass distribution.</p>')}
      ${card('Recent Optimization Runs', hist.length ? table(['File', 'Applied', 'Size Reduction', 'Complexity Shift'], hist.slice(0, 6).map(h => [esc(h.filename), h.applied, fmt(h.node_reduction_pct) + '%', `${esc(h.orig_time)}<span class="arrow">→</span>${esc(h.opt_time)}`])) : '<p class="muted">No optimization history yet. Try running an optimization!</p>')}
    </div>
  `;

  // Pipeline step click handlers
  $$('.pipe-step', view).forEach(step => {
    step.onclick = async () => {
      const nav = step.dataset.nav;
      if (step.dataset.tab) P._ctab = +step.dataset.tab;
      const f = file();
      if (nav === 'compiler' || nav === 'cfg') {
        if (f && f.code && !f.analysis) await doAnalyze(true);
      } else if (nav === 'results' || nav === 'compare') {
        if (f && f.code && !f.opt) await doOptimize();
      }
      location.hash = '#' + nav;
    };
  });

  if (S3.on()) {
    viz('compilerPipeHero', el => S3.compilerFactory(el, {
      onSelectStage: async (stageId) => {
        const stageMap = {
          lexer: ['compiler', 1],
          parser: ['compiler', 2],
          semantic: ['compiler', 3],
          ir: ['compiler', 4],
          ssa: ['compiler', 6],
          opt: ['results', 0],
          codegen: ['compare', 0],
          validate: ['compare', 0]
        };
        const target = stageMap[stageId] || ['compiler', 0];
        P._ctab = target[1];
        const f = file();
        if (target[0] === 'compiler' && f && f.code && !f.analysis) {
          await doAnalyze(true);
        } else if (['results', 'compare'].includes(target[0]) && f && f.code && !f.opt) {
          await doOptimize();
        }
        location.hash = '#' + target[0];
      }
    }));
  }

  const keys = Object.keys(st.by_pass);
  if (keys.length) dc('chDist', el => S3.pie(el, {items: keys.map(k => ({label: PASS_LABEL[k] || k, value: st.by_pass[k], color: PASS_COLOR(k)}))}), {type: 'doughnut', data: {labels: keys.map(k => PASS_LABEL[k] || k), datasets: [{data: keys.map(k => st.by_pass[k]), backgroundColor: keys.map(PASS_COLOR)}]}, options: {plugins: {legend: {position: 'right'}}}});

  const loadSample = async n => {
    const existingIndex = state.files.findIndex(x => x.name === n);
    if (existingIndex >= 0) {
      state.active = existingIndex;
    } else {
      const s = await api('/api/sample/' + n, undefined, 'GET');
      state.files.push({name: n, code: s.code});
      state.active = state.files.length - 1;
    }
    store.save();
    doAnalyze(true).catch(() => {});
    location.hash = '#editor';
  };

  $('#qsSmall').onclick = () => loadSample('demo_small.py').catch(e => toast(e.message, 'err'));
  $('#qsConst').onclick = () => loadSample('demo_const_fold.py').catch(e => toast(e.message, 'err'));
  $('#qsLicm').onclick = () => loadSample('demo_licm_cse.py').catch(e => toast(e.message, 'err'));
  $('#qsMemo').onclick = () => loadSample('demo_recursion_memo.py').catch(e => toast(e.message, 'err'));
  $('#qsLarge').onclick = () => loadSample('demo_large.py').catch(e => toast(e.message, 'err'));
};

/* ===== Code editor ===== */
P.editor = async view => {
  const f = file(); const original = f.code;
  view.innerHTML = `<div class="card">
    <div style="margin-bottom:18px"><div class="row" style="margin-bottom:6px"><div><h2 style="margin:0">Optimize Python code</h2><p class="muted" style="margin:4px 0 0">Paste or edit a file, run safe transformations, then review and download the result.</p></div><span class="sp"></span><button class="btn primary" id="op">⚡ Optimize code</button></div>
    <div class="row" style="margin-top:12px">
    <button class="btn ghost" id="pasteToggle" type="button" aria-expanded="false">📋 Paste code</button>
    <label class="btn">📂 Open .py file<input type="file" id="up" accept=".py,text/x-python,text/plain" multiple hidden></label>
    <select id="samp"><option value="">Try an example…</option></select><button class="btn ghost" id="an">🔍 Analyze</button>
    <details class="project-tools" style="margin-left:auto"><summary class="btn">Project tools ▾</summary><div class="project-tools-menu"><label class="btn">🗂 Open project folder<input type="file" id="upProject" webkitdirectory directory multiple hidden></label><button class="btn" id="newF">＋ New file</button><button class="btn orange" id="projectOptimize">Optimize project</button><button class="btn teal" id="projectDownload">⬇ Project ZIP</button><button class="btn pink" id="cancelProject" hidden>Cancel run</button></div></details>
    <button class="btn" id="clr" title="Clear the active file">Clear</button><button class="btn" id="rst" title="Restore the code from when this screen opened">Reset</button></div></div>
    <section class="card hidden" id="pastePanel" aria-label="Paste Python code" style="margin:0 0 14px;background:#F8FAFC">
      <h3 style="margin:0 0 6px">Paste Python code</h3>
      <p class="muted" style="margin:0 0 10px">Paste with Ctrl+V (or ⌘+V on Mac), then choose Use pasted code to replace the active file.</p>
      <textarea id="pasteInput" rows="12" spellcheck="false" placeholder="Paste your Python code here…" style="width:100%;font-family:var(--mono);font-size:12px;resize:vertical"></textarea>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="pasteCancel" type="button">Cancel</button><button class="btn primary" id="pasteApply" type="button">Use pasted code</button></div>
    </section>
    <div class="chips" id="chips"></div><div class="editor-box" id="edBox"></div>
    <div class="row muted" style="margin-top:10px" id="live"></div></div>`;
  const chips = () => { $('#chips').innerHTML = state.files.map((x, i) => `<span class="chip ${i === state.active ? 'on' : ''}" data-i="${i}">${esc(x.name)} <x data-x="${i}" title="Remove">✕</x></span>`).join(''); };
  const live = code => { const lines = code ? code.split('\n').length : 0; const defs = (code.match(/^\s*(async\s+)?def\s/gm) || []).length, cls = (code.match(/^\s*class\s/gm) || []).length;
    $('#live').innerHTML = `<span class="badge">${lines} lines</span><span class="badge teal">${code.length} chars</span><span class="badge purple">${defs} functions</span><span class="badge pink">${cls} classes</span>${f.analysis && stale(f) ? '<span class="badge orange">edited since last analysis</span>' : ''}`; };
  chips(); live(f.code);
  let ed = null;
  $('#pasteToggle').onclick = () => {
    const panel = $('#pastePanel'), opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening); $('#pasteToggle').setAttribute('aria-expanded', String(opening));
    if (opening) $('#pasteInput').focus();
  };
  $('#pasteCancel').onclick = () => { $('#pastePanel').classList.add('hidden'); $('#pasteToggle').setAttribute('aria-expanded', 'false'); };
  $('#pasteApply').onclick = () => {
    const code = $('#pasteInput').value.replace(/\r\n/g, '\n');
    if (!code.trim()) { toast('Paste some Python code first.', 'warn'); $('#pasteInput').focus(); return; }
    if (code.length > 3_000_000) { toast('Pasted code exceeds the 3 MB per-file limit.', 'warn'); return; }
    f.code = code; if (ed) ed.set(code); f.analysis = null; f.analysisCode = null; f.opt = null; f.optCode = null; f.bench = null; f.validation = null;
    live(code); store.save(); $('#pasteInput').value = ''; $('#pastePanel').classList.add('hidden'); $('#pasteToggle').setAttribute('aria-expanded', 'false');
    toast(`Pasted ${code.split('\n').length} lines into ${f.name}. Run Analyze or Optimize when ready.`, 'ok');
  };
  ed = await createEditor($('#edBox'), f.code, {onChange: v => { f.code = v; live(v); }});
  if (ed.get() !== f.code) ed.set(f.code);
  P._editor = ed; P._editorFile = f;
  chips(); $('#chips').onclick = e => { const x = e.target.closest('[data-x]'); const c = e.target.closest('[data-i]');
    if (x) { syncEditorToFile(); state.files.splice(+x.dataset.x, 1); ensureFile(); state.active = Math.min(state.active, state.files.length - 1); store.save(); render(); }
    else if (c) { syncEditorToFile(); state.active = +c.dataset.i; store.save(); render(); } };
  $('#up').onchange = async e => {
    for (const fl of e.target.files) {
      const code = await fl.text();
      if (state.files.length === 1 && !state.files[0].code.trim()) state.files[0] = {name: fl.name, code};
      else state.files.push({name: fl.name, code});
    }
    state.active = state.files.length - 1; store.save(); toast(`${e.target.files.length} file(s) loaded`, 'ok'); render();
  };
  $('#upProject').onchange = async e => {
    const selected = [...e.target.files], excluded = /(^|\/)(\.git|\.venv|venv|env|node_modules|__pycache__|dist|build)(\/|$)/i;
    const pyFiles = selected.filter(x => x.name.toLowerCase().endsWith('.py') && !excluded.test(x.webkitRelativePath || x.name));
    if (!pyFiles.length) { toast('The selected folder contains no Python source files.', 'warn'); return; }
    if (pyFiles.length > 100 || pyFiles.reduce((n, x) => n + x.size, 0) > 8 * 1024 * 1024) { toast('Choose a project with at most 100 Python files and 8 MB of source.', 'warn'); return; }
    try {
      const projectFiles = await Promise.all(pyFiles.map(async x => ({name: (x.webkitRelativePath || x.name).replace(/^[^/]+\//, ''), code: await x.text(), project: true, analysis: null, opt: null, bench: null, validation: null})));
      const projectNames = new Set(projectFiles.map(x => x.name));
      state.files = state.files.filter(x => !x.project && !projectNames.has(x.name));
      state.files.push(...projectFiles);
      state.active = state.files.findIndex(x => x.project);
      const persisted = pyFiles.reduce((n, x) => n + x.size, 0) <= 1_500_000 && store.save(); refreshFileSel(); toast(`Loaded ${projectFiles.length} Python modules. Use Optimize project to process the project files together.${persisted ? '' : ' This project is kept in this tab’s memory; download its ZIP before closing the tab.'}`, persisted ? 'ok' : 'warn'); render();
    } catch (err) { toast(`Could not read the project folder: ${err.message}`, 'err'); }
  };
  $('#newF').onclick = () => { syncEditorToFile(); state.files.push({name: `untitled${state.files.length + 1}.py`, code: ''}); state.active = state.files.length - 1; render(); };
  $('#clr').onclick = () => { ed.set(''); f.code = ''; f.analysis = null; f.opt = null; f.bench = null; f.validation = null; live(''); };
  $('#rst').onclick = () => { ed.set(original); f.code = original; f.analysis = null; f.opt = null; f.bench = null; f.validation = null; live(original); };
  try {
    const list = await api('/api/samples', undefined, 'GET');
    $('#samp').innerHTML = '<option value="">Load sample preset…</option>' + list.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  } catch (e) {}
  $('#samp').onchange = async e => {
    if (!e.target.value) return;
    const s = await api('/api/sample/' + e.target.value, undefined, 'GET');
    ed.set(s.code); f.code = s.code; f.name = s.name;
    f.analysis = null; f.opt = null; f.bench = null; f.validation = null;
    refreshFileSel(); chips(); live(s.code); store.save();
    toast('Loaded ' + s.name, 'ok');
  };
  $('#an').onclick = async () => { if (await doAnalyze()) { location.hash = '#compiler'; } };
  $('#op').onclick = async () => { if (await doOptimize()) { location.hash = '#results'; } };
  let cancelProject = false;
  $('#cancelProject').onclick = () => { cancelProject = true; $('#cancelProject').disabled = true; toast('Project run will stop after the current module finishes.', 'warn'); };
  $('#projectOptimize').onclick = async () => {
    syncEditorToFile();
    const targets = state.files.filter(x => x.project).length ? state.files.filter(x => x.project) : state.files;
    const modules = targets.filter(x => x.name.toLowerCase().endsWith('.py'));
    if (!modules.length || modules.every(x => !x.code.trim())) { toast('Load a Python project folder or add Python files first.', 'warn'); return; }
    const bytes = modules.reduce((n, x) => n + new TextEncoder().encode(x.code).byteLength, 0);
    if (modules.length > 100 || bytes > 8 * 1024 * 1024) { toast('Project mode supports up to 100 Python files and 8 MB of source per run.', 'warn'); return; }
    setStatus(`Optimizing ${modules.length} project modules…`, 'busy');
    const done = progress('Optimizing project modules…', ['Preparing project modules…', 'Analyzing and optimizing each Python file…', 'Saving per-file reports…']);
    cancelProject = false; $('#cancelProject').hidden = false; $('#cancelProject').disabled = false; $('#projectOptimize').disabled = true;
    try {
      const results = [];
      for (let i = 0; i < modules.length; i++) {
        if (cancelProject) break;
        done.update(`Optimizing module ${i + 1} of ${modules.length}: ${modules[i].name}`);
        setStatus(`Optimizing ${i + 1}/${modules.length}: ${modules[i].name}`, 'busy');
        try {
          const result = await api('/api/project/optimize', {files: [{filename: modules[i].name, code: modules[i].code}], settings: state.settings});
          const item = result.files[0]; results.push(item);
          if (item && !item.error) { modules[i].opt = item; modules[i].optCode = modules[i].code; modules[i].bench = null; modules[i].validation = null; }
        } catch (err) { results.push({filename: modules[i].name, error: err.message}); }
      }
      const persisted = bytes <= 1_500_000 && store.save();
      const succeeded = results.filter(x => !x.error).length, failed = results.filter(x => x.error).length;
      setStatus(`${cancelProject ? 'Project run stopped' : 'Project processed'}: ${succeeded} optimized, ${failed} with errors`, failed ? 'ready' : 'opt');
      const first = results.find(x => !x.error);
      if (first) { state.active = state.files.indexOf(modules.find(x => x.name === first.filename)); store.save(); refreshFileSel(); }
      const failures = results.filter(x => x.error).slice(0, 4).map(x => `${x.filename}: ${x.error}`).join(' · ');
      toast(`${cancelProject ? 'Stopped' : 'Finished'} project optimization: ${succeeded}/${results.length} modules completed.${persisted ? '' : ' Download the ZIP before closing this tab.'}${failures ? ` Errors: ${failures}` : ''}`, failed || cancelProject || !persisted ? 'warn' : 'ok');
      if (first) location.hash = '#results';
    } catch (err) { setStatus('Project optimization stopped', 'err'); toast(err.message, 'err'); }
    finally { done(); $('#cancelProject').hidden = true; $('#projectOptimize').disabled = false; }
  };
  $('#projectDownload').onclick = async () => {
    syncEditorToFile();
    const doneFiles = state.files.filter(x => x.opt && (!state.files.some(m => m.project) || x.project));
    if (!doneFiles.length) { toast('Optimize the project first, then download its modules.', 'warn'); return; }
    try {
      const response = await fetch('/api/download_zip', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({files: doneFiles.map(x => ({name: `optimized_project/${x.name}`, code: x.opt.optimized}))})});
      if (!response.ok) throw new Error('The project archive could not be created.');
      download('optimized_project.zip', await response.blob(), 'application/zip');
    } catch (err) { toast(err.message, 'err'); }
  };
};

/* ===== Compiler analysis ===== */
function treeHtml(n) { const kids = n.children || []; return kids.length ? `<details open><summary>${esc(n.label)} ${n.line ? `<span class="ln">L${n.line}</span>` : ''}</summary><ul>${kids.map(k => `<li>${treeHtml(k)}</li>`).join('')}</ul></details>` : `<span>${esc(n.label)} ${n.line ? `<span class="ln">L${n.line}</span>` : ''}</span>`; }
function symRows(t, out = []) { out.push(`<h4 style="margin:14px 0 6px">${esc(t.type)} <code>${esc(t.name)}</code> <span class="muted">line ${t.lineno}</span></h4>` + (t.symbols.length ? table(['Name', 'Flags'], t.symbols.map(s => [`<code>${esc(s.name)}</code>`, s.flags.map(x => `<span class="badge">${x}</span>`).join(' ')])) : '')); t.children.forEach(c => symRows(c, out)); return out; }

P.compiler = async view => {
  const f = file(); if (!f.analysis) return needs(view, 'an');
  const a = f.analysis, tabs = ['Overview', 'Tokens', 'AST', 'Symbols', 'IR (TAC)', 'Data-flow', 'SSA']; let cur = P._ctab || 0;
  const body = () => {
    const box = $('#tabBody');
    if (cur === 0) {
      const s = a.stats, sm = a.semantic;
      box.innerHTML = `
        <div class="grid g4">
          ${stat(s.lines, 'Lines of source code', PAL[0])}
          ${stat(s.functions, 'Functions declared', PAL[1])}
          ${stat(s.loops, 'Loops (for / while)', PAL[2])}
          ${stat(a.ast.total_nodes, 'AST syntax nodes', PAL[4])}
        </div>
        <div class="card" style="margin-top:18px">
          <h3>Compiler Phase Status</h3>
          <div class="row">
            <span class="badge green">✓ Lexical: ${a.tokens.rows.length} tokens categorized</span>
            <span class="badge green">✓ Parsing: AST Depth ${a.ast.max_depth || '–'}</span>
            <span class="badge green">✓ Scopes: ${Object.keys(a.cfg).length} scope(s) identified</span>
            <span class="badge green">✓ TAC IR: ${a.ir.length} scope TAC blocks generated</span>
            <span class="badge purple">✓ SSA: φ-functions placed at dominance frontiers</span>
          </div>
        </div>
        <div class="grid g2" style="margin-top:18px">
          ${card('Semantic Issues &amp; Diagnostics', `<p><span class="badge pink">${sm.undefined_names.length} undefined names</span> <span class="badge orange">${sm.unused_imports.length} unused imports</span> <span class="badge teal">${sm.unused_variables.length} unused variables</span></p>
            ${table(['Kind', 'Identifier', 'Line'], [...sm.undefined_names.map(x => ['undefined', `<code>${esc(x.name)}</code>`, x.lineno || '']), ...sm.unused_imports.map(x => ['unused import', `<code>${esc(x.name)}</code>`, x.lineno]), ...sm.unused_variables.map(x => ['unused variable', `<code>${esc(x.name)}</code> <span class="muted">in ${esc(x.scope)}</span>`, x.lineno])]) }`)}
          ${card('Function Signatures &amp; Type Annotations', table(['Function', 'Parameters', 'Return Type', 'Line'], sm.functions.slice(0, 80).map(x => [`<code>${esc(x.name)}</code>`, esc(x.params.map(p => p + (x.annotations[p] ? ': ' + x.annotations[p] : '')).join(', ') || 'none'), esc(x.returns || 'inferred'), x.lineno]))) }
        </div>
      `;
    }
    if (cur === 1) {
      const t = a.tokens;
      box.innerHTML = `
        ${S3.on() ? card('3D Lexical DFA State Machine Automaton (Scanner)', slot('dfa3d', 'tall')) + '<div style="height:16px"></div>' : ''}
        ${card('Token Distribution', `<div class="row" style="margin-bottom:12px">${Object.entries(t.counts).map(([k, v], i) => `<span class="badge ${['', 'green', 'orange', 'purple', 'pink', 'teal'][i % 6]}">${k}: ${v}</span>`).join('')}</div>${vslot('chTok', 'short', 90)}`)}
        <div style="height:16px"></div>
        ${card(`Lexical Token Stream${t.truncated ? ' (showing first 400)' : ''}`, table(['Line', 'Col', 'Type', 'Lexeme / Text'], t.rows.map(r => [r.line, r.col, `<span class="badge">${r.type}</span>`, `<code>${esc(r.text)}</code>`])))}
      `;
      if (S3.on()) viz('dfa3d', el => S3.dfaVisualizer(el));
      dc('chTok', el => S3.bars(el, {labels: Object.keys(t.counts), series: [{name: 'Tokens', color: PAL[0], values: Object.values(t.counts)}], unit: 'tokens'}), {type: 'bar', data: {labels: Object.keys(t.counts), datasets: [{data: Object.values(t.counts), backgroundColor: PAL}]}, options: {plugins: {legend: {display: false}}}});
    }
    if (cur === 2) {
      box.innerHTML = `
        ${S3.on() ? card('3D Syntax Tree Hierarchy – Statements (Prisms) vs Expressions (Capsules) vs Identifiers (Spheres)', slot('ast3d', 'tall')) + '<div style="height:16px"></div>' : ''}
        <div class="grid g2">
          ${card('Construct Classification', table(['Construct Type', 'Count'], Object.entries(a.ast.structure).map(([k, v]) => [k, `<b>${v}</b>`])))}
          ${card('Most Frequent AST Node Types', table(['Node Type', 'Count'], Object.entries(a.ast.node_counts).map(([k, v]) => [`<code>${k}</code>`, `<b>${v}</b>`])))}
        </div>
        <div style="height:16px"></div>
        ${card('Abstract Syntax Tree Outline', `
          <div class="row" style="margin-bottom:10px">
            <input type="text" id="astSearch" placeholder="Filter AST nodes (e.g. FunctionDef, BinOp)..." style="min-width:280px">
            <button class="btn sm" id="expAll">Expand All</button>
            <button class="btn sm" id="colAll">Collapse All</button>
          </div>
          <div class="tree scroll" id="astTreeWrap" style="max-height:480px">${treeHtml(a.ast.outline)}</div>
        `)}
      `;
      let ast3dInst = null;
      if (S3.on()) {
        viz('ast3d', el => {
          ast3dInst = S3.graph(el, astGraph(a.ast.outline));
          return ast3dInst;
        });
      }
      $('#expAll').onclick = () => $$('#astTreeWrap details').forEach(d => d.open = true);
      $('#colAll').onclick = () => $$('#astTreeWrap details').forEach(d => d.open = false);
      $('#astTreeWrap').addEventListener('click', e => {
        const summary = e.target.closest('summary'); if (!summary || !window.ProjectGuide) return;
        const label = summary.textContent.replace(/\s+/g, ' ').trim();
        const type = label.match(/^[A-Za-z_][A-Za-z_0-9]*/)?.[0] || label;
        ProjectGuide.node(type, label);
      });
      $('#astSearch').oninput = e => {
        const q = e.target.value.toLowerCase();
        $$('#astTreeWrap details').forEach(d => {
          const m = !q || d.textContent.toLowerCase().includes(q);
          d.style.display = m ? '' : 'none';
          if (q && m) d.open = true;
        });
        if (ast3dInst && ast3dInst.searchAndFly) {
          ast3dInst.searchAndFly(q);
        }
      };
    }
    if (cur === 3) box.innerHTML = card('Symbol Table &amp; Scopes', symRows(a.semantic.symbol_table).join(''));
    if (cur === 4) {
      box.innerHTML = a.ir.map(s => {
        const quads = parseTacQuadruples(s.text);
        return card(`Three-Address Code (TAC) &amp; Quadruples – Scope <code>${esc(s.scope)}</code>`, `
          <div class="grid g2" style="grid-template-columns:1fr 1fr">
            <div>
              <b>Linear TAC Code</b>
              <pre style="max-height:360px;margin-top:8px">${esc(s.text)}</pre>
            </div>
            <div>
              <b>Decomposed Quadruples (Op, Arg1, Arg2, Result)</b>
              <div class="scroll" style="max-height:360px;margin-top:8px">
                ${table(['#', 'Op', 'Arg 1', 'Arg 2', 'Result'], quads)}
              </div>
            </div>
          </div>
        `);
      }).join('<div style="height:14px"></div>');
    }
    if (cur === 5) {
      box.innerHTML = `
        <div class="card" style="margin-bottom:14px;background:#F8FAFC;border:1px solid #E2E8F0">
          <h4 style="margin:0 0 6px">Data-Flow Lattice Equations (Iterative Worklist Solver)</h4>
          <p class="muted" style="margin:0;font-size:12.5px">
            <b>Live Variables:</b> <code>IN[B] = GEN[B] ∪ (OUT[B] - KILL[B])</code> &nbsp;|&nbsp; <code>OUT[B] = ⋃ {IN[S] | S ∈ succ(B)}</code><br>
            <b>Reaching Definitions:</b> <code>OUT[B] = GEN[B] ∪ (IN[B] - KILL[B])</code> &nbsp;|&nbsp; <code>IN[B] = ⋃ {OUT[P] | P ∈ pred(B)}</code>
          </p>
        </div>
      ` + Object.entries(a.dataflow).map(([k, d]) => card(`Data-Flow Analysis: Scope <code>${esc(k)}</code>`, `<p class="muted">Fixed-point worklist iterations converged over ${d.block_count || 0} reachable basic blocks.</p>${table(['Block', 'Live In', 'Live Out', 'Reaching Defs (var: line)', 'Available Expr', 'Known Constants'], (d.blocks || []).map(b => [b.block, esc(b.live_in.join(', ')), esc(b.live_out.join(', ')), esc(Object.entries(b.reaching).map(([v, l]) => v + ': ' + l.join('/')).join('; ')), esc(b.available.join('; ')), esc(Object.entries(b.constants).map(([k2, v]) => k2 + '=' + v).join(', '))]))}
        ${(d.constant_uses || []).length ? '<h4 style="margin-top:14px">Constant Uses Discovered</h4>' + table(['Line', 'Variable', 'Substituted Value'], d.constant_uses.slice(0, 40).map(c => [c.line, `<code>${c.var}</code>`, `<code>${c.value}</code>`])) : ''}`)).join('<div style="height:14px"></div>');
    }
    if (cur === 6) {
      box.innerHTML = Object.entries(a.ssa).map(([k, s]) => card(`Static Single Assignment (SSA) – Scope <code>${esc(k)}</code> <span class="badge purple">${s.phi_count} φ-functions</span>`, `
        <div class="card" style="margin-bottom:12px;background:#F8FAFC;border:1px solid #E2E8F0">
          <b>Dominance Frontier &amp; φ-Placement:</b> φ-nodes are placed at the iterated dominance frontier <code>IDF(Defs(v))</code> where multiple control paths converge with conflicting versions.
        </div>
        <pre>${esc((s.blocks || []).map(b => b.block + ':\n' + b.lines.map(l => '    ' + l).join('\n')).join('\n'))}</pre>
      `)).join('<div style="height:14px"></div>');
    }
  };
  view.innerHTML = `${stale(f) ? '<div class="card" style="margin-bottom:14px;border-left:5px solid var(--orange)">The code was edited after this analysis. <button class="btn sm" id="reAn">Re-analyze</button></div>' : ''}<div class="tabs">${tabs.map((t, i) => `<button class="${i === cur ? 'on' : ''}" data-i="${i}">${t}</button>`).join('')}</div><div id="tabBody"></div>`;
  $$('.tabs button').forEach(b => b.onclick = () => { cur = P._ctab = +b.dataset.i; $$('.tabs button').forEach(x => x.classList.toggle('on', x === b)); destroyCharts(); body(); if (window.ProjectGuide) ProjectGuide.explain(`Compiler Analysis ${b.textContent.trim()} selected. ${cur === 0 ? 'Overview summarizes source size, functions, loops, compiler phase status, and diagnostics.' : cur === 1 ? 'Tokens are the names, keywords, operators, punctuation, and literals recognized by the lexer.' : cur === 2 ? 'The AST shows nested syntax nodes produced by parsing.' : cur === 3 ? 'The symbol table organizes names by scope and shows their roles and usage flags.' : cur === 4 ? 'Three-address code breaks expressions into simpler intermediate instructions; quadruples list each operation and its operands.' : cur === 5 ? 'Data-flow analysis propagates facts such as live variables, reaching definitions, available expressions, and known constants across control-flow blocks.' : 'SSA assigns a distinct version to each assignment; phi functions merge versions where paths join.'}`, 'speak', {noCaption: true}); });
  const re = $('#reAn'); if (re) re.onclick = async () => { if (await doAnalyze()) render(); };
  body();
};

/* ===== Control flow graph ===== */
P.cfg = async view => {
  const f = file(); if (!f.analysis) return needs(view, 'an');
  const keys = Object.keys(f.analysis.cfg); let sel = P._cfgScope && keys.includes(P._cfgScope) ? P._cfgScope : keys[0];
  let cfgMode = P._cfgMode || (S3.on() ? '3d' : '2d');
  let current3dLayout = 'tower';
  
  view.innerHTML = `
    <div class="card">
      <div class="row" style="margin-bottom:12px">
        <b>Scope</b>
        <select id="scopeSel">${keys.map(k => `<option ${k === sel ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
        <span id="cfgMeta" class="muted"></span>
        <span class="sp"></span>
        ${cfgMode === '3d' ? `
          <button class="btn sm ghost" id="domToggle">🌳 Switch to Dominator Tree</button>
          <button class="btn sm ghost" id="simPlay">▶ Play</button>
          <button class="btn sm ghost" id="simPause">⏸ Pause</button>
          <button class="btn sm ghost" id="simStep">⏭ Step</button>
          <button class="btn sm ghost" id="simReset">⏮ Reset</button>
        ` : ''}
        <button class="btn sm ghost" id="toggleCfgMode">${cfgMode === '3d' ? '📊 Switch to 2D Graph' : '🗼 Switch to 3D Tower'}</button>
        <button class="btn sm" id="fit">Fit view</button>
      </div>
      <div class="legend">
        <span><i style="background:#059669"></i>entry</span>
        <span><i style="background:#E11D48"></i>exit</span>
        <span><i style="background:#7C3AED"></i>loop header</span>
        <span><i style="background:#A78BFA"></i>loop body</span>
        <span><i style="background:#D97706"></i>branch</span>
        <span><i style="background:#94A3B8"></i>unreachable</span>
        <span><i style="background:#16a34a;height:3px;margin-top:5px"></i>true branch</span>
        <span><i style="background:#f97316;height:3px"></i>false branch</span>
        <span><i style="background:#7c3aed;height:3px"></i>back edge</span>
      </div>
      <div id="cfgSimStatus" style="margin:8px 0 12px;padding:8px 12px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0;font-size:12.5px">
        <b>Program Counter (PC):</b> Ready. Use the [▶ Play] or [⏭ Step] buttons to simulate instruction traversal.
      </div>
      <div class="grid g2" style="grid-template-columns:2fr 1fr">
        <div id="cfgViewportWrap">
          ${cfgMode === '3d' ? slot('cy3d', 'tall') : '<div id="cy" style="height:560px;border:1px solid var(--line);border-radius:12px;background:#fff"></div>'}
        </div>
        <div>
          <h3>Selected Basic Block</h3>
          <div id="blk" class="muted">Click any block to inspect its instructions, dominator, and control properties.</div>
          <h3 style="margin-top:20px">Loop Detection &amp; Dead Blocks</h3>
          <div id="loops"></div>
        </div>
      </div>
    </div>
  `;

  const info = (n) => {
    $('#blk').innerHTML = n ? `
      <p><b>${esc(n.label)}</b> ${n.reach ? '<span class="badge green">reachable</span>' : '<span class="badge pink">unreachable</span>'}</p>
      <p class="muted">Immediate dominator: <b>${esc(n.idom || '–')}</b></p>
      <pre style="max-height:260px">${esc(n.instrs.join('\n') || '(empty block)')}</pre>
    ` : 'Click any block to inspect its instructions, dominator, and control properties.';
  };

  const updateSideInfo = (d) => {
    $('#cfgMeta').textContent = `${d.blocks} blocks, ${d.loops.length} loop(s)${d.graph.truncated ? ' – showing first 300 blocks' : ''}`;
    $('#loops').innerHTML = (d.loops.map(l => `<p><span class="badge purple">loop</span> header ${l.header}: ${esc(l.blocks.join(', '))}</p>`).join('') || '<p class="muted">No loops detected.</p>') +
      (d.unreachable.length ? `<p><span class="badge pink">unreachable</span> ${esc(d.unreachable.join(', '))}</p>` : '<p class="muted">No unreachable blocks.</p>');
  };

  if (cfgMode === '3d' && S3.on()) {
    const KC = {entry: '#059669', exit: '#E11D48', 'loop-header': '#7C3AED', 'loop-body': '#A78BFA', branch: '#D97706', unreachable: '#94A3B8'};
    let g3 = null;
    const draw3 = () => {
      const d = f.analysis.cfg[sel], g = d.graph;
      updateSideInfo(d);
      const byId = {};
      const nodes = g.nodes.map(x => {
        const cl = (x.classes || '').split(' '), kind = ['unreachable', 'loop-header', 'entry', 'exit', 'branch', 'loop-body'].find(k => cl.includes(k)), nm = x.data.label.split('\n')[0], n = x.data.instrs.length;
        byId[x.data.id] = {label: nm, instrs: x.data.instrs, idom: x.data.idom, reach: x.data.reachable};
        return {
          id: x.data.id,
          label: nm,
          color: KC[kind] || '#2563EB',
          idom: x.data.idom,
          dim: kind === 'unreachable',
          glow: ['entry', 'exit', 'loop-header'].includes(kind),
          size: [1.6, .55 + Math.min(n, 8) * .18, 1.6],
          tipTitle: nm + (kind ? ' · ' + kind : ''),
          tip: x.data.instrs.slice(0, 6).map(i => '<code>' + escTip(i.slice(0, 48)) + '</code>')
        };
      });
      const edges = g.edges.map(e => ({from: e.data.source, to: e.data.target, label: e.data.label, kind: ['back', 'true', 'false', 'exc'].find(k => (e.classes || '').split(' ').includes(k)) || 'seq'}));
      const entry = g.nodes.find(x => (x.classes || '').includes('entry'));
      if (g3) g3.dispose();
      g3 = S3.graph($('#cy3d'), {
        nodes,
        edges,
        layout: current3dLayout,
        root: entry ? entry.data.id : undefined,
        onSelect: n => {
          info(n && byId[n.id]);
          if (n && window.ProjectGuide) {
            const block = byId[n.id], idx = nodes.findIndex(x => x.id === n.id);
            ProjectGuide.block({...block, id: n.id}, sel, idx, nodes.length);
          }
        },
        onSimStep: ev => {
          $('#cfgSimStatus').innerHTML = `<b>Program Counter (PC):</b> <span class="badge yellow">Active: ${esc(ev.block ? ev.block.label || ev.block.id : '–')}</span> <span class="muted">${esc(ev.msg || '')}</span>`;
          if (window.ProjectGuide && ev.block && ev.step === 0) {
            const idx = nodes.findIndex(n => n.id === ev.block.id);
            ProjectGuide.block({...ev.block, instrs: ev.block.instrs || ev.block.tip || []}, sel, Math.max(0, idx), nodes.length);
          }
        }
      });
    };
    draw3();
    $('#scopeSel').onchange = e => { sel = P._cfgScope = e.target.value; draw3(); };
    $('#fit').onclick = () => g3 && g3.reset();

    const btnPlay = $('#simPlay'), btnPause = $('#simPause'), btnStep = $('#simStep'), btnReset = $('#simReset'), btnDom = $('#domToggle');
    if (btnPlay) btnPlay.onclick = () => { if (g3) g3.simPlay(); };
    if (btnPause) btnPause.onclick = () => { if (g3) g3.simPause(); };
    if (btnStep) btnStep.onclick = () => { if (g3) g3.simStep(); };
    if (btnReset) btnReset.onclick = () => { if (g3) g3.simReset(); };
    if (btnDom) btnDom.onclick = () => {
      current3dLayout = current3dLayout === 'tower' ? 'domtree' : 'tower';
      btnDom.textContent = current3dLayout === 'tower' ? '🌳 Switch to Dominator Tree' : '🗼 Switch to CFG Tower';
      if (g3) g3.setLayout(current3dLayout);
    };
  } else {
    const cytoscape = await ensureCy();
    if (!cytoscape) {
      $('#cy').innerHTML = '<div class="empty">Cytoscape.js is loading or offline. Run download_libs.py once to bundle offline.</div>';
    } else {
      let cy;
      const draw2 = () => {
        const d = f.analysis.cfg[sel], g = d.graph;
        updateSideInfo(d);
        if (cy) cy.destroy();
        cy = cytoscape({
          container: $('#cy'),
          elements: [...g.nodes, ...g.edges],
          wheelSensitivity: .3,
          layout: {name: 'breadthfirst', directed: true, spacingFactor: 1.25, padding: 24},
          style: [
            {selector: 'node', style: {shape: 'round-rectangle', 'background-color': '#FFFFFF', 'border-color': '#CBD5E1', 'border-width': 1.5, label: 'data(label)', 'text-wrap': 'wrap', 'text-max-width': 180, 'font-size': 10, 'text-valign': 'center', 'text-halign': 'center', width: 'label', height: 'label', padding: 10, color: '#0F172A', 'font-family': 'JetBrains Mono, monospace'}},
            {selector: '.entry', style: {'background-color': '#ECFDF5', 'border-color': '#059669', 'border-width': 2}},
            {selector: '.exit', style: {'background-color': '#FFF1F2', 'border-color': '#E11D48', 'border-width': 2}},
            {selector: '.branch', style: {'background-color': '#FFFBEB', 'border-color': '#D97706'}},
            {selector: '.loop-body', style: {'background-color': '#F5F3FF', 'border-color': '#A78BFA'}},
            {selector: '.loop-header', style: {'background-color': '#EDE9FE', 'border-color': '#7C3AED', 'border-width': 2.5}},
            {selector: '.unreachable', style: {'background-color': '#F8FAFC', 'border-color': '#CBD5E1', color: '#94A3B8', 'border-style': 'dashed'}},
            {selector: 'edge', style: {width: 2, 'line-color': '#94A3B8', 'target-arrow-color': '#94A3B8', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': 9, color: '#475569'}},
            {selector: 'edge.true', style: {'line-color': '#059669', 'target-arrow-color': '#059669'}},
            {selector: 'edge.false', style: {'line-color': '#D97706', 'target-arrow-color': '#D97706'}},
            {selector: 'edge.back', style: {'line-color': '#7C3AED', 'target-arrow-color': '#7C3AED', 'line-style': 'dashed'}},
            {selector: 'edge.exc', style: {'line-color': '#E11D48', 'target-arrow-color': '#E11D48', 'line-style': 'dotted'}},
            {selector: ':selected', style: {'border-width': 3, 'border-color': '#2563EB'}}
          ]
        });
        cy.on('tap', 'node', ev => {
          const n = ev.target.data();
          info({label: n.label.split('\n')[0], instrs: n.instrs || [], idom: n.idom, reach: n.reachable});
          if (window.ProjectGuide) ProjectGuide.block({id: n.id, label: n.label.split('\n')[0], instrs: n.instrs || [], idom: n.idom, reach: n.reachable}, sel, g.nodes.findIndex(x => x.data.id === n.id), g.nodes.length);
          cy.elements().removeClass('hl');
          ev.target.outgoers().addClass('hl');
        });
      };
      draw2();
      $('#scopeSel').onchange = e => { sel = P._cfgScope = e.target.value; draw2(); };
      $('#fit').onclick = () => cy && cy.fit();
    }
  }

  $('#toggleCfgMode').onclick = () => {
    P._cfgMode = cfgMode === '3d' ? '2d' : '3d';
    render();
  };
};

/* ===== Optimization results ===== */
P.results = async view => {
  const f = file(); if (!f.opt) return needs(view, 'opt'); const o = f.opt, s = o.summary;
  const passes = Object.keys(s.by_pass);
  view.innerHTML = `${f.optCode !== f.code ? '<div class="card" style="margin-bottom:14px;border-left:5px solid var(--orange)">The code changed after this optimization. <button class="btn sm" id="reOp">Re-optimize</button></div>' : ''}
  <div class="card" style="margin-bottom:14px;border-left:5px solid ${s.applied ? 'var(--green)' : 'var(--blue)'}"><div class="row"><div><h2 style="margin:0">${s.applied ? `${s.applied} safe transformation${s.applied === 1 ? '' : 's'} applied` : 'Optimization finished'}</h2><p class="muted" style="margin:4px 0 0">${s.applied ? 'Review the changes below. The original file is still available in the editor.' : 'No enabled transformation could safely change this code. It was left unchanged. Review the pass details and analysis for suggestions.'}</p></div><span class="sp"></span><button class="btn" id="backToCode">← Back to code</button><button class="btn primary" id="downloadOptimized">⬇ Download optimized file</button></div></div>
  <div class="grid g4">${stat(s.opportunities, 'Opportunities found', PAL[0])}${stat(s.applied, 'Changes applied', PAL[3])}${stat(`${o.lines.original} → ${o.lines.optimized}`, 'Lines of code', PAL[4])}${stat(`${o.complexity.original.time} → ${o.complexity.optimized.time}`, 'Estimated time complexity', PAL[1])}</div>
  
  <!-- 3D Interactive Transformation Laboratory -->
  ${S3.on() ? `
  <div class="card" style="margin-top:18px">
    <div class="row">
      <div>
        <h3 style="margin:0">3D Optimization Transformation Laboratory</h3>
        <span class="muted" style="font-size:12.5px">Interactive visual physics of compiler passes: watch Constant Folding merge constants, Dead Code dissolve, and LICM hoist loop invariants.</span>
      </div>
      <span class="sp"></span>
      <div class="row">
        <button class="btn sm ghost lab-btn on" data-lab="constant_folding">🔢 Constant Folding</button>
        <button class="btn sm ghost lab-btn" data-lab="dead_code">💀 Dead Code Elimination</button>
        <button class="btn sm ghost lab-btn" data-lab="licm">🔄 Loop-Invariant Motion (LICM)</button>
      </div>
    </div>
    ${slot('transLab3d', 'tall')}
  </div>
  ` : ''}

  <div class="grid g2" style="margin-top:18px">${card('Applied optimizations by pass', passes.length ? vslot('chPass', 'short', 200) : '<p class="muted">No safe optimizations were found in this program.</p>')}
  ${card('Pass manager', table(['Pass', 'Applied', 'Time'], Object.entries(o.passes).filter(([k, v]) => v.runs).map(([k, v]) => [PASS_LABEL[k] || k, v.applied + (v.rolled_back ? ` <span class="badge pink">${v.rolled_back} rolled back</span>` : ''), fmt(v.ms, 0) + ' ms'])) + `<p class="muted">Converged after ${s.iterations} iteration(s). Static validation: ${o.static_validation.ok ? '<span class="badge green">passed</span>' : '<span class="badge pink">failed</span>'}</p>`)}</div>
  <div class="card" style="margin-top:18px"><div class="row"><h3 style="margin:0">Transformations</h3><span class="sp"></span><input type="text" id="q" placeholder="Search…"><select id="pf"><option value="">All passes</option>${passes.map(p => `<option value="${p}">${esc(PASS_LABEL[p] || p)}</option>`).join('')}</select></div><div id="chg" style="margin-top:14px"></div></div>
  ${o.warnings.length ? card('Warnings', `<ul>${o.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`, '').replace('class="card "', 'class="card" style="margin-top:18px"') : ''}`;

  $('#backToCode').onclick = () => { location.hash = '#editor'; };
  $('#downloadOptimized').onclick = () => download(f.name.replace(/\.py$/, '') + '_optimized.py', o.optimized);

  if (S3.on()) {
    let labInst = null;
    viz('transLab3d', el => {
      labInst = S3.transformationLab(el, {passName: 'constant_folding'});
      return labInst;
    });
    $$('.lab-btn', view).forEach(btn => {
      btn.onclick = () => {
        $$('.lab-btn', view).forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        if (labInst && labInst.setMode) labInst.setMode(btn.dataset.lab);
      };
    });
  }

  if (passes.length) dc('chPass', el => S3.bars(el, {labels: passes.map(p => PASS_SHORT[p] || p), series: [{name: 'Changes applied', color: PAL[0], values: passes.map(p => s.by_pass[p])}], unit: 'changes'}), {type: 'bar', data: {labels: passes.map(p => PASS_LABEL[p] || p), datasets: [{data: passes.map(p => s.by_pass[p]), backgroundColor: passes.map(PASS_COLOR), borderRadius: 8}]}, options: {indexAxis: 'y', plugins: {legend: {display: false}}}});
  const list = () => { const q = $('#q').value.toLowerCase(), pf = $('#pf').value; const items = o.changes.filter(c => (!pf || c.pass_name === pf) && (!q || (c.before + c.after + c.explanation + c.pass_name).toLowerCase().includes(q)));
    $('#chg').innerHTML = items.length ? items.slice(0, 300).map(c => { const [cl, lb] = SAFETY[c.safety] || SAFETY.auto; return `<details class="item"><summary><span class="badge" style="background:${PASS_COLOR(c.pass_name)}22;color:${PASS_COLOR(c.pass_name)}">${esc(PASS_LABEL[c.pass_name] || c.pass_name)}</span><span class="mono muted">line ${c.lineno}</span><span class="mono">${esc(c.before.slice(0, 60))} → ${esc(c.after.slice(0, 40))}</span></summary><div class="body"><div class="diffline"><em>BEFORE</em><code class="b">${esc(c.before)}</code></div><div class="diffline"><em>AFTER</em><code class="a">${esc(c.after)}</code></div><p>${esc(c.explanation)}</p><span class="badge ${cl}">${lb}</span></div></details>`; }).join('') + (items.length > 300 ? `<p class="muted">Showing 300 of ${items.length}.</p>` : '') : '<p class="muted">No matching transformations.</p>'; };
  $('#q').oninput = list; $('#pf').onchange = list; list();
  const re = $('#reOp'); if (re) re.onclick = async () => { if (await doOptimize()) render(); };
};

/* ===== Algorithm analysis ===== */
P.algorithms = async view => {
  const f = file(); if (!f.opt && !f.analysis) return needs(view, 'opt');
  const recs = f.opt ? f.opt.recommendations : f.analysis.algorithms;
  const applied = new Set(); const approvedIds = () => $$('.ap:checked').map(x => x.value);
  view.innerHTML = `<div class="card"><div class="row"><div><h3 style="margin:0">${recs.length} algorithmic recommendation(s)</h3><span class="muted">Algorithms are never replaced automatically unless you approve a transformation that can be applied safely.</span></div><span class="sp"></span>
    <button class="btn orange" id="applyAp">Apply approved &amp; re-optimize</button></div></div><div style="height:14px"></div>
    ${recs.length ? recs.map(r => `<details class="item"><summary><span class="badge pink">${esc(r.kind.replace(/_/g, ' '))}</span><b>${esc(r.title)}</b><span class="mono muted">${esc(r.function)} · line ${r.lineno}</span><span class="sp"></span><span class="badge orange">${esc(r.original_complexity)}</span>→<span class="badge green">${esc(r.improved_complexity)}</span></summary>
      <div class="body"><p><b>Detected:</b> ${esc(r.current)}</p><p><b>Suggested:</b> ${esc(r.suggested)}</p><p>${esc(r.explanation)}</p><pre>${esc(r.alternative_code)}</pre>
      <span class="badge ${SAFETY[r.safety][0]}">${SAFETY[r.safety][1]}</span> ${r.applicable ? `<label style="margin-left:12px"><input type="checkbox" class="ap" value="${esc(r.id)}"> Approve automatic application (functools.lru_cache)</label>` : '<span class="muted" style="margin-left:10px">Manual change recommended – cannot be proven safe automatically.</span>'}</div></details>`).join('') : card('Nothing found', '<p class="muted">No inefficient algorithmic patterns were detected.</p>')}`;
  view.addEventListener('toggle', e => { const row = e.target.closest('details.item'); if (row && row.open && window.ProjectGuide) ProjectGuide.explain(`Algorithm analysis found ${row.querySelector('summary')?.textContent.trim() || 'this pattern'}. Read the detected behavior, proposed alternative, complexity estimates, and safety warning before choosing whether to apply it. Recommendations are suggestions and can require changes tailored to your program.`, 'speak', {noCaption: true}); });
  $('#applyAp').onclick = async () => { const ids = approvedIds(); if (!ids.length) return toast('Tick at least one approvable suggestion first.', 'warn'); if (await doOptimize({apply_recommendations: ids})) render(); };
};

/* ===== Complexity ===== */
P.complexity = async view => {
  const f = file(); if (!f.opt && !f.analysis) return needs(view, 'opt');
  const o = f.opt ? f.opt.complexity.original : f.analysis.complexity, n = f.opt ? f.opt.complexity.optimized : null, g = f.opt ? f.opt.complexity.growth : f.analysis.growth;
  const nm = n ? Object.fromEntries(n.functions.map(x => [x.name, x])) : {};
  view.innerHTML = `<div class="grid g4">${stat(o.time, 'Time complexity – original', PAL[4])}${stat(n ? n.time : '–', 'Time complexity – optimized', PAL[3])}${stat(o.space, 'Space – original', PAL[1])}${stat(n ? n.space : '–', 'Space – optimized', PAL[2])}</div>
  
  ${S3.on() ? `
  <div class="card" style="margin-top:18px">
    <div class="row">
      <div>
        <h3 style="margin:0">3D Computational Complexity Landscape</h3>
        <span class="muted" style="font-size:12.5px">Interactive 3D Big-O terrain comparing O(1), O(log n), O(n), O(n log n), O(n²), and O(2ⁿ) with animated algorithm probes.</span>
      </div>
    </div>
    ${slot('terrain3d', 'tall')}
  </div>
  <div class="card" style="margin-top:18px">
    <div class="row">
      <div>
        <h3 style="margin:0">3D Master Theorem Recurrence Tree Visualizer</h3>
        <span class="muted" style="font-size:12.5px">Visualizing recurrence relations T(n) = a·T(n/b) + f(n) across recursion depth.</span>
      </div>
    </div>
    ${slot('master3d', 'tall')}
  </div>
  ` : ''}

  <div class="card" style="margin-top:18px"><div class="row"><h3 style="margin:0">Operation growth</h3><span class="sp"></span><label><input type="checkbox" id="logS" checked> log scale</label></div>${vslot('chGrow', 'tall', 110)}
  <p class="muted">Static <b>estimates</b> from detected structure (loops, calls, recurrences). They are not measured run times – see Performance Benchmarking for measurements.</p></div>
  <div class="card" style="margin-top:18px"><h3>Per-function analysis</h3>${table(['Function', 'Line', 'Time', 'Space', 'Recurrence / notes', n ? 'Time after' : ''], o.functions.map(x => [`<code>${esc(x.name)}</code>`, x.lineno, `<span class="badge orange">${esc(x.time)}</span>`, `<span class="badge purple">${esc(x.space)}</span>`, esc(x.recurrence || '') + (x.manual ? ' <span class="badge pink">manual</span>' : ''), n && nm[x.name] ? `<span class="badge green">${esc(nm[x.name].time)}</span>` : '']))}
  <p class="muted">Module-level code: time ${esc(o.module_time)}, space ${esc(o.module_space)}. Recurrences such as T(n) = 2T(n/2) + O(n) are solved with the Master Theorem; unsupported patterns are marked <i>manual</i>.</p></div>`;

  if (S3.on()) {
    viz('terrain3d', el => S3.complexityTerrain(el, {
      currentClass: n ? n.time : o.time,
      originalClass: o.time
    }));
    viz('master3d', el => S3.masterTheorem3D(el, {a: 2, b: 2, k: 1}));
  }

  let gs = null; const draw = () => { if (S3.on()) { const el = $('#chGrow'); if (gs) gs.dispose(); el.innerHTML = ''; gs = S3.curves(el, {xs: g.sizes, log: $('#logS').checked, series: [{name: 'Original ' + o.time, color: PAL[4], values: g.original}, {name: 'Optimized ' + (n ? n.time : ''), color: PAL[3], values: g.optimized}]}); } else drawChart('chGrow', {type: 'line', data: {labels: g.sizes, datasets: [{label: 'Original ' + o.time, data: g.original, borderColor: PAL[4], backgroundColor: PAL[4] + '33', tension: .25}, {label: 'Optimized ' + (n ? n.time : ''), data: g.optimized, borderColor: PAL[3], backgroundColor: PAL[3] + '33', tension: .25}]}, options: {scales: {y: {type: $('#logS').checked ? 'logarithmic' : 'linear', title: {display: true, text: 'estimated operations'}}, x: {title: {display: true, text: 'input size n'}}}, interaction: {mode: 'index', intersect: false}}}); };
  if (S3.on() && f.analysis && f.analysis.call_graph.nodes.length) { const cg = f.analysis.call_graph; $('#view').insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:18px"><h3>3D call graph <span class="muted">(red = recursive; arrows point caller → callee)</span></h3>${slot('cg3d', 'tall')}</div>`);
    viz('cg3d', el => S3.graph(el, {layout: 'force', nodes: cg.nodes.slice(0, 120).map(x => ({id: x.id, label: x.id, shape: 'sphere', size: [.5 + Math.min(.6, (cg.edges.filter(e => e.to === x.id).length) * .12)], color: x.recursive ? '#F43F5E' : '#4285F4', glow: x.recursive, tipTitle: x.id + '()', tip: ['defined at line ' + x.line, x.recursive ? 'recursive' : 'not recursive']})), edges: cg.edges.map(e => ({from: e.from, to: e.to}))})); }
  draw(); $('#logS').onchange = draw;
};

/* ===== Benchmark ===== */
P.benchmark = async view => {
  const f = file(); if (!f.opt) return needs(view, 'opt'); const b = f.bench;
  view.innerHTML = `<div class="card"><h3>Benchmark settings</h3><p class="muted">Runs both versions in an isolated, resource-limited subprocess using <code>timeit</code> (time) and <code>tracemalloc</code> (peak memory). Your code is <b>executed</b>. Provide an entry expression to compare function calls at several input sizes (use <code>{n}</code>), or leave it empty to time the whole script.</p>
  <div class="row"><input type="text" id="entry" style="min-width:280px" placeholder="e.g. main({n})  or  fib({n})" value="${esc(f.entry || '')}"><input type="text" id="sizes" placeholder="sizes: 10, 100, 1000" value="${esc(f.sizes || '10, 20, 40')}"><label>Repeats <input type="number" id="rep" min="1" max="30" style="width:70px" value="${state.settings.bench_repeats}"></label><button class="btn primary" id="runB">⏱ Run benchmark</button></div></div><div id="bres" style="margin-top:18px"></div>`;
  const show = b => { const r = b.rows; $('#bres').innerHTML = `<div class="grid g4">${stat(fmt(b.summary.avg_time_improvement_pct) + '%', 'Average time improvement', PAL[3])}${stat(fmt(r.reduce((a, x) => a + x.memory_improvement_pct, 0) / r.length) + '%', 'Average memory change', PAL[1])}${stat(r.every(x => x.same_result) ? 'Yes' : 'No', 'Same return values', PAL[0])}</div>
    <div class="grid g2" style="margin-top:18px">${card('Execution time (ms, mean)', vslot('chT', '', 180))}${card('Peak memory (KB)', vslot('chM', '', 180))}</div>
    <div class="card" style="margin-top:18px">${table(['Input', 'Original', 'Optimized', 'Improvement', 'Mem orig', 'Mem opt', 'Runs'], r.map(x => [x.size, fmt(x.original.mean_s * 1000, 3) + ' ms', fmt(x.optimized.mean_s * 1000, 3) + ' ms', `<b style="color:${x.time_improvement_pct >= 0 ? '#0f9f6e' : '#d02a7e'}">${fmt(x.time_improvement_pct)}%</b>`, fmt(x.original.peak_kb, 0) + ' KB', fmt(x.optimized.peak_kb, 0) + ' KB', x.original.number + '×' + (state.settings.bench_repeats)]))}<p class="muted">Measured on this machine; small differences are within noise. Complexity estimates are separate static results.</p></div>`;
    const labels = r.map(x => String(x.size)); const ds = k => [{label: 'Original', data: r.map(x => x.original[k]), backgroundColor: PAL[4], borderRadius: 6}, {label: 'Optimized', data: r.map(x => x.optimized[k]), backgroundColor: PAL[3], borderRadius: 6}];
    const B3 = (k, mul, unit) => el => S3.bars(el, {labels, series: [{name: 'Original', color: PAL[4], values: r.map(x => x.original[k] * mul)}, {name: 'Optimized', color: PAL[3], values: r.map(x => x.optimized[k] * mul)}], unit});
    dc('chT', B3('mean_s', 1000, 'ms'), {type: 'bar', data: {labels, datasets: ds('mean_s').map(d => ({...d, data: d.data.map(v => v * 1000)}))}}); dc('chM', B3('peak_kb', 1, 'KB'), {type: 'bar', data: {labels, datasets: ds('peak_kb')}}); };
  if (b) show(b);
  $('#runB').onclick = async () => { if (!confirm('This will EXECUTE your original and optimized code in a sandboxed subprocess. Continue?')) return;
    f.entry = $('#entry').value; f.sizes = $('#sizes').value; const btn = $('#runB'); btn.disabled = true; const done = progress('Benchmarking original and optimized code…');
    try { f.bench = await api('/api/benchmark', {original: f.code, optimized: f.opt.optimized, entry: f.entry, sizes: f.sizes.split(/[ ,]+/).filter(Boolean).map(Number), repeats: +$('#rep').value, report_id: f.opt.report_id, settings: state.settings}); if (f.bench.error) { toast(f.bench.error, 'err'); f.bench = null; } else { toast('Benchmark finished', 'ok'); show(f.bench); } }
    catch (e) { toast(e.message, 'err'); } finally { done(); btn.disabled = false; } };
};

/* ===== Code comparison ===== */
P.compare = async view => {
  const f = file(); if (!f.opt) return needs(view, 'opt'); const o = f.opt;
  view.innerHTML = `<div class="card"><div class="row"><span class="badge pink">removed</span><span class="badge orange">modified</span><span class="badge green">added</span><span class="sp"></span><button class="btn teal" id="val">✔ Validate behaviour</button><button class="btn" id="dl">⬇ Download optimized .py</button></div>
  ${S3.on() ? '<h3 style="margin:14px 0 8px">3D Code City <span class="muted">(click a building to jump to that line)</span></h3>' + slot('city3d', 'tall') : ''}
  <div class="cmp" style="margin-top:12px"><div><b>Original</b><div class="editor-box" id="eL"></div></div><div><b>Optimized</b><div class="editor-box" id="eR"></div></div></div><div id="vres" style="margin-top:14px"></div></div>
  <div class="card" style="margin-top:18px"><h3>Select a change to locate it</h3><div class="scroll" style="max-height:300px">${o.changes.slice(0, 400).map((c, i) => `<details class="item" data-l="${c.lineno}"><summary><span class="badge">${esc(PASS_LABEL[c.pass_name] || c.pass_name)}</span><span class="mono">L${c.lineno}</span><span class="mono muted">${esc(c.before.slice(0, 70))}</span></summary><div class="body"><div class="diffline"><em>BEFORE</em><code class="b">${esc(c.before)}</code></div><div class="diffline"><em>AFTER</em><code class="a">${esc(c.after)}</code></div><p>${esc(c.explanation)}</p></div></details>`).join('')}</div></div>`;
  const L = await createEditor($('#eL'), f.code, {readOnly: true}), R = await createEditor($('#eR'), o.optimized, {readOnly: true});
  const lm = (extra) => { const m = o.changes.map(c => ({from: c.lineno, to: c.lineno, cls: c.after.startsWith('(removed') || c.after.startsWith('(branch') ? 'mk-removed' : 'mk-changed'})); if (extra) m.push(extra); return m; };
  const css = document.createElement('style'); css.textContent = L.monaco ? '.mk-removed{background:#FFE4E6}.mk-changed{background:#FEF3C7}.mk-added{background:#D1FAE5}.mk-focus{outline:2px solid #A78BFA}' : ''; document.head.appendChild(css);
  L.mark(lm()); R.mark(o.diff.map(d => ({from: d.b[0], to: Math.max(d.b[1], d.b[0]), cls: d.tag === 'insert' ? 'mk-added' : 'mk-changed'})).filter(d => d.to >= d.from));
  let city = null; if (S3.on()) { const lm1 = {}; o.changes.forEach(c => { lm1[c.lineno] = c.after.startsWith('(removed') || c.after.startsWith('(branch') ? 'removed' : 'changed'; }); const rm1 = {}; o.diff.forEach(d => { for (let i = d.b[0]; i <= d.b[1]; i++) rm1[i] = d.tag === 'insert' ? 'added' : 'changed'; });
  city = viz('city3d', el => S3.city(el, {left: {lines: f.code.split('\n'), marks: lm1}, right: {lines: o.optimized.split('\n'), marks: rm1}, onPick: (side, line) => { const ed = side === 'left' ? L : R; ed.reveal(line); if (side === 'left') L.mark(lm({from: line, to: line, cls: 'mk-focus'})); const source = (side === 'left' ? f.code : o.optimized).split('\n'); if (window.ProjectGuide) ProjectGuide.line(side, line, source[line - 1] || '', source.length); }})); }
  $$('details.item[data-l]').forEach(d => d.addEventListener('toggle', () => { if (d.open) { const l = +d.dataset.l; L.reveal(l); L.mark(lm({from: l, to: l, cls: 'mk-focus'})); if (city) city.focus('left', l); } }));
  $('#dl').onclick = () => download(f.name.replace(/\.py$/, '') + '_optimized.py', o.optimized);
  const show = v => { $('#vres').innerHTML = v.error ? `<p class="badge pink">${esc(v.error)}</p>` : `<div class="row"><span class="badge ${v.ok ? 'green' : 'pink'}">${v.ok ? 'Behaviour preserved on all tests' : 'Differences found'}</span><span class="badge">engine: ${esc(v.engine)}</span><span class="badge teal">stdout ${v.script.stdout_equal ? 'identical' : 'DIFFERS'}</span><span class="badge purple">${v.script.compared_globals} globals compared</span></div>
    ${(v.problems || []).length ? `<ul>${v.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}${v.functions.length ? table(['Function', 'Differential cases', 'Property cases', 'Result'], v.functions.map(x => [`<code>${esc(x.name)}</code>`, x.differential_cases, x.property_cases, x.mismatches.length ? `<span class="badge pink">mismatch ${esc(x.mismatches[0].args)}</span>` : '<span class="badge green">equal</span>'])) : '<p class="muted">No directly testable functions found; script output/globals were compared.</p>'}
    <p class="muted">Static checks: ${o.static_validation.checks.map(c => (c.ok ? '✓ ' : '✗ ') + esc(c.name)).join(' · ')}</p>`; };
  $$('details.item[data-l]').forEach(d => d.addEventListener('toggle', () => { if (d.open && window.ProjectGuide) { const line = +d.dataset.l, change = o.changes.find(c => c.lineno === line); ProjectGuide.explain(`This optimization was recorded at source line ${line}. ${change ? `${change.explanation} Before: ${change.before}. After: ${change.after}.` : 'Open the diff to compare the generated source with the original.'}`, 'speak', {noCaption: true}); } }));
  if (f.validation) show(f.validation);
  $('#val').onclick = async () => { if (!confirm('Validation EXECUTES both versions in a sandboxed subprocess. Continue?')) return; const done = progress('Differential & property-based testing…'); try { f.validation = await api('/api/validate', {original: f.code, optimized: o.optimized, settings: state.settings}); show(f.validation); toast(f.validation.ok ? 'Validation passed' : 'Validation found differences', f.validation.ok ? 'ok' : 'err'); } catch (e) { toast(e.message, 'err'); } finally { done(); } };
};

/* ===== History ===== */
P.history = async view => {
  let h = []; try { h = await api('/api/history', undefined, 'GET'); } catch (e) { toast(e.message, 'err'); }
  view.innerHTML = `${S3.on() && h.length ? card('3D history helix – every sphere is one optimization run', slot('hx3d', 'short')) + '<div style="height:18px"></div>' : ''}<div class="card"><div class="row"><input type="text" id="hq" placeholder="Search history…"><select id="hs"><option value="">All</option><option value="improved">With time measurements</option></select><span class="sp"></span><button class="btn pink" id="hc">Clear all</button></div><div id="ht" style="margin-top:14px"></div></div>`;
  const draw = () => { const q = $('#hq').value.toLowerCase(), s = $('#hs').value; const items = h.filter(x => (!q || x.filename.toLowerCase().includes(q)) && (!s || x.time_improvement_pct != null));
    $('#ht').innerHTML = items.length ? table(['When', 'File', 'Lines', 'Applied', 'Opportunities', 'Size ↓', 'Time ↓', 'Complexity', ''], items.map(x => [new Date(x.ts * 1000).toLocaleString(), esc(x.filename), x.lines, x.applied, x.opportunities, fmt(x.node_reduction_pct) + '%', x.time_improvement_pct == null ? '–' : fmt(x.time_improvement_pct) + '%', `${esc(x.orig_time)} → ${esc(x.opt_time)}`, `<a class="btn sm" target="_blank" href="/api/report/${x.id}">Report</a> <button class="btn sm" data-d="${x.id}">✕</button>`])) : '<p class="muted">No history yet.</p>'; };
  viz('hx3d', el => S3.helix(el, {items: h.slice(0, 60).reverse().map(x => ({value: x.applied, color: x.time_improvement_pct != null ? '#34D399' : '#4285F4', tip: S3.tipHtml(escTip(x.filename), [new Date(x.ts * 1000).toLocaleString(), x.applied + ' applied · ' + escTip(x.orig_time) + ' → ' + escTip(x.opt_time), x.time_improvement_pct != null ? 'measured ' + x.time_improvement_pct.toFixed(1) + '% faster' : 'not benchmarked'])}))}));
  draw(); $('#hq').oninput = draw; $('#hs').onchange = draw;
  view.onclick = async e => { const d = e.target.closest('[data-d]'); if (d) { await api('/api/history/' + d.dataset.d, undefined, 'DELETE'); h = h.filter(x => x.id !== d.dataset.d); draw(); } };
  $('#hc').onclick = async () => { if (confirm('Delete all history?')) { await api('/api/history', undefined, 'DELETE'); h = []; draw(); toast('History cleared', 'ok'); } };
};

/* ===== Reports ===== */
P.reports = async view => {
  const f = file(); if (!f.opt) return needs(view, 'opt'); const id = f.opt.report_id; const done = state.files.filter(x => x.opt);
  view.innerHTML = `<div class="card"><div class="row"><h3 style="margin:0">Report – ${esc(f.name)}</h3><span class="sp"></span><a class="btn green" href="/api/report/${id}?format=html&download=1">⬇ HTML</a><a class="btn teal" href="/api/report/${id}?format=md">⬇ Markdown</a><a class="btn" href="/api/report/${id}?format=json">JSON</a>
    <button class="btn orange" id="dlo">⬇ Optimized .py</button><button class="btn primary" id="dlz">⬇ All optimized files (.zip)</button><a class="btn pink" href="#final">📑 Final report (3D, printable)</a></div>
    <p class="muted">The report includes applied transformations, recommendations, complexity estimates${f.bench ? ' and your benchmark results' : ''}. ${f.bench ? '' : 'Run a benchmark first to include measured times.'}</p><iframe class="report" src="/api/report/${id}"></iframe></div>`;
  $('#dlo').onclick = () => download(f.name.replace(/\.py$/, '') + '_optimized.py', f.opt.optimized);
  $('#dlz').onclick = async () => { const r = await fetch('/api/download_zip', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({files: done.map(x => ({name: x.name.replace(/\.py$/, '') + '_optimized.py', code: x.opt.optimized}))})}); download('optimized_files.zip', await r.blob()); };
};

/* ===== Settings ===== */
P.settings = async view => {
  const s = state.settings; const save = () => { store.save(); toast('Settings saved', 'ok'); };
  const appearance = card('Appearance, 3D and voice', `
    <div class="tog"><div><b>3D quality</b><small>Use Low on slow laptops, Off if WebGL is unavailable (the original 2D charts are used instead)</small></div><select id="q3"><option value="high" ${s.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${s.quality === 'low' ? 'selected' : ''}>Low</option><option value="off" ${s.quality === 'off' ? 'selected' : ''}>Off (2D)</option></select></div>
    <div class="tog"><div><b>Voice (text-to-speech)</b><small>Voice tutor and intro speak aloud. Voices come from your device / browser.</small></div><input type="checkbox" id="vo" ${s.voice !== false ? 'checked' : ''}></div>
    <div class="tog"><b>Speech speed</b><input type="range" id="rt" min="0.6" max="1.4" step="0.1" value="${s.rate || 1}"></div>
    <div class="tog"><div><b>Speech voice</b><small>Choose an installed voice for the selected language.</small></div><select id="voiceChoice"><option value="">Automatic</option>${Voice.voices.map(v => `<option value="${esc(v.voiceURI)}" ${s.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></div>
    <div class="tog"><b>Language</b><select id="lg">${LANGS.map(l => `<option value="${l.code}" ${l.code === lang() ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>
    <div class="row" style="margin-top:12px"><button class="btn teal" id="tv">🔊 Test voice</button><button class="btn" id="ri">🎬 Replay intro</button></div><p class="muted" id="vinfo"></p>`);
  view.innerHTML = `<div class="grid g2">${appearance}${card('Optimization passes', Object.keys(s.passes).map(k => `<div class="tog"><div><b>${esc(PASS_LABEL[k] || k)}</b>${k === 'unused_imports' ? '<small>Removes imports never referenced (off by default)</small>' : ''}</div><input type="checkbox" data-p="${k}" ${s.passes[k] ? 'checked' : ''}></div>`).join(''))}
  <div>${card('Safety assumptions', `<div class="tog"><div><b>Treat module as a script</b><small>Allows removing unused module-level variables (they are not importable API)</small></div><input type="checkbox" id="as" ${s.assume_script ? 'checked' : ''}></div>
    <div class="tog"><div><b>Assume untyped values are numeric</b><small>Enables CSE/LICM/strength reduction on unannotated parameters. Faster, but wrong for lists/strings – validate!</small></div><input type="checkbox" id="an" ${s.assume_numeric ? 'checked' : ''}></div>`)}
  <div style="height:18px"></div>${card('Limits', [['iteration_limit', 'Max optimization iterations', 1, 20], ['unroll_max_trip', 'Unroll up to N iterations', 1, 16], ['inline_max_nodes', 'Max inlined body size (AST nodes)', 3, 100], ['bench_repeats', 'Benchmark repeats', 1, 30], ['bench_timeout', 'Sandbox time limit (s)', 2, 120]].map(([k, l, lo, hi]) => `<div class="tog"><b>${l}</b><input type="number" data-n="${k}" min="${lo}" max="${hi}" value="${s[k]}" style="width:80px"></div>`).join('') + '<div class="row" style="margin-top:14px"><button class="btn" id="rs">Reset to defaults</button><button class="btn" id="rg">Run regression suite</button></div><div id="rgo"></div>')}</div></div>`;
  const populateVoices = () => { const sel = $('#voiceChoice'); if (!sel) return; const selected = s.voiceURI || ''; sel.innerHTML = '<option value="">Automatic</option>' + Voice.voices.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`).join(''); sel.value = Voice.voices.some(v => v.voiceURI === selected) ? selected : ''; };
  const vi = () => { const pk = Voice.pick(lang()); $('#vinfo').textContent = !Voice.supported ? 'This browser has no speech synthesis.' : pk.voice ? `Voice: ${pk.voice.name} (${pk.voice.lang})${pk.fallback ? ' – used as a stand-in for this language' : ''}` : 'No installed voice for this language – the tutor will show captions only. Install a voice in your OS language settings.'; }; populateVoices(); vi(); setTimeout(() => { populateVoices(); vi(); }, 600);
  if (Voice.supported) speechSynthesis.addEventListener('voiceschanged', () => { populateVoices(); vi(); }, {once: true});
  $('#tv').onclick = () => { Voice.enabled = true; Voice.speak(langOf(lang()).welcome, lang()); }; $('#ri').onclick = () => Intro.show({force: true});
  view.onchange = e => { const t = e.target; if (t.id === 'q3') { s.quality = t.value; save(); render(); return; } if (t.id === 'vo') { s.voice = t.checked; Voice.enabled = t.checked; save(); return; } if (t.id === 'rt') { s.rate = +t.value; Voice.rate = s.rate; save(); return; } if (t.id === 'voiceChoice') { s.voiceURI = t.value; Voice.voiceURI = t.value; save(); vi(); return; } if (t.id === 'lg') { s.lang = t.value; $('#langSel').value = t.value; save(); vi(); return; }
    if (t.dataset.p) s.passes[t.dataset.p] = t.checked; else if (t.dataset.n) s[t.dataset.n] = +t.value; else if (t.id === 'as') s.assume_script = t.checked; else if (t.id === 'an') s.assume_numeric = t.checked; save(); };
  $('#rs').onclick = () => { state.settings = structuredClone(DEFAULT_SETTINGS); save(); render(); };
  $('#rg').onclick = async () => { const done = progress('Running regression suite…'); try { const r = await api('/api/regression', undefined, 'GET'); $('#rgo').innerHTML = `<p><span class="badge ${r.ok ? 'green' : 'pink'}">${r.ok ? 'All regression cases passed' : 'Regression failures'}</span></p>` + table(['Case', 'Changes', 'Result'], r.cases.map(c => [c.name, c.changes, c.ok ? '✓' : esc(c.problems.join('; '))])); } catch (e) { toast(e.message, 'err'); } finally { done(); } };
};
